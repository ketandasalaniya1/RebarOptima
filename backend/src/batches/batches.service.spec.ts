import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BatchesService } from './batches.service';
import { Batch } from './batch.schema';
import { StockItem } from '../inventory/stock-item.schema';
import { InventoryTransaction } from '../inventory/inventory-transaction.schema';
import { InventoryService } from '../inventory/inventory.service';

describe('BatchesService - Batch Cancellation & Stock Restoration', () => {
  let service: BatchesService;
  let mockBatchModel: any;
  let mockStockItemModel: any;
  let mockTransactionModel: any;
  let mockInventoryService: any;

  const companyId = new Types.ObjectId().toString();
  const batchId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockBatchModel = {
      findOne: jest.fn(),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) }),
    };

    mockStockItemModel = {
      findOne: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) }),
      deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) }),
    };

    mockTransactionModel = {
      deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 2 }) }),
    };

    mockInventoryService = {
      getScrapRules: jest.fn().mockResolvedValue([
        { diameter: 12, scrapLengthThreshold: 1000 },
      ]),
      getSingleBarWeight: jest.fn().mockReturnValue(10.66),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchesService,
        { provide: getModelToken(Batch.name), useValue: mockBatchModel },
        { provide: getModelToken(StockItem.name), useValue: mockStockItemModel },
        { provide: getModelToken(InventoryTransaction.name), useValue: mockTransactionModel },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<BatchesService>(BatchesService);
  });

  it('should throw error if batch is not found', async () => {
    mockBatchModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(service.deleteBatch(companyId, batchId, false)).rejects.toThrow('Batch not found');
  });

  it('should delete batch report only when restoreStock is false without modifying inventory', async () => {
    mockBatchModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(batchId),
        companyId: new Types.ObjectId(companyId),
        batchName: 'Batch Alpha',
        layouts: [{ diameter: 12, stockLength: 12000, repetition: 1, isVirtual: false }],
      }),
    });

    const result = await service.deleteBatch(companyId, batchId, false);

    expect(result.deletedCount).toBe(1);
    expect(mockStockItemModel.updateOne).not.toHaveBeenCalled();
    expect(mockTransactionModel.deleteMany).not.toHaveBeenCalled();
  });

  it('should restore stock bars and remove transactions when restoreStock is true', async () => {
    mockBatchModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(batchId),
        companyId: new Types.ObjectId(companyId),
        batchName: 'Batch Alpha',
        layouts: [
          { diameter: 12, stockLength: 12000, repetition: 2, waste: 500, isVirtual: false },
        ],
      }),
    });

    const result = await service.deleteBatch(companyId, batchId, true);

    expect(result.deletedCount).toBe(1);
    // Stock restored for 12mm x 12000mm
    expect(mockStockItemModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ diameter: 12, length: 12000, isRemnant: false }),
      expect.objectContaining({ $inc: { quantity: 2, weightInKgs: 21.32 } }),
      expect.anything(),
    );
    // Transactions cleaned up
    expect(mockTransactionModel.deleteMany).toHaveBeenCalledWith({
      companyId: new Types.ObjectId(companyId),
      referenceName: 'Batch Alpha',
    });
  });

  it('should prevent stock restoration if generated remnants have already been consumed', async () => {
    mockBatchModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(batchId),
        companyId: new Types.ObjectId(companyId),
        batchName: 'Batch Beta',
        layouts: [
          { diameter: 12, stockLength: 12000, repetition: 2, waste: 2500, isVirtual: false },
        ],
      }),
    });

    // Remnant in inventory has quantity 0 (it was consumed)
    mockStockItemModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ quantity: 0 }),
    });

    await expect(service.deleteBatch(companyId, batchId, true)).rejects.toThrow(
      /Remnants .* have already been consumed/,
    );
    expect(mockBatchModel.deleteOne).not.toHaveBeenCalled();
  });
});
