import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StockItem } from './stock-item.schema';
import { ScrapRule } from './scrap-rule.schema';
import { InventoryTransaction } from './inventory-transaction.schema';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(StockItem.name) private stockItemModel: Model<StockItem>,
    @InjectModel(ScrapRule.name) private scrapRuleModel: Model<ScrapRule>,
    @InjectModel(InventoryTransaction.name) private transactionModel: Model<InventoryTransaction>,
  ) {}

  // Helper formula to compute weight of 1 standard bar (12m length) in kg
  getSingleBarWeight(diameter: number, lengthMm: number = 12000): number {
    const weightPerMeter = (diameter * diameter) / 162;
    return (lengthMm / 1000) * weightPerMeter;
  }

  async getInventory(companyId: string) {
    const items = await this.stockItemModel.find({
      companyId: new Types.ObjectId(companyId) as any,
      quantity: { $gt: 0 } as any,
    })
    .sort({ createdAt: 1 } as any) // ponytail: FIFO - oldest rebar stock first
    .exec();

    return {
      standardStock: items.filter(item => !item.isRemnant),
      remnantsStock: items.filter(item => item.isRemnant),
    };
  }

  async inwardEntry(
    companyId: string,
    dto: {
      diameter: number;
      length?: number;
      quantity?: number;
      weightInKgs?: number;
      costPerKg: number;
      typeOfBar?: string;
      brandName?: string;
      vendorName?: string;
    },
  ): Promise<any> {
    const length = dto.length || 12000;
    const singleWeight = this.getSingleBarWeight(dto.diameter, length);

    let quantity = Number(dto.quantity) || 0;
    let weightInKgs = Number(dto.weightInKgs) || 0;

    // ponytail: automatic conversion logic between bars quantity and weight
    if (weightInKgs > 0 && quantity === 0) {
      quantity = Math.round(weightInKgs / singleWeight);
    } else if (quantity > 0 && weightInKgs === 0) {
      weightInKgs = quantity * singleWeight;
    } else if (quantity > 0 && weightInKgs > 0) {
      // Keep both as supplied, or check consistency. Let's trust quantity and compute weight or keep as is.
    }

    const filter = {
      companyId: new Types.ObjectId(companyId),
      diameter: dto.diameter,
      length,
      costPerKg: dto.costPerKg,
      typeOfBar: dto.typeOfBar || '',
      brandName: dto.brandName || '',
      vendorName: dto.vendorName || '',
      isRemnant: false,
    };

    // Upsert so if identical stock specs are purchased again, we just increase quantity
    const update = {
      $inc: {
        quantity,
        weightInKgs,
      },
    };

    const result = await this.stockItemModel.findOneAndUpdate(filter as any, update as any, {
      upsert: true,
      new: true,
    } as any).exec() as any;

    // ponytail: log inward inventory transaction
    const transaction = new this.transactionModel({
      companyId: new Types.ObjectId(companyId),
      type: 'INWARD',
      diameter: dto.diameter,
      length,
      quantity,
      weightInKgs,
      brandName: dto.brandName || '',
      vendorName: dto.vendorName || '',
      typeOfBar: dto.typeOfBar || 'TMT500',
      referenceId: result._id.toString(),
      referenceName: 'Manual Inward Entry',
    });
    await transaction.save();

    return result;
  }

  async getScrapRules(companyId: string): Promise<ScrapRule[]> {
    const cid = new Types.ObjectId(companyId);
    let rules = await this.scrapRuleModel.find({ companyId: cid as any }).exec();
    
    // Default diameters
    const standardDiameters = [8, 10, 12, 16, 20, 25, 32];
    
    if (rules.length < standardDiameters.length) {
      // Seed missing rules
      const existingDiams = new Set(rules.map(r => r.diameter));
      const newRules: any[] = [];
      
      for (const d of standardDiameters) {
        if (!existingDiams.has(d)) {
          newRules.push({
            companyId: cid,
            diameter: d,
            scrapLengthThreshold: 1000, // default 1000 mm (1 meter)
          });
        }
      }
      
      if (newRules.length > 0) {
        await this.scrapRuleModel.insertMany(newRules);
        rules = await this.scrapRuleModel.find({ companyId: cid as any }).exec();
      }
    }
    
    return rules.sort((a, b) => a.diameter - b.diameter);
  }

  async updateScrapRules(companyId: string, rulesList: { diameter: number; scrapLengthThreshold: number }[]) {
    const cid = new Types.ObjectId(companyId);
    const promises = rulesList.map(rule =>
      this.scrapRuleModel.findOneAndUpdate(
        { companyId: cid as any, diameter: rule.diameter as any } as any,
        { scrapLengthThreshold: rule.scrapLengthThreshold } as any,
        { upsert: true, new: true } as any
      ).exec()
    );
    await Promise.all(promises);
    return this.getScrapRules(companyId);
  }

  async getLedger(companyId: string): Promise<InventoryTransaction[]> {
    return this.transactionModel.find({ companyId: new Types.ObjectId(companyId) as any })
      .sort({ createdAt: -1 } as any)
      .exec();
  }
}
