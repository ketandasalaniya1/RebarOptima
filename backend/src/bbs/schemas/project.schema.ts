import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Project extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  // Global Project Defaults (Project Configurator)
  @Prop({
    type: Object,
    default: {
      footing: 'M25',
      column: 'M25',
      beam: 'M25',
      slab: 'M25',
    },
  })
  defaultConcreteGrades: Record<string, string>;

  @Prop({ default: 'Fe500' })
  defaultSteelGrade: string;

  @Prop({
    type: Object,
    default: {
      footing: 50,
      column: 40,
      beam: 25,
      slab: 20,
    },
  })
  defaultClearCovers: {
    footing: number;
    column: number;
    beam: number;
    slab: number;
  };
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ companyId: 1, created_at: -1 });
