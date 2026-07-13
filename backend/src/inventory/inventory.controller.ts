import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import { InventoryService } from './inventory.service';
import { User } from '../users/user.schema';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventory(@CurrentUser() user: User) {
    return this.inventoryService.getInventory(user.companyId.toString());
  }

  @Post('inward')
  async inwardEntry(
    @CurrentUser() user: User,
    @Body() dto: {
      diameter: number;
      length?: number;
      quantity?: number;
      weightInKgs?: number;
      costPerKg: number;
      typeOfBar?: string;
      brandName?: string;
      vendorName?: string;
    },
  ) {
    return this.inventoryService.inwardEntry(user.companyId.toString(), dto);
  }

  @Get('scrap-rules')
  async getScrapRules(@CurrentUser() user: User) {
    return this.inventoryService.getScrapRules(user.companyId.toString());
  }

  @Post('scrap-rules')
  async updateScrapRules(
    @CurrentUser() user: User,
    @Body() dto: { rules: { diameter: number; scrapLengthThreshold: number }[] },
  ) {
    return this.inventoryService.updateScrapRules(user.companyId.toString(), dto.rules);
  }

  @Get('ledger')
  async getLedger(@CurrentUser() user: User) {
    return this.inventoryService.getLedger(user.companyId.toString());
  }
}
