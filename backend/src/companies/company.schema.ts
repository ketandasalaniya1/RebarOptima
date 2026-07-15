import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Company extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  projectName?: string;

  @Prop({ required: false })
  location?: string;

  @Prop()
  deletedAt?: Date;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
