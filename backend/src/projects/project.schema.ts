import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ProjectDocument = Project & Document;

export interface GeofenceArea {
  id: string;
  name: string;
  boundaryType: 'circle' | 'polygon';
  center?: {
    latitude: number;
    longitude: number;
  };
  radius?: number; // In meters for circle
  coordinates?: [number, number][]; // [longitude, latitude] array for polygon
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Project extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  pincode: string; // 6-digit Indian PIN code

  @Prop({
    type: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    required: true,
    _id: false,
  })
  location: {
    latitude: number;
    longitude: number;
  };

  @Prop({
    required: true,
    enum: ['Residential', 'Mixed-use', 'Commercial', 'Villa', 'Other'],
    default: 'Residential',
  })
  projectType: string;

  @Prop({
    required: true,
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: string;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        boundaryType: { type: String, enum: ['circle', 'polygon'], required: true },
        center: {
          latitude: { type: Number },
          longitude: { type: Number },
        },
        radius: { type: Number },
        coordinates: { type: [[Number]] },
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  geofences: GeofenceArea[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  assignedPartnerAdminIds: Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

ProjectSchema.index({ companyId: 1, status: 1 });
ProjectSchema.index({ companyId: 1, name: 1 });
ProjectSchema.index({ companyId: 1, assignedPartnerAdminIds: 1 });
