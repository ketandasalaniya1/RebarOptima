import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { BatchesService } from './batches.service';
import { User } from '../users/user.schema';

@Controller('batches')
@UseGuards(JwtAuthGuard)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Post()
  async commitBatch(
    @CurrentUser() user: User,
    @Body() dto: {
      batchName: string;
      inputStock: any[];
      requiredParts: any[];
      layouts: any[];
      summary: any;
    },
  ) {
    return this.batchesService.commitBatch(user.companyId.toString(), dto);
  }

  @Get()
  async getBatchHistory(@CurrentUser() user: User) {
    return this.batchesService.getBatchHistory(user.companyId.toString());
  }

  @Get('stats')
  async getDashboardStats(@CurrentUser() user: User) {
    return this.batchesService.getDashboardStats(user.companyId.toString());
  }

  @Get('scrap-records')
  async getBatchScrapRecords(@CurrentUser() user: User) {
    return this.batchesService.getBatchScrapRecords(user.companyId.toString());
  }

  @Put(':id')
  async updateBatch(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { batchName: string },
  ) {
    return this.batchesService.updateBatch(user.companyId.toString(), id, dto.batchName);
  }

  @Delete(':id')
  async deleteBatch(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.batchesService.deleteBatch(user.companyId.toString(), id);
  }
}

