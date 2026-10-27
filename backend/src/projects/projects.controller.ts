import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(@Req() req: any, @Query('status') status?: string) {
    const companyId = req.user.companyId;
    return this.projectsService.findAll(companyId, req.user, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const companyId = req.user.companyId;
    return this.projectsService.findOne(id, companyId, req.user);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: any) {
    const companyId = req.user.companyId;
    return this.projectsService.create(companyId, dto, req.user);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: any) {
    const companyId = req.user.companyId;
    return this.projectsService.update(id, companyId, dto, req.user);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Req() req: any, @Body('status') status: string) {
    const companyId = req.user.companyId;
    return this.projectsService.updateStatus(id, companyId, status, req.user);
  }

  @Put(':id/geofences')
  async updateGeofences(@Param('id') id: string, @Req() req: any, @Body('geofences') geofences: any[]) {
    const companyId = req.user.companyId;
    return this.projectsService.updateGeofences(id, companyId, geofences, req.user);
  }

  @Post(':id/assign-partner')
  async assignPartnerAdmins(
    @Param('id') id: string,
    @Req() req: any,
    @Body('partnerAdminIds') partnerAdminIds: string[],
  ) {
    const companyId = req.user.companyId;
    return this.projectsService.assignPartnerAdmins(id, companyId, partnerAdminIds, req.user);
  }
}
