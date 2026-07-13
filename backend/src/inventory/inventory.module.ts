import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockItem, StockItemSchema } from './stock-item.schema';
import { ScrapRule, ScrapRuleSchema } from './scrap-rule.schema';
import { InventoryTransaction, InventoryTransactionSchema } from './inventory-transaction.schema';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockItem.name, schema: StockItemSchema },
      { name: ScrapRule.name, schema: ScrapRuleSchema },
      { name: InventoryTransaction.name, schema: InventoryTransactionSchema },
    ]),
    UsersModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, MongooseModule],
})
export class InventoryModule {}
