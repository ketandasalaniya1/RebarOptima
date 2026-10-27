import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument, GeofenceArea } from './project.schema';

function toSafeObjectId(id: any): any {
  if (!id) return null;
  if (id instanceof Types.ObjectId) return id;
  const str = String(id).trim();
  if (Types.ObjectId.isValid(str) && str.length === 24) {
    try {
      return new Types.ObjectId(str);
    } catch {
      return str;
    }
  }
  return str;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  private validateCoordinates(lat: number, lng: number): void {
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException('Latitude must be a valid number between -90 and 90');
    }
    if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException('Longitude must be a valid number between -180 and 180');
    }
  }

  private validatePincode(pincode: string): void {
    if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode.trim())) {
      throw new BadRequestException('Project Address Pincode must be a valid Indian 6-digit PIN code');
    }
  }

  private validateGeofences(geofences: GeofenceArea[]): void {
    if (!Array.isArray(geofences)) {
      throw new BadRequestException('Geofences must be an array');
    }

    for (const gf of geofences) {
      if (!gf.name || typeof gf.name !== 'string' || !gf.name.trim()) {
        throw new BadRequestException('Geofence name is required');
      }
      if (!['circle', 'polygon'].includes(gf.boundaryType)) {
        throw new BadRequestException('Geofence boundary type must be "circle" or "polygon"');
      }

      if (gf.boundaryType === 'circle') {
        if (!gf.center || typeof gf.center.latitude !== 'number' || typeof gf.center.longitude !== 'number') {
          throw new BadRequestException('Circular geofence requires valid center latitude and longitude');
        }
        this.validateCoordinates(gf.center.latitude, gf.center.longitude);
        if (typeof gf.radius !== 'number' || gf.radius <= 0 || gf.radius > 50000) {
          throw new BadRequestException('Circular geofence radius must be a positive number up to 50,000 meters');
        }
      } else if (gf.boundaryType === 'polygon') {
        if (!Array.isArray(gf.coordinates) || gf.coordinates.length < 3) {
          throw new BadRequestException('Polygon geofence requires at least 3 coordinate points');
        }
        for (const pt of gf.coordinates) {
          if (!Array.isArray(pt) || pt.length < 2) {
            throw new BadRequestException('Polygon point must be [longitude, latitude]');
          }
          const [lng, lat] = pt;
          this.validateCoordinates(lat, lng);
        }
      }
    }
  }

  async create(companyId: string, dto: any, user: any): Promise<Project> {
    const roleUpper = (user.role || '').toUpperCase();
    if (roleUpper === 'PROJECT_PARTNER_ADMIN') {
      throw new ForbiddenException('Project Partner Admins cannot create new company projects');
    }

    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Project Name is required');
    }
    if (!dto.address || !dto.address.trim()) {
      throw new BadRequestException('Project Address is required');
    }
    this.validatePincode(dto.pincode);

    if (!dto.location || typeof dto.location.latitude !== 'number' || typeof dto.location.longitude !== 'number') {
      throw new BadRequestException('Project Location with valid latitude and longitude is required');
    }
    this.validateCoordinates(dto.location.latitude, dto.location.longitude);

    const validTypes = ['Residential', 'Mixed-use', 'Commercial', 'Villa', 'Other'];
    if (!dto.projectType || !validTypes.includes(dto.projectType)) {
      throw new BadRequestException(`Project Type must be one of: ${validTypes.join(', ')}`);
    }

    if (dto.geofences && dto.geofences.length > 0) {
      this.validateGeofences(dto.geofences);
    }

    const newProject = new this.projectModel({
      companyId: toSafeObjectId(companyId),
      name: dto.name.trim(),
      address: dto.address.trim(),
      pincode: dto.pincode.trim(),
      location: {
        latitude: dto.location.latitude,
        longitude: dto.location.longitude,
      },
      projectType: dto.projectType,
      status: dto.status || 'active',
      geofences: (dto.geofences || []).map((g: any, index: number) => ({
        ...g,
        id: g.id || `gf_${Date.now()}_${index}`,
        isActive: g.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      assignedPartnerAdminIds: (dto.assignedPartnerAdminIds || []).map((id: string) => toSafeObjectId(id)),
      createdBy: user._id || user.sub ? toSafeObjectId(user._id || user.sub) : undefined,
    });

    return newProject.save();
  }

  async findAll(companyId: string, user: any, statusFilter?: string): Promise<Project[]> {
    const roleUpper = (user.role || '').toUpperCase();
    const query: any = { companyId: toSafeObjectId(companyId) };

    if (statusFilter && ['active', 'inactive'].includes(statusFilter)) {
      query.status = statusFilter;
    }

    if (roleUpper === 'PROJECT_PARTNER_ADMIN') {
      const assigned = user.assignedProjects || [];
      const assignedObjectIds = assigned.map((id: any) => toSafeObjectId(id));
      query._id = { $in: assignedObjectIds };
      query.status = 'active'; // Partner Admins only see active assigned projects
    }

    return this.projectModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, companyId: string, user: any): Promise<Project> {
    const project = await this.projectModel.findOne({
      _id: id,
      companyId: companyId,
    } as any).exec();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const roleUpper = (user.role || '').toUpperCase();
    if (roleUpper === 'PROJECT_PARTNER_ADMIN') {
      const assigned = (user.assignedProjects || []).map((p: any) => p.toString());
      if (!assigned.includes(id.toString())) {
        throw new ForbiddenException('Access denied: You are not assigned to this project');
      }
    }

    return project;
  }

  async update(id: string, companyId: string, dto: any, user: any): Promise<Project> {
    const project = await this.findOne(id, companyId, user);

    if (dto.name !== undefined) {
      if (!dto.name || !dto.name.trim()) throw new BadRequestException('Project Name is required');
      project.name = dto.name.trim();
    }
    if (dto.address !== undefined) {
      if (!dto.address || !dto.address.trim()) throw new BadRequestException('Project Address is required');
      project.address = dto.address.trim();
    }
    if (dto.pincode !== undefined) {
      this.validatePincode(dto.pincode);
      project.pincode = dto.pincode.trim();
    }
    if (dto.location !== undefined) {
      if (!dto.location || typeof dto.location.latitude !== 'number' || typeof dto.location.longitude !== 'number') {
        throw new BadRequestException('Valid location coordinates required');
      }
      this.validateCoordinates(dto.location.latitude, dto.location.longitude);
      project.location = {
        latitude: dto.location.latitude,
        longitude: dto.location.longitude,
      };
    }
    if (dto.projectType !== undefined) {
      const validTypes = ['Residential', 'Mixed-use', 'Commercial', 'Villa', 'Other'];
      if (!validTypes.includes(dto.projectType)) {
        throw new BadRequestException(`Project Type must be one of: ${validTypes.join(', ')}`);
      }
      project.projectType = dto.projectType;
    }
    if (dto.status !== undefined) {
      if (!['active', 'inactive'].includes(dto.status)) {
        throw new BadRequestException('Status must be "active" or "inactive"');
      }
      project.status = dto.status;
    }

    project.updatedBy = user._id || user.sub ? toSafeObjectId(user._id || user.sub) : undefined;
    return project.save();
  }

  async updateGeofences(id: string, companyId: string, geofences: GeofenceArea[], user: any): Promise<Project> {
    const project = await this.findOne(id, companyId, user);
    this.validateGeofences(geofences);

    project.geofences = geofences.map((g, idx) => ({
      ...g,
      id: g.id || `gf_${Date.now()}_${idx}`,
      isActive: g.isActive !== false,
      createdAt: g.createdAt ? new Date(g.createdAt) : new Date(),
      updatedAt: new Date(),
    }));

    project.updatedBy = user._id || user.sub ? toSafeObjectId(user._id || user.sub) : undefined;
    return project.save();
  }

  async updateStatus(id: string, companyId: string, status: string, user: any): Promise<Project> {
    if (!['active', 'inactive'].includes(status)) {
      throw new BadRequestException('Status must be "active" or "inactive"');
    }
    const project = await this.findOne(id, companyId, user);
    project.status = status;
    project.updatedBy = user._id || user.sub ? toSafeObjectId(user._id || user.sub) : undefined;
    return project.save();
  }

  async assignPartnerAdmins(id: string, companyId: string, partnerAdminIds: string[], user: any): Promise<Project> {
    const roleUpper = (user.role || '').toUpperCase();
    if (roleUpper !== 'ADMIN' && roleUpper !== 'OWNER' && user.accountType !== 'developer') {
      throw new ForbiddenException('Only Company Admins or Owners can assign Project Partner Admins');
    }

    const project = await this.projectModel.findOne({
      _id: id,
      companyId: companyId,
    } as any).exec();

    if (!project) throw new NotFoundException('Project not found');

    project.assignedPartnerAdminIds = (partnerAdminIds || []).map(pid => toSafeObjectId(pid));
    project.updatedBy = user._id || user.sub ? toSafeObjectId(user._id || user.sub) : undefined;
    return project.save();
  }
}
