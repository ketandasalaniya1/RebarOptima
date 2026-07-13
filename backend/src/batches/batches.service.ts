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

    // 1. Fetch Scrap Rules to classify remnants
    const scrapRules = await this.inventoryService.getScrapRules(companyId);
    const rulesMap = new Map<number, number>();
    scrapRules.forEach(r => rulesMap.set(r.diameter, r.scrapLengthThreshold));

    let totalScrapKg = 0;
    let totalRemnantKg = 0;
    let totalStockUsedKg = 0;

    // 2. Process layouts
    for (const layout of dto.layouts) {
      const diameter = Number(layout.diameter);
      const stockLength = Number(layout.stockLength);
      const repetition = Number(layout.repetition);
      const isVirtual = !!layout.isVirtual;
      const dbId = layout.dbId;

      // Calculate weight of 1 bar used
      const singleWeight = this.inventoryService.getSingleBarWeight(diameter, stockLength);
      const layoutStockWeight = singleWeight * repetition;

      if (!isVirtual) {
        totalStockUsedKg += layoutStockWeight;

        // Deduct from database stock item
        if (dbId) {
          const originalItem = await this.stockItemModel.findById(dbId).exec();
          if (originalItem) {
            const newQty = Math.max(0, originalItem.quantity - repetition);
            const newWeight = Math.max(0, originalItem.weightInKgs - layoutStockWeight);
            
            if (newQty === 0) {
              await this.stockItemModel.findByIdAndDelete(dbId).exec();
            } else {
              await this.stockItemModel.findByIdAndUpdate(dbId, {
                quantity: newQty,
                weightInKgs: newWeight,
              } as any).exec();
            }

            // ponytail: log outward stock consumption transaction
            await new this.transactionModel({
              companyId: cid,
              type: 'OUTWARD',
              diameter,
              length: stockLength,
              quantity: repetition,
              weightInKgs: layoutStockWeight,
              brandName: originalItem.brandName || '',
              vendorName: originalItem.vendorName || '',
              typeOfBar: originalItem.typeOfBar || '',
              referenceName: dto.batchName || 'Cutting Batch',
            }).save();

            // Copy parent properties for remnants we are going to create
            const waste = Number(layout.waste);
            if (waste > 0) {
              const threshold = rulesMap.get(diameter) ?? 1000;
              const wasteWeight = this.inventoryService.getSingleBarWeight(diameter, waste) * repetition;

              if (waste < threshold) {
                // It is Scrap
                totalScrapKg += wasteWeight;
              } else {
                // It is a Reusable Remnant
                totalRemnantKg += wasteWeight;
                
                // Save remnant in StockItem
                const remnantFilter = {
                  companyId: cid,
                  diameter,
                  length: waste,
                  isRemnant: true,
                  costPerKg: originalItem.costPerKg,
                  typeOfBar: originalItem.typeOfBar || '',
                  brandName: originalItem.brandName || '',
                  vendorName: originalItem.vendorName || '',
                };

                await this.stockItemModel.findOneAndUpdate(
                  remnantFilter as any,
                  {
                    $inc: {
                      quantity: repetition,
                      weightInKgs: wasteWeight,
                    } as any,
                  } as any,
                  { upsert: true } as any
                ).exec();

                // ponytail: log remnant inward transaction
                await new this.transactionModel({
                  companyId: cid,
                  type: 'REMNANT',
                  diameter,
                  length: waste,
                  quantity: repetition,
                  weightInKgs: wasteWeight,
                  brandName: originalItem.brandName || '',
                  vendorName: originalItem.vendorName || '',
                  typeOfBar: originalItem.typeOfBar || '',
                  referenceName: dto.batchName || 'Cutting Batch',
                }).save();
              }
            }
          }
        }
      } else {
        // Virtual stock has no dbId and doesn't exist in DB, so no deduction.
        // But waste from virtual stock goes to scrap.
        const waste = Number(layout.waste);
        if (waste > 0) {
          const wasteWeight = this.inventoryService.getSingleBarWeight(diameter, waste) * repetition;
          totalScrapKg += wasteWeight;
        }
      }
    }

    // 3. Save Batch
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

    return batch.save();
  }

  async getBatchHistory(companyId: string): Promise<Batch[]> {
    return this.batchModel.find({ companyId: new Types.ObjectId(companyId) as any })
      .sort({ createdAt: -1 } as any)
      .exec();
  }

  async getDashboardStats(companyId: string) {
    const cid = new Types.ObjectId(companyId);

    // 1. Fetch live stock weight
    const liveStock = await this.stockItemModel.find({ companyId: cid as any, quantity: { $gt: 0 } as any }).exec();
    let liveStandardKg = 0;
    let liveRemnantsKg = 0;
    liveStock.forEach(item => {
      if (item.isRemnant) {
        liveRemnantsKg += item.weightInKgs;
      } else {
        liveStandardKg += item.weightInKgs;
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
      
      const usedStockLength = b.summary?.totalUsedStockLength || 0;
      // Approximate used stock kg by summing layouts or using average rebar weight
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

    // Format daily scrap graph data for the last 7 days
    const dailyScrapGraph: { date: string; scrapKg: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyScrapGraph.push({
        date: label,
        scrapKg: Math.round((dailyScrapMap.get(dateStr) || 0) * 100) / 100,
      });
    }

    const wastagePercentage = totalStockUsedKg > 0 ? (totalScrapKg / totalStockUsedKg) * 100 : 0;

    return {
      liveStandardKg: Math.round(liveStandardKg * 100) / 100,
      liveRemnantsKg: Math.round(liveRemnantsKg * 100) / 100,
      totalLiveStockKg: Math.round((liveStandardKg + liveRemnantsKg) * 100) / 100,
      totalScrapKg: Math.round(totalScrapKg * 100) / 100,
      wastagePercentage: Math.round(wastagePercentage * 100) / 100,
      dailyScrapGraph,
    };
  }
}
