import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ElementTemplate extends Document {
  @Prop({ required: true })
  category: string; // Pile, Retaining Wall, Custom, etc.

  @Prop({ default: false })
  is_custom: boolean;

  @Prop({ type: Object, default: {} })
  input_schema: Record<string, any>;
}

export const ElementTemplateSchema = SchemaFactory.createForClass(ElementTemplate);
