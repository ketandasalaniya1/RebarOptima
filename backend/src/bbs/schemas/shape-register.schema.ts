import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ShapeRegister extends Document {
  @Prop({ required: true })
  shape_code: string;

  @Prop({ default: false })
  is_custom: boolean;

  @Prop({ default: 0 })
  bend_count: number;

  @Prop({ default: 0 })
  bend_45_count: number;

  @Prop({ default: 0 })
  hook_count: number;

  @Prop({ default: 0 })
  bend_180_count: number;

  @Prop({ type: Object, default: {} })
  deduction_logic: Record<string, any>;
}

export const ShapeRegisterSchema = SchemaFactory.createForClass(ShapeRegister);
