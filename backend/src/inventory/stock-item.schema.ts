import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class StockItem extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  companyId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: false })
  projectId?: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  diameter: number; // e.g., 8, 10, 12, 16, 20, 25, 32

  @Prop({ required: true, default: 12000 })
  length: number; // in mm

  @Prop({ required: true, default: 0 })
  quantity: number;

  @Prop({ default: 0 })
  costPerKg: number; // in Rs

  @Prop()
  typeOfBar?: string; // e.g., TMT500

  @Prop()
  brandName?: string; // e.g., VikrantTMT

  @Prop()
  vendorName?: string; // e.g., KalyanTraders

  @Prop({ required: true, default: false })
  isRemnant: boolean; // true if it's a reusable remnant from optimization

  @Prop({ default: 0 })
  weightInKgs: number; // total weight of these bars in kg
}

export const StockItemSchema = SchemaFactory.createForClass(StockItem);
// Create compound index for querying and deduplication
StockItemSchema.index({ companyId: 1, diameter: 1, length: 1, costPerKg: 1, typeOfBar: 1, brandName: 1, vendorName: 1, isRemnant: 1 }, { unique: true });
