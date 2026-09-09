import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class StructuralMember extends Document {
  @Prop({ required: true })
  member_id: string; // User-facing tracking ID e.g. "Col-C1"

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BlockWing', required: true })
  block_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'LevelFloor', required: true })
  level_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ElementTemplate', required: true })
  template_id: Types.ObjectId;

  @Prop({ required: true })
  concrete_grade: string; // e.g. "M25" — drives Ld logic

  @Prop({ required: true })
  steel_grade: string; // e.g. "Fe500"

  @Prop({ required: true })
  clear_cover: number; // Default applied by template, overridable

  // Gross dimensions for Concrete Volume Automation (L × W × D)
  @Prop({
    type: Object,
    default: { length: 0, width: 0, depth: 0 },
  })
  dimensions: {
    length: number; // mm
    width: number;  // mm
    depth: number;  // mm
  };

  @Prop({ required: true, enum: ['Calculated', 'Remaining'], default: 'Remaining' })
  status: string;

  @Prop({ default: 0 })
  concrete_volume: number; // Auto-calculated (m³)

  @Prop({ default: 0 })
  total_steel_weight: number; // Sum of all child RebarItem weights
}

export const StructuralMemberSchema = SchemaFactory.createForClass(StructuralMember);
StructuralMemberSchema.index({ project_id: 1, block_id: 1, level_id: 1 });
