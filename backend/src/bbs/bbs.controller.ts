import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { User } from '../users/user.schema';
import { BbsService } from './bbs.service';

@Controller('bbs')
@UseGuards(JwtAuthGuard)
export class BbsController {
  constructor(private readonly bbsService: BbsService) {}

  // ─────────────────────────────────────────────────────
  //  PROJECT
  // ─────────────────────────────────────────────────────

  @Post('projects')
  async createProject(
    @CurrentUser() user: User,
    @Body() dto: { name: string; defaultConcreteGrade?: string; defaultSteelGrade?: string; defaultClearCovers?: Record<string, number> },
  ) {
    return this.bbsService.createProject(user.companyId.toString(), dto);
  }

  @Get('projects')
  async getProjects(@CurrentUser() user: User) {
    return this.bbsService.getProjects(user.companyId.toString());
  }

  @Get('projects/:projectId')
  async getProject(@CurrentUser() user: User, @Param('projectId') projectId: string) {
    return this.bbsService.getProject(user.companyId.toString(), projectId);
  }

  @Put('projects/:projectId')
  async updateProject(
    @CurrentUser() user: User,
    @Param('projectId') projectId: string,
    @Body() dto: { name?: string; defaultConcreteGrade?: string; defaultSteelGrade?: string; defaultClearCovers?: Record<string, number> },
  ) {
    return this.bbsService.updateProject(user.companyId.toString(), projectId, dto);
  }

  @Delete('projects/:projectId')
  async deleteProject(@CurrentUser() user: User, @Param('projectId') projectId: string) {
    return this.bbsService.deleteProject(user.companyId.toString(), projectId);
  }

  // ─────────────────────────────────────────────────────
  //  BLOCKS & LEVELS
  // ─────────────────────────────────────────────────────

  @Post('projects/:projectId/blocks')
  async createBlock(@Param('projectId') projectId: string, @Body() dto: { name: string }) {
    return this.bbsService.createBlock(projectId, dto.name);
  }

  @Get('projects/:projectId/blocks')
  async getBlocks(@Param('projectId') projectId: string) {
    return this.bbsService.getBlocks(projectId);
  }

  @Put('blocks/:blockId')
  async updateBlock(@Param('blockId') blockId: string, @Body() dto: { name: string }) {
    return this.bbsService.updateBlock(blockId, dto.name);
  }

  @Delete('blocks/:blockId')
  async deleteBlock(@Param('blockId') blockId: string) {
    return this.bbsService.deleteBlock(blockId);
  }

  @Post('projects/:projectId/blocks/:blockId/levels')
  async createLevel(
    @Param('projectId') projectId: string, 
    @Param('blockId') blockId: string, 
    @Body() dto: { name: string }
  ) {
    return this.bbsService.createLevel(projectId, blockId, dto.name);
  }

  @Get('projects/:projectId/levels')
  async getLevels(@Param('projectId') projectId: string) {
    return this.bbsService.getLevels(projectId);
  }

  @Put('levels/:levelId')
  async updateLevel(@Param('levelId') levelId: string, @Body() dto: { name: string }) {
    return this.bbsService.updateLevel(levelId, dto.name);
  }

  @Delete('levels/:levelId')
  async deleteLevel(@Param('levelId') levelId: string) {
    return this.bbsService.deleteLevel(levelId);
  }

  // ─────────────────────────────────────────────────────
  //  STRUCTURAL MEMBERS
  // ─────────────────────────────────────────────────────

  @Post('members')
  async createMember(@Body() dto: {
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
    return this.bbsService.createMember(dto);
  }

  @Get('projects/:projectId/members')
  async getMembers(@Param('projectId') projectId: string) {
    return this.bbsService.getMembers(projectId);
  }

  @Get('projects/:projectId/members/cell')
  async getMembersByCell(
    @Param('projectId') projectId: string,
    @Query('blockId') blockId: string,
    @Query('levelId') levelId: string,
  ) {
    return this.bbsService.getMembersByCell(projectId, blockId, levelId);
  }

  @Get('members/:memberId')
  async getMember(@Param('memberId') memberId: string) {
    return this.bbsService.getMember(memberId);
  }

  @Put('members/:memberId')
  async updateMember(@Param('memberId') memberId: string, @Body() dto: any) {
    return this.bbsService.updateMember(memberId, dto);
  }

  @Delete('members/:memberId')
  async deleteMember(@Param('memberId') memberId: string) {
    return this.bbsService.deleteMember(memberId);
  }

  // ─────────────────────────────────────────────────────
  //  REBAR ITEMS
  // ─────────────────────────────────────────────────────

  @Post('rebars')
  async addRebarItem(@Body() dto: {
    member_id: string;
    shape_id: string;
    description: string;
    diameter: number;
    spacing?: number;
    bar_count: number;
    part_dimensions: Record<string, any>;
    cut_length: number;
  }) {
    return this.bbsService.addRebarItem(dto);
  }

  @Get('members/:memberId/rebars')
  async getRebarItems(@Param('memberId') memberId: string) {
    return this.bbsService.getRebarItems(memberId);
  }

  @Put('rebars/:rebarId')
  async updateRebarItem(@Param('rebarId') rebarId: string, @Body() dto: any) {
    return this.bbsService.updateRebarItem(rebarId, dto);
  }

  @Delete('rebars/:rebarId')
  async deleteRebarItem(@Param('rebarId') rebarId: string) {
    return this.bbsService.deleteRebarItem(rebarId);
  }

  // ─────────────────────────────────────────────────────
  //  DASHBOARD & REPORTS
  // ─────────────────────────────────────────────────────

  @Get('projects/:projectId/matrix')
  async getDashboardMatrix(@CurrentUser() user: User, @Param('projectId') projectId: string) {
    return this.bbsService.getDashboardMatrix(user.companyId.toString(), projectId);
  }

  @Get('projects/:projectId/mto')
  async getMTO(@Param('projectId') projectId: string) {
    return this.bbsService.getMaterialTakeOff(projectId);
  }

  // ─────────────────────────────────────────────────────
  //  SHAPE REGISTER & ELEMENT TEMPLATES
  // ─────────────────────────────────────────────────────

  @Get('shapes')
  async getShapes() {
    return this.bbsService.getShapes();
  }

  @Post('shapes')
  async createShape(@Body() dto: { shape_code: string; is_custom: boolean; bend_count: number; bend_45_count: number; hook_count: number; bend_180_count: number; deduction_logic: Record<string, any> }) {
    return this.bbsService.createShape(dto);
  }

  @Get('templates')
  async getTemplates() {
    return this.bbsService.getTemplates();
  }

  @Post('templates')
  async createTemplate(@Body() dto: { category: string; is_custom: boolean; input_schema: Record<string, any> }) {
    return this.bbsService.createTemplate(dto);
  }
}
