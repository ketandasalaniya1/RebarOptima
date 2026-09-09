import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project } from './schemas/project.schema';
import { BlockWing } from './schemas/block-wing.schema';
import { LevelFloor } from './schemas/level-floor.schema';
import { ShapeRegister } from './schemas/shape-register.schema';
import { ElementTemplate } from './schemas/element-template.schema';
import { StructuralMember } from './schemas/structural-member.schema';
import { RebarItem } from './schemas/rebar-item.schema';
import { BbsCalculationService } from './bbs-calculation.service';

@Injectable()
export class BbsService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(BlockWing.name) private blockModel: Model<BlockWing>,
    @InjectModel(LevelFloor.name) private levelModel: Model<LevelFloor>,
    @InjectModel(ShapeRegister.name) private shapeModel: Model<ShapeRegister>,
    @InjectModel(ElementTemplate.name) private templateModel: Model<ElementTemplate>,
    @InjectModel(StructuralMember.name) private memberModel: Model<StructuralMember>,
    @InjectModel(RebarItem.name) private rebarModel: Model<RebarItem>,
    private readonly calcService: BbsCalculationService,
  ) {}

  // ─────────────────────────────────────────────────────
  //  PROJECT CRUD
  // ─────────────────────────────────────────────────────

  async createProject(companyId: string, dto: { name: string; defaultConcreteGrade?: string; defaultSteelGrade?: string; defaultClearCovers?: Record<string, number> }) {
    return this.projectModel.create({ ...dto, companyId: new Types.ObjectId(companyId) });
  }

  async getProjects(companyId: string) {
    return this.projectModel.find({ companyId: new Types.ObjectId(companyId) }).sort({ created_at: -1 });
  }

  async getProject(companyId: string, projectId: string) {
    const project = await this.projectModel.findOne({ _id: projectId, companyId: new Types.ObjectId(companyId) });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async updateProject(companyId: string, projectId: string, dto: Partial<{ name: string; defaultConcreteGrades: Record<string, string>; defaultSteelGrade: string; defaultClearCovers: Record<string, number> }>) {
    const project = await this.projectModel.findOneAndUpdate(
      { _id: projectId, companyId: new Types.ObjectId(companyId) },
      { $set: dto },
      { new: true },
    );
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async deleteProject(companyId: string, projectId: string) {
    const project = await this.projectModel.findOneAndDelete({ _id: projectId, companyId: new Types.ObjectId(companyId) });
    if (!project) throw new NotFoundException('Project not found');
    // Cascade delete all children
    const memberIds = (await this.memberModel.find({ project_id: projectId }).select('_id')).map(m => m._id);
    await this.rebarModel.deleteMany({ member_id: { $in: memberIds } });
    await this.memberModel.deleteMany({ project_id: projectId });
    await this.blockModel.deleteMany({ project_id: projectId });
    await this.levelModel.deleteMany({ project_id: projectId });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────
  //  BLOCK / LEVEL CRUD
  // ─────────────────────────────────────────────────────

  async createBlock(projectId: string, name: string) {
    return this.blockModel.create({ project_id: new Types.ObjectId(projectId), name });
  }

  async getBlocks(projectId: string) {
    console.log('getBlocks called with:', projectId);
    const result = await this.blockModel.find({ project_id: new Types.ObjectId(projectId) });
    console.log('getBlocks result length:', result.length);
    return result;
  }

  async updateBlock(blockId: string, name: string) {
    const block = await this.blockModel.findByIdAndUpdate(blockId, { name }, { new: true });
    if (!block) throw new NotFoundException('Block not found');
    return block;
  }

  async deleteBlock(blockId: string) {
    const block = await this.blockModel.findByIdAndDelete(blockId);
    if (!block) throw new NotFoundException('Block not found');
    return { deleted: true };
  }

  async createLevel(projectId: string, blockId: string, name: string) {
    const existingLevels = await this.levelModel.find({ block_id: new Types.ObjectId(blockId) });
    const nextOrder = existingLevels.length > 0 ? Math.max(...existingLevels.map(l => l.order || 0)) + 1 : 0;

    return this.levelModel.create({ 
      project_id: new Types.ObjectId(projectId), 
      block_id: new Types.ObjectId(blockId),
      name,
      order: nextOrder
    });
  }

  async getLevels(projectId: string) {
    return this.levelModel.find({ project_id: new Types.ObjectId(projectId) }).sort({ order: 1 });
  }

  async updateLevel(levelId: string, name: string) {
    const level = await this.levelModel.findByIdAndUpdate(levelId, { name }, { new: true });
    if (!level) throw new NotFoundException('Level not found');
    return level;
  }

  async deleteLevel(levelId: string) {
    const level = await this.levelModel.findByIdAndDelete(levelId);
    if (!level) throw new NotFoundException('Level not found');
    return { deleted: true };
  }

  async reorderLevels(blockId: string, orderedLevelIds: string[]) {
    const bulkOps = orderedLevelIds.map((id, index) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id), block_id: new Types.ObjectId(blockId) },
        update: { $set: { order: index } }
      }
    }));
    
    if (bulkOps.length > 0) {
      await this.levelModel.bulkWrite(bulkOps);
    }
    return { success: true };
  }

  // ─────────────────────────────────────────────────────
  //  STRUCTURAL MEMBER CRUD
  // ─────────────────────────────────────────────────────

  async createMember(dto: {
    member_id: string;
    project_id: string;
    block_id: string;
    level_id: string;
    template_id: string;
    concrete_grade: string;
    steel_grade: string;
    clear_cover: number;
    dimensions: { length: number; width: number; depth: number };
  }) {
    // Auto-calculate concrete volume from dimensions
    const concreteVolume = this.calcService.calculateConcreteVolume(
      dto.dimensions.length,
      dto.dimensions.width,
      dto.dimensions.depth,
    );

    return this.memberModel.create({
      ...dto,
      project_id: new Types.ObjectId(dto.project_id),
      block_id: new Types.ObjectId(dto.block_id),
      level_id: new Types.ObjectId(dto.level_id),
      template_id: new Types.ObjectId(dto.template_id),
      concrete_volume: concreteVolume,
      status: 'Remaining',
    });
  }

  async getMember(memberId: string) {
    const member = await this.memberModel.findById(memberId);
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async getMembers(projectId: string) {
    return this.memberModel.find({ project_id: new Types.ObjectId(projectId) });
  }

  async getMembersByCell(projectId: string, blockId: string, levelId: string) {
    return this.memberModel.find({ project_id: new Types.ObjectId(projectId), block_id: new Types.ObjectId(blockId), level_id: new Types.ObjectId(levelId) });
  }

  async updateMember(memberId: string, dto: Partial<{
    member_id: string;
    concrete_grade: string;
    steel_grade: string;
    clear_cover: number;
    dimensions: { length: number; width: number; depth: number };
  }>) {
    const updateData: any = { ...dto };
    if (dto.dimensions) {
      updateData.concrete_volume = this.calcService.calculateConcreteVolume(
        dto.dimensions.length,
        dto.dimensions.width,
        dto.dimensions.depth,
      );
    }
    const member = await this.memberModel.findByIdAndUpdate(memberId, { $set: updateData }, { new: true });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async deleteMember(memberId: string) {
    const member = await this.memberModel.findByIdAndDelete(memberId);
    if (!member) throw new NotFoundException('Member not found');
    await this.rebarModel.deleteMany({ member_id: memberId });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────
  //  REBAR ITEM CRUD (with auto-calculation)
  // ─────────────────────────────────────────────────────

  async addRebarItem(dto: {
    member_id: string;
    shape_id: string;
    description: string;
    diameter: number;
    spacing?: number;
    bar_count: number;
    part_dimensions: Record<string, any>;
    cut_length: number; // Can be calculated on frontend or overridden
  }) {
    const { totalLength, totalWeight } = this.calcService.calculateRebarWeight(
      dto.cut_length,
      dto.bar_count,
      dto.diameter,
    );

    const rebar = await this.rebarModel.create({
      ...dto,
      member_id: new Types.ObjectId(dto.member_id),
      shape_id: new Types.ObjectId(dto.shape_id),
      total_length: totalLength,
      total_weight: totalWeight,
    });

    // Update parent member's total_steel_weight
    await this.recalculateMemberWeight(dto.member_id);

    return rebar;
  }

  async getRebarItems(memberId: string) {
    return this.rebarModel.find({ member_id: memberId });
  }

  async updateRebarItem(rebarId: string, dto: Partial<{
    description: string;
    diameter: number;
    spacing: number;
    bar_count: number;
    part_dimensions: Record<string, any>;
    cut_length: number;
    shape_id: string;
  }>) {
    const existing = await this.rebarModel.findById(rebarId);
    if (!existing) throw new NotFoundException('Rebar item not found');

    const diameter = dto.diameter ?? existing.diameter;
    const cutLength = dto.cut_length ?? existing.cut_length;
    const barCount = dto.bar_count ?? existing.bar_count;

    const { totalLength, totalWeight } = this.calcService.calculateRebarWeight(cutLength, barCount, diameter);

    const updatePayload: any = {
      ...dto,
      total_length: totalLength,
      total_weight: totalWeight,
    };
    if (dto.shape_id) {
      updatePayload.shape_id = new Types.ObjectId(dto.shape_id);
    }

    const rebar = await this.rebarModel.findByIdAndUpdate(rebarId, { $set: updatePayload }, { new: true });

    // Update parent member's total_steel_weight
    if (rebar) {
      await this.recalculateMemberWeight(rebar.member_id.toString());
    }

    return rebar;
  }

  async deleteRebarItem(rebarId: string) {
    const rebar = await this.rebarModel.findByIdAndDelete(rebarId);
    if (!rebar) throw new NotFoundException('Rebar item not found');
    await this.recalculateMemberWeight(rebar.member_id.toString());
    return { deleted: true };
  }

  /**
   * Recalculate a member's total_steel_weight from all its RebarItems.
   * Also updates status to 'Calculated' if there are rebar items.
   */
  private async recalculateMemberWeight(memberId: string) {
    const rebars = await this.rebarModel.find({ member_id: memberId });
    const totalWeight = rebars.reduce((sum, r) => sum + (r.total_weight || 0), 0);
    const status = rebars.length > 0 ? 'Calculated' : 'Remaining';
    await this.memberModel.findByIdAndUpdate(memberId, { total_steel_weight: totalWeight, status });
  }

  // ─────────────────────────────────────────────────────
  //  DASHBOARD MATRIX
  // ─────────────────────────────────────────────────────

  async getDashboardMatrix(companyId: string, projectId: string) {
    // Verify project belongs to company
    const project = await this.projectModel.findOne({ _id: projectId, companyId: new Types.ObjectId(companyId) });
    if (!project) throw new NotFoundException('Project not found');

    const blocks = await this.blockModel.find({ project_id: new Types.ObjectId(projectId) });
    const levels = await this.levelModel.find({ project_id: new Types.ObjectId(projectId) });
    const members = await this.memberModel.find({ project_id: new Types.ObjectId(projectId) });

    // KPI aggregations
    const totalSteelWeight = members.reduce((sum, m) => sum + (m.total_steel_weight || 0), 0);
    const totalConcreteVolume = members.reduce((sum, m) => sum + (m.concrete_volume || 0), 0);
    const totalMembers = members.length;
    const calculatedMembers = members.filter(m => m.status === 'Calculated').length;

    return {
      project,
      blocks,
      levels,
      members,
      kpis: {
        totalSteelWeight: Math.round(totalSteelWeight * 100) / 100,       // kg
        totalSteelWeightMT: Math.round((totalSteelWeight / 1000) * 100) / 100, // MT
        totalConcreteVolume: Math.round(totalConcreteVolume * 100) / 100,  // m³
        totalMembers,
        calculatedMembers,
        remainingMembers: totalMembers - calculatedMembers,
        progressPercent: totalMembers > 0 ? Math.round((calculatedMembers / totalMembers) * 100) : 0,
      },
    };
  }

  // ─────────────────────────────────────────────────────
  //  MATERIAL TAKE-OFF (MTO) & OPTIMIZER DATA
  // ─────────────────────────────────────────────────────

  async getProjectRebars(projectId: string) {
    const members = await this.memberModel.find({ project_id: new Types.ObjectId(projectId) }).select('_id');
    const memberIds = members.map(m => m._id);
    return this.rebarModel.find({ member_id: { $in: memberIds } });
  }

  async getMaterialTakeOff(projectId: string) {
    const members = await this.memberModel.find({ project_id: new Types.ObjectId(projectId) }).select('_id');
    const memberIds = members.map(m => m._id);
    const rebars = await this.rebarModel.find({ member_id: { $in: memberIds } });

    // Group by diameter
    const mtoMap: Record<number, { diameter: number; totalLength: number; totalWeight: number; barCount: number }> = {};

    for (const rebar of rebars) {
      if (!mtoMap[rebar.diameter]) {
        mtoMap[rebar.diameter] = { diameter: rebar.diameter, totalLength: 0, totalWeight: 0, barCount: 0 };
      }
      mtoMap[rebar.diameter].totalLength += rebar.total_length || 0;
      mtoMap[rebar.diameter].totalWeight += rebar.total_weight || 0;
      mtoMap[rebar.diameter].barCount += rebar.bar_count || 0;
    }

    const mto = Object.values(mtoMap).sort((a, b) => a.diameter - b.diameter);
    const grandTotal = mto.reduce((sum, item) => sum + item.totalWeight, 0);

    return { mto, grandTotalKg: Math.round(grandTotal * 100) / 100, grandTotalMT: Math.round((grandTotal / 1000) * 100) / 100 };
  }

  // ─────────────────────────────────────────────────────
  //  SHAPE REGISTER & ELEMENT TEMPLATE CRUD
  // ─────────────────────────────────────────────────────

  async getShapes() {
    return this.shapeModel.find();
  }

  async createShape(dto: { shape_code: string; is_custom: boolean; bend_count: number; bend_45_count: number; hook_count: number; bend_180_count: number; deduction_logic: Record<string, any> }) {
    return this.shapeModel.create(dto);
  }

  async getTemplates() {
    return this.templateModel.find();
  }

  async createTemplate(dto: { category: string; is_custom: boolean; input_schema: Record<string, any> }) {
    return this.templateModel.create(dto);
  }
}
