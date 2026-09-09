import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class LevelFloor extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'BlockWing', required: true })
  block_id: Types.ObjectId;

  @Prop({ required: true })
  name: string;
}

export const LevelFloorSchema = SchemaFactory.createForClass(LevelFloor);
