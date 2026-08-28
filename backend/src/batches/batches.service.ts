import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Batch } from './batch.schema';
import { StockItem } from '../inventory/stock-item.schema';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTransaction } from '../inventory/inventory-transaction.schema';

@Injectable()
export class BatchesService {
  constructor(
    @InjectModel(Batch.name) private batchModel: Model<Batch>,
    @InjectModel(StockItem.name) private stockItemModel: Model<StockItem>,
    @InjectModel(InventoryTransaction.name) private transactionModel: Model<InventoryTransaction>,
    private inventoryService: InventoryService,
  ) {}

  async commitBatch(
    companyId: string,
    dto: {
      batchName: string;
      inputStock: any[];
      requiredParts: any[];
      layouts: any[];
      summary: any;
    },
  ): Promise<Batch> {
    const cid = new Types.ObjectId(companyId);

    // 1. Fetch Scrap Rules and all referenced Stock Items in parallel
    const dbIds = (dto.layouts || [])
      .map(l => l.dbId)
      .filter(id => id && Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    const [scrapRules, originalStockItems] = await Promise.all([
      this.inventoryService.getScrapRules(companyId),
      dbIds.length > 0
        ? this.stockItemModel.find({ _id: { $in: dbIds }, companyId: cid as any }).exec()
        : Promise.resolve([]),
    ]);

    const rulesMap = new Map<number, number>();
    scrapRules.forEach(r => rulesMap.set(r.diameter, r.scrapLengthThreshold));

    const stockMap = new Map<string, StockItem>();
    originalStockItems.forEach(item => stockMap.set(item._id.toString(), item));

    let totalScrapKg = 0;
    let totalRemnantKg = 0;
    let totalStockUsedKg = 0;

    // Track in-memory balance for stock items that might be used across multiple layouts
    const stockQuantityChanges = new Map<string, { deductionQty: number; deductionWeight: number }>();
    const remnantUpsertMap = new Map<string, { filter: any; incQty: number; incWeight: number }>();
    const transactionsToInsert: any[] = [];

    // 2. Process layouts in-memory
    for (const layout of dto.layouts) {
      const diameter = Number(layout.diameter);
      const stockLength = Number(layout.stockLength);
      const repetition = Number(layout.repetition);
      const isVirtual = !!layout.isVirtual;
      const dbId = layout.dbId ? layout.dbId.toString() : null;

      const singleWeight = this.inventoryService.getSingleBarWeight(diameter, stockLength);
      const layoutStockWeight = singleWeight * repetition;

      if (!isVirtual && dbId) {
        totalStockUsedKg += layoutStockWeight;

        const originalItem = stockMap.get(dbId);
        if (originalItem) {
          // Accumulate stock deduction
          const currentChange = stockQuantityChanges.get(dbId) || { deductionQty: 0, deductionWeight: 0 };
          currentChange.deductionQty += repetition;
          currentChange.deductionWeight += layoutStockWeight;
          stockQuantityChanges.set(dbId, currentChange);

          // Queue outward transaction
          transactionsToInsert.push({
            companyId: cid,
            type: 'OUTWARD',
            diameter,
            length: stockLength,
            quantity: repetition,
            weightInKgs: layoutStockWeight,
            costPerKg: originalItem.costPerKg || 0,
            brandName: originalItem.brandName || '',
            vendorName: originalItem.vendorName || '',
            typeOfBar: originalItem.typeOfBar || '',
            referenceName: dto.batchName || 'Cutting Batch',
          });

          // Handle waste
          const waste = Number(layout.waste);
          if (waste > 0) {
            const threshold = rulesMap.get(diameter) ?? 1000;
            const wasteWeight = this.inventoryService.getSingleBarWeight(diameter, waste) * repetition;

            if (waste < threshold) {
              // Scrap
              totalScrapKg += wasteWeight;
              transactionsToInsert.push({
                companyId: cid,
                type: 'SCRAP',
                diameter,
                length: waste,
                quantity: repetition,
                weightInKgs: wasteWeight,
                costPerKg: originalItem.costPerKg || 0,
                brandName: originalItem.brandName || '',
                vendorName: originalItem.vendorName || '',
                typeOfBar: originalItem.typeOfBar || '',
                referenceName: dto.batchName || 'Cutting Batch',
              });
            } else {
              // Reusable Remnant
              totalRemnantKg += wasteWeight;

              const remnantKey = `${diameter}_${waste}_${originalItem.costPerKg || 0}_${originalItem.brandName || ''}_${originalItem.vendorName || ''}_${originalItem.typeOfBar || ''}`;
              const existingRemnant = remnantUpsertMap.get(remnantKey);
              if (existingRemnant) {
                existingRemnant.incQty += repetition;
                existingRemnant.incWeight += wasteWeight;
              } else {
                remnantUpsertMap.set(remnantKey, {
                  filter: {
                    companyId: cid,
                    diameter,
                    length: waste,
                    isRemnant: true,
                    costPerKg: originalItem.costPerKg,
                    typeOfBar: originalItem.typeOfBar || '',
                    brandName: originalItem.brandName || '',
                    vendorName: originalItem.vendorName || '',
                  },
                  incQty: repetition,
                  incWeight: wasteWeight,
                });
              }

              transactionsToInsert.push({
                companyId: cid,
                type: 'REMNANT',
                diameter,
                length: waste,
                quantity: repetition,
                weightInKgs: wasteWeight,
                costPerKg: originalItem.costPerKg || 0,
                brandName: originalItem.brandName || '',
                vendorName: originalItem.vendorName || '',
                typeOfBar: originalItem.typeOfBar || '',
                referenceName: dto.batchName || 'Cutting Batch',
              });
            }
          }
        }
      } else {
        // Virtual stock waste handling
        const waste = Number(layout.waste);
        if (waste > 0) {
          const threshold = rulesMap.get(diameter) ?? 1000;
          const wasteWeight = this.inventoryService.getSingleBarWeight(diameter, waste) * repetition;
          if (waste < threshold) {
            totalScrapKg += wasteWeight;
            transactionsToInsert.push({
              companyId: cid,
              type: 'SCRAP',
              diameter,
              length: waste,
              quantity: repetition,
              weightInKgs: wasteWeight,
              referenceName: dto.batchName || 'Cutting Batch',
            });
          } else {
            totalRemnantKg += wasteWeight;
          }
        }
      }
    }

    // 3. Prepare Bulk Operations for Stock Updates & Remnant Upserts
    const bulkStockOps: any[] = [];

    // Deduct stock
    for (const [dbId, change] of stockQuantityChanges.entries()) {
      const originalItem = stockMap.get(dbId);
      if (originalItem) {
        const finalQty = originalItem.quantity - change.deductionQty;
        const finalWeight = originalItem.weightInKgs - change.deductionWeight;

        if (finalQty <= 0) {
          bulkStockOps.push({
            deleteOne: {
              filter: { _id: new Types.ObjectId(dbId) },
            },
          });
        } else {
          bulkStockOps.push({
            updateOne: {
              filter: { _id: new Types.ObjectId(dbId) },
              update: {
                $set: {
                  quantity: Math.max(0, finalQty),
                  weightInKgs: Math.max(0, finalWeight),
                },
              },
            },
          });
        }
      }
    }

    // Upsert Remnants
    for (const remnantData of remnantUpsertMap.values()) {
      bulkStockOps.push({
        updateOne: {
          filter: remnantData.filter,
          update: {
            $inc: {
              quantity: remnantData.incQty,
              weightInKgs: remnantData.incWeight,
            },
          },
          upsert: true,
        },
      });
    }

    // 4. Create Batch Document
    const batch = new this.batchModel({
      companyId: cid,
      batchName: dto.batchName,
      inputStock: dto.inputStock,
      requiredParts: dto.requiredParts,
      layouts: dto.layouts,
      summary: {
        totalPartsLength: dto.summary.totalPartsLength,
        totalUsedStockLength: dto.summary.totalUsedStockLength,
        totalCutsCount: dto.summary.totalCutsCount,
        totalRemnant: dto.summary.totalRemnant,
        avgUtilization: dto.summary.avgUtilization,
        totalScrapKg,
        totalRemnantKg,
      },
    });

    // 5. Execute all database writes in parallel (Bulk Stock Ops, Bulk Insert Transactions, Save Batch)
    const dbPromises: Promise<any>[] = [batch.save()];

    if (bulkStockOps.length > 0) {
      dbPromises.push(this.stockItemModel.bulkWrite(bulkStockOps, { ordered: false }));
    }

    if (transactionsToInsert.length > 0) {
      dbPromises.push(this.transactionModel.insertMany(transactionsToInsert, { ordered: false }));
    }

    const [savedBatch] = await Promise.all(dbPromises);
    return savedBatch;
  }

  async getBatchHistory(companyId: string): Promise<Batch[]> {
    return this.batchModel.find({ companyId: new Types.ObjectId(companyId) as any })
      .sort({ createdAt: -1 } as any)
      .exec();
  }

  async getDashboardStats(companyId: string) {
    const cid = new Types.ObjectId(companyId);

    // 1. Fetch live stock weight and diameter breakdowns
    const liveStock = await this.stockItemModel.find({ companyId: cid as any, quantity: { $gt: 0 } as any }).exec();
    let liveStandardKg = 0;
    let liveRemnantsKg = 0;
    const diameterWeights: { [key: number]: number } = { 8: 0, 10: 0, 12: 0, 16: 0, 20: 0, 25: 0, 32: 0 };
    const remnantDiameterWeights: { [key: number]: number } = { 8: 0, 10: 0, 12: 0, 16: 0, 20: 0, 25: 0, 32: 0 };

    liveStock.forEach(item => {
      const dia = Number(item.diameter);
      if (item.isRemnant) {
        liveRemnantsKg += item.weightInKgs || 0;
        if (remnantDiameterWeights[dia] !== undefined) {
          remnantDiameterWeights[dia] += item.weightInKgs || 0;
        }
      } else {
        liveStandardKg += item.weightInKgs || 0;
      }
      if (diameterWeights[dia] !== undefined) {
        diameterWeights[dia] += item.weightInKgs || 0;
      }
    });

    // 2. Fetch all batches to calculate scrap and daily graphs
    const batches = await this.batchModel.find({ companyId: cid as any }).sort({ createdAt: 1 } as any).exec();
    
    let totalScrapKg = 0;
    let totalStockUsedKg = 0;
    
    // Group scrap by date
    const dailyScrapMap = new Map<string, number>();
    
    batches.forEach(b => {
      const scrap = b.summary?.totalScrapKg || 0;
      totalScrapKg += scrap;
      
      let batchStockKg = 0;
      if (b.layouts) {
        b.layouts.forEach(l => {
          if (!l.isVirtual) {
            const w = this.inventoryService.getSingleBarWeight(Number(l.diameter), Number(l.stockLength));
            batchStockKg += w * Number(l.repetition);
          }
        });
      }
      totalStockUsedKg += batchStockKg;

      // Group daily
      if ((b as any).createdAt) {
        const dateStr = new Date((b as any).createdAt).toISOString().split('T')[0];
        dailyScrapMap.set(dateStr, (dailyScrapMap.get(dateStr) || 0) + scrap);
      }
    });

    // Format daily scrap graph data for the last 30 days
    const dailyScrapGraph: { date: string; fullDate: string; scrapKg: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyScrapGraph.push({
        date: label,
        fullDate: dateStr,
        scrapKg: Math.round((dailyScrapMap.get(dateStr) || 0) * 100) / 100,
      });
    }

    const wastagePercentage = totalStockUsedKg > 0 ? (totalScrapKg / totalStockUsedKg) * 100 : 0;

    // Fetch inward steel transactions
    const inwardTransactions = await this.transactionModel.find({ companyId: cid as any, type: 'INWARD' as any }).exec();
    let totalSteelPurchasedCost = 0;
    let totalSteelPurchasedKg = 0;
    inwardTransactions.forEach((t: any) => {
      const wt = Number(t.weightInKgs) || 0;
      const cost = Number(t.costPerKg) || 60;
      totalSteelPurchasedKg += wt;
      totalSteelPurchasedCost += wt * cost;
    });

    if (totalSteelPurchasedCost === 0 && liveStock.length > 0) {
      liveStock.forEach(i => {
        const wt = Number(i.weightInKgs) || 0;
        const cost = Number(i.costPerKg) || 60;
        totalSteelPurchasedKg += wt;
        totalSteelPurchasedCost += wt * cost;
      });
    }

    const liveScrapKg = Math.max(0, totalScrapKg);
    const lostMaterialValue = Math.max(0, (totalScrapKg * 60));

    return {
      liveStandardKg: Math.round(liveStandardKg * 100) / 100,
      liveRemnantsKg: Math.round(liveRemnantsKg * 100) / 100,
      totalLiveStockKg: Math.round((liveStandardKg + liveRemnantsKg) * 100) / 100,
      liveScrapKg: Math.round(liveScrapKg * 100) / 100,
      totalScrapKg: Math.round(totalScrapKg * 100) / 100,
      wastagePercentage: Math.round(wastagePercentage * 100) / 100,
      dailyScrapGraph,
      diameterWeights,
      remnantDiameterWeights,
      totalSteelPurchasedCost: Math.round(totalSteelPurchasedCost),
      totalSteelPurchasedKg: Math.round(totalSteelPurchasedKg * 100) / 100,
      totalScrapSoldWeight: 0,
      totalScrapRevenue: 0,
      totalScrapLossDifferential: 0,
      lostMaterialValue: Math.round(lostMaterialValue * 100) / 100,
    };
  }

  async getBatchScrapRecords(companyId: string) {
    const cid = new Types.ObjectId(companyId);
    const batches = await this.batchModel.find({ companyId: cid as any })
      .sort({ createdAt: -1 } as any)
      .exec();

    const scrapRules = await this.inventoryService.getScrapRules(companyId);
    const rulesMap = new Map<number, number>();
    scrapRules.forEach(r => rulesMap.set(r.diameter, r.scrapLengthThreshold));

    return batches.map(b => {
      const createdAt = (b as any).createdAt;
      const batchName = b.batchName;
      const batchId = b._id.toString();
      const totalScrapKg = Math.round((b.summary?.totalScrapKg || 0) * 100) / 100;

      // Build diameter breakdown for scrap in this batch
      const diameterBreakdownMap = new Map<number, { count: number; scrapKg: number; totalWasteMm: number }>();

      if (b.layouts) {
        b.layouts.forEach(layout => {
          const dia = Number(layout.diameter);
          const waste = Number(layout.waste);
          const rep = Number(layout.repetition);
          const threshold = rulesMap.get(dia) ?? 1000;

          if (waste > 0 && waste < threshold) {
            const wasteWeight = this.inventoryService.getSingleBarWeight(dia, waste) * rep;
            const current = diameterBreakdownMap.get(dia) || { count: 0, scrapKg: 0, totalWasteMm: 0 };
            current.count += rep;
            current.scrapKg += wasteWeight;
            current.totalWasteMm += waste * rep;
            diameterBreakdownMap.set(dia, current);
          }
        });
      }

      const diameterBreakdown = Array.from(diameterBreakdownMap.entries()).map(([diameter, data]) => ({
        diameter,
        pieces: data.count,
        scrapKg: Math.round(data.scrapKg * 100) / 100,
        totalWasteMm: data.totalWasteMm,
      })).sort((a, b) => a.diameter - b.diameter);

      return {
        batchId,
        batchName,
        createdAt,
        totalScrapKg,
        totalRemnantKg: Math.round((b.summary?.totalRemnantKg || 0) * 100) / 100,
        avgUtilization: b.summary?.avgUtilization || 0,
        diameterBreakdown,
      };
    });
  }

  async updateBatch(companyId: string, batchId: string, batchName: string): Promise<Batch> {
    const cid = new Types.ObjectId(companyId);
    const bid = new Types.ObjectId(batchId);
    const existing = await this.batchModel.findOne({ _id: bid as any, companyId: cid as any }).exec();
    if (!existing) {
      throw new Error('Batch not found');
    }
    existing.batchName = batchName;
    return existing.save();
  }

  async deleteBatch(companyId: string, batchId: string, restoreStock: boolean = false): Promise<any> {
    const cid = new Types.ObjectId(companyId);
    const bid = new Types.ObjectId(batchId);

    const batch = await this.batchModel.findOne({ _id: bid as any, companyId: cid as any }).exec();
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (restoreStock) {
      // 1. Fetch Scrap Rules
      const scrapRules = await this.inventoryService.getScrapRules(companyId);
      const rulesMap = new Map<number, number>();
      scrapRules.forEach(r => rulesMap.set(r.diameter, r.scrapLengthThreshold));

      // 2. Restore Consumed Stock Items & Deduct Generated Remnants
      for (const layout of batch.layouts || []) {
        const diameter = Number(layout.diameter);
        const stockLength = Number(layout.stockLength);
        const repetition = Number(layout.repetition) || 1;
        const isVirtual = !!layout.isVirtual;

        if (!isVirtual) {
          const singleBarWeight = this.inventoryService.getSingleBarWeight(diameter, stockLength);
          const restoredWeight = singleBarWeight * repetition;

          // Re-increment consumed stock in inventory
          await this.stockItemModel.updateOne(
            { companyId: cid as any, diameter, length: stockLength, isRemnant: false },
            { $inc: { quantity: repetition, weightInKgs: restoredWeight } },
            { upsert: true }
          );

          // If this layout created a remnant, remove/decrement it from inventory
          const waste = Number(layout.waste);
          if (waste > 0) {
            const threshold = rulesMap.get(diameter) ?? 1000;
            if (waste >= threshold) {
              const wasteWeight = this.inventoryService.getSingleBarWeight(diameter, waste) * repetition;
              const remDoc = await this.stockItemModel.findOne({
                companyId: cid as any,
                diameter,
                length: waste,
                isRemnant: true,
              }).exec();

              if (remDoc) {
                if (remDoc.quantity <= repetition) {
                  await this.stockItemModel.deleteOne({ _id: remDoc._id }).exec();
                } else {
                  await this.stockItemModel.updateOne(
                    { _id: remDoc._id },
                    { $inc: { quantity: -repetition, weightInKgs: -wasteWeight } }
                  ).exec();
                }
              }
            }
          }
        }
      }

      // 3. Remove inventory transactions tied to this batch
      await this.transactionModel.deleteMany({
        companyId: cid as any,
        referenceName: batch.batchName,
      }).exec();
    }

    // 4. Delete the batch document
    return this.batchModel.deleteOne({ _id: bid as any, companyId: cid as any }).exec();
  }
}


