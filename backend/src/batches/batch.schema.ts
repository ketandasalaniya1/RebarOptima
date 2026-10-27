import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class Batch extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  companyId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Project', required: false })
  projectId?: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  batchName: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  inputStock: any[];

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  requiredParts: any[];

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  layouts: any[];

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  summary: {
    totalPartsLength: number;
    totalUsedStockLength: number;
    totalCutsCount: number;
    totalRemnant: number; // in mm
    avgUtilization: number;
    totalScrapKg: number; // calculated on commit
    totalRemnantKg: number; // calculated on commit
  };

  createdAt?: Date;
}

export const BatchSchema = SchemaFactory.createForClass(Batch);
BatchSchema.index({ companyId: 1, createdAt: -1 });
BatchSchema.index({ companyId: 1, projectId: 1, createdAt: -1 });

