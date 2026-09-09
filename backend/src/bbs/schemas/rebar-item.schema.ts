import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RebarItem extends Document {
  @Prop({ type: Types.ObjectId, ref: 'StructuralMember', required: true })
  member_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ShapeRegister', required: true })
  shape_id: Types.ObjectId;

  @Prop({ required: true })
  description: string; // e.g. "Main Bar", "Stirrup", "Top Support Bar"

  @Prop({ required: true })
  diameter: number; // Bar diameter (8, 10, 12, 16, 20, 25, 32, 40 mm)

  @Prop({ default: 0 })
  spacing: number; // Center-to-center spacing (mm), if applicable

  @Prop({ default: 1 })
  bar_count: number; // Exact quantity of this specific bar piece

  @Prop({ type: Object, default: {} })
  part_dimensions: Record<string, any>; // Shape leg values: A, B, C, D

  @Prop({ default: 0 })
  cut_length: number; // Final calculated length per piece (mm)

  @Prop({ default: 0 })
  total_length: number; // cut_length × bar_count (mm)

  @Prop({ default: 0 })
  total_weight: number; // total_length × (D²/162.27) in kg
}

export const RebarItemSchema = SchemaFactory.createForClass(RebarItem);
RebarItemSchema.index({ member_id: 1 });
