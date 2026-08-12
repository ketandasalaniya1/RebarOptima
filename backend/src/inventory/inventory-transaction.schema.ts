import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class InventoryTransaction extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  companyId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['INWARD', 'OUTWARD', 'REMNANT', 'SCRAP'] })
  type: string; // 'INWARD' (purchased rebar), 'OUTWARD' (consumed in optimization), 'REMNANT' (reusable remnant saved), 'SCRAP' (scrap generated in batch)

  @Prop({ required: true })
  diameter: number; // in mm

  @Prop({ required: true })
  length: number; // in mm

  @Prop({ required: true, default: 0 })
  quantity: number; // quantity of bars

  @Prop({ required: true, default: 0 })
  weightInKgs: number; // total weight of the bars

  @Prop({ default: '' })
  brandName?: string;

  @Prop({ default: '' })
  vendorName?: string;

  @Prop({ default: '' })
  typeOfBar?: string;

  @Prop()
  referenceId?: string; // e.g. Batch ID or StockItem ID

  @Prop({ default: '' })
  referenceName?: string; // e.g. Batch name or Manual Inward description
}

export const InventoryTransactionSchema = SchemaFactory.createForClass(InventoryTransaction);
InventoryTransactionSchema.index({ companyId: 1, createdAt: -1 });
