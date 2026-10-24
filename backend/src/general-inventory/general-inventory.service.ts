import { Db, MongoClient, ObjectId } from 'mongodb';
import {
  IGeneralMaterial,
  IGeneralStockBalance,
  IGeneralTransaction,
  IInwardEntry,
  IOutwardEntry,
  IMaterialReturnEntry,
  IStoreTransfer,
  IStockVerification,
  IStockAdjustment,
  IIncidentReport,
  StockStatus
} from './general-inventory.types';

// Helper to normalize queries for string/ObjectId
export function idQuery(id: string | any): any {
  if (!id) return { _id: id };
  if (id instanceof ObjectId) return { _id: id };
  if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: String(id) };
}

// Generate human-friendly reference number
export async function generateSequenceNumber(
  db: Db,
  companyId: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const counterKey = `${companyId}_${prefix}_${year}`;
  
  try {
    const counterColl = db.collection('gi_counters');
    const res = await counterColl.findOneAndUpdate(
      { _id: counterKey as any },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = (res?.seq || res?.value?.seq || 1);
    const padded = String(seq).padStart(4, '0');
    return `${prefix}-${year}-${padded}`;
  } catch {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}-${random}`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. MATERIAL REGISTER SERVICE
// ══════════════════════════════════════════════════════════════════════════════

export async function checkMaterialDuplicate(
  db: Db,
  companyId: string,
  projectId: string,
  name: string,
  sizeOrSpec?: string,
  excludeId?: string
) {
  const cleanName = (name || '').trim().toLowerCase();
  const cleanSpec = (sizeOrSpec || '').trim().toLowerCase();

  const query: any = { companyId, projectId, isActive: true };
  if (excludeId) {
    query._id = { $ne: ObjectId.isValid(excludeId) && excludeId.length === 24 ? new ObjectId(excludeId) : excludeId };
  }

  const existingMaterials = await db.collection('gi_materials').find(query).toArray();

  for (const mat of existingMaterials) {
    const matName = (mat.name || '').trim().toLowerCase();
    const matSpec = (mat.sizeOrSpec || '').trim().toLowerCase();

    // Exact name match or close name + spec match
    if (matName === cleanName && (!cleanSpec || !matSpec || cleanSpec === matSpec)) {
      return {
        isDuplicate: true,
        existing: {
          id: mat._id.toString(),
          name: mat.name,
          category: mat.category,
          sizeOrSpec: mat.sizeOrSpec,
          materialCode: mat.materialCode
        }
      };
    }
  }

  return { isDuplicate: false, existing: null };
}

export async function getMaterialsWithStock(
  db: Db,
  companyId: string,
  projectId: string,
  storeId?: string,
  includeInactive = false
) {
  const query: any = { companyId, projectId };
  if (!includeInactive) {
    query.isActive = { $ne: false };
  }

  const materials = await db.collection('gi_materials').find(query).sort({ name: 1 }).toArray();

  const balanceQuery: any = { companyId, projectId };
  if (storeId) {
    balanceQuery.storeId = storeId;
  }

  const balances = await db.collection('gi_stock_balances').find(balanceQuery).toArray();
  const balanceMap = new Map<string, number>();

  for (const b of balances) {
    const key = `${b.materialId}_${b.storeId}`;
    balanceMap.set(key, (balanceMap.get(key) || 0) + (Number(b.currentBalance) || 0));
  }

  return materials.map((m: any) => {
    const matId = m._id.toString();
    let currentStock = 0;

    if (storeId) {
      currentStock = balanceMap.get(`${matId}_${storeId}`) || 0;
    } else {
      // aggregate across all stores of this project
      for (const [key, qty] of balanceMap.entries()) {
        if (key.startsWith(`${matId}_`)) {
          currentStock += qty;
        }
      }
    }

    const threshold = Number(m.lowStockThreshold) || 0;
    let status: StockStatus = 'NORMAL';
    if (currentStock === 0) {
      status = 'OUT_OF_STOCK';
    } else if (currentStock <= threshold) {
      status = 'LOW_STOCK';
    }

    return {
      ...m,
      id: matId,
      currentStock,
      status
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. ATOMIC STOCK UPDATES & TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════════

// Explicit opening balance entry (Never created automatically)
export async function setOpeningBalance(
  db: Db,
  params: {
    companyId: string;
    projectId: string;
    storeId: string;
    materialId: string;
    quantity: number;
    user: any;
    remarks?: string;
  }
) {
  const { companyId, projectId, storeId, materialId, quantity, user, remarks } = params;
  const qty = Number(quantity);
  if (isNaN(qty) || qty < 0) {
    throw new Error('Opening balance quantity must be a non-negative number.');
  }

  const material = await db.collection('gi_materials').findOne(idQuery(materialId));
  if (!material) throw new Error('Material not found');

  const now = new Date();

  // Check if balance already initialized
  const existingBalance = await db.collection('gi_stock_balances').findOne({
    companyId,
    projectId,
    storeId,
    materialId
  });

  const previousBalance = existingBalance ? (Number(existingBalance.currentBalance) || 0) : 0;
  const diff = qty - previousBalance;

  await db.collection('gi_stock_balances').updateOne(
    { companyId, projectId, storeId, materialId },
    {
      $set: { currentBalance: qty, updatedAt: now }
    },
    { upsert: true }
  );

  const refNumber = await generateSequenceNumber(db, companyId, 'OPN');

  const transactionRecord: IGeneralTransaction = {
    companyId,
    projectId,
    storeId,
    materialId,
    materialName: material.name,
    uom: material.uom,
    transactionType: 'OPENING_BALANCE',
    quantity: qty,
    balanceAfter: qty,
    referenceType: 'OPENING',
    referenceNumber: refNumber,
    date: now,
    performedBy: {
      userId: user.sub || user.id,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Store User',
      email: user.email,
      role: user.role
    },
    remarks: remarks || `Opening stock balance set to ${qty} ${material.uom}`,
    createdAt: now
  };

  await db.collection('gi_transactions').insertOne(transactionRecord);

  return { success: true, balance: qty, referenceNumber: refNumber };
}

// Inward Entry Processing
export async function processInwardReceipt(
  db: Db,
  params: {
    companyId: string;
    projectId: string;
    storeId: string;
    receiptDate: Date | string;
    vendorName: string;
    vendorContact?: string;
    vendorChallanNumber: string;
    invoiceNumber?: string;
    items: Array<{
      materialId: string;
      receivedQuantity: number;
      acceptedQuantity: number;
      damagedQuantity?: number;
      rejectedQuantity?: number;
      unitPrice?: number;
      remarks?: string;
    }>;
    receivedBy: any;
    remarks?: string;
    attachments?: any[];
  }
) {
  const {
    companyId,
    projectId,
    storeId,
    receiptDate,
    vendorName,
    vendorContact,
    vendorChallanNumber,
    invoiceNumber,
    items,
    receivedBy,
    remarks,
    attachments
  } = params;

  if (!items || items.length === 0) {
    throw new Error('Inward entry must contain at least one material line item.');
  }

  const inwardNumber = await generateSequenceNumber(db, companyId, 'INW');
  const now = new Date();
  const dateObj = new Date(receiptDate || now);

  const processedItems: any[] = [];

  for (const it of items) {
    const material = await db.collection('gi_materials').findOne(idQuery(it.materialId));
    if (!material) {
      throw new Error(`Material with ID ${it.materialId} not found.`);
    }

    const receivedQty = Number(it.receivedQuantity) || 0;
    const acceptedQty = Number(it.acceptedQuantity) || 0;
    const damagedQty = Number(it.damagedQuantity) || 0;
    const rejectedQty = Number(it.rejectedQuantity) || 0;

    if (acceptedQty < 0 || damagedQty < 0 || rejectedQty < 0) {
      throw new Error('Quantities cannot be negative.');
    }

    if (acceptedQty + damagedQty + rejectedQty > receivedQty && receivedQty > 0) {
      throw new Error(`Accepted (${acceptedQty}) + Damaged (${damagedQty}) + Rejected (${rejectedQty}) cannot exceed received quantity (${receivedQty}) for ${material.name}.`);
    }

    // Only accepted quantities increase available stock!
    let newBalance = 0;
    if (acceptedQty > 0) {
      const updateResult = await db.collection('gi_stock_balances').findOneAndUpdate(
        { companyId, projectId, storeId, materialId: material._id.toString() },
        {
          $inc: { currentBalance: acceptedQty },
          $set: { updatedAt: now }
        },
        { upsert: true, returnDocument: 'after' }
      );
      newBalance = updateResult?.currentBalance ?? updateResult?.value?.currentBalance ?? acceptedQty;

      // Log transaction
      const tx: IGeneralTransaction = {
        companyId,
        projectId,
        storeId,
        materialId: material._id.toString(),
        materialName: material.name,
        uom: material.uom,
        transactionType: 'INWARD',
        quantity: acceptedQty,
        balanceAfter: newBalance,
        referenceType: 'INWARD',
        referenceNumber: inwardNumber,
        date: dateObj,
        performedBy: {
          userId: receivedBy.sub || receivedBy.userId || receivedBy.id,
          name: receivedBy.name || `${receivedBy.firstName || ''} ${receivedBy.lastName || ''}`.trim() || 'Store Keeper',
          email: receivedBy.email,
          role: receivedBy.role
        },
        remarks: `Inward receipt from ${vendorName} (Challan: ${vendorChallanNumber}). Accepted: ${acceptedQty} ${material.uom}. (Damaged: ${damagedQty}, Rejected: ${rejectedQty})`,
        metadata: {
          vendorName,
          vendorChallanNumber,
          damagedQuantity: damagedQty,
          rejectedQuantity: rejectedQty
        },
        createdAt: now
      };
      await db.collection('gi_transactions').insertOne(tx);
    } else {
      // Stock balance unchanged, get current
      const curr = await db.collection('gi_stock_balances').findOne({ companyId, projectId, storeId, materialId: material._id.toString() });
      newBalance = curr ? (Number(curr.currentBalance) || 0) : 0;
    }

    processedItems.push({
      materialId: material._id.toString(),
      materialName: material.name,
      uom: material.uom,
      receivedQuantity: receivedQty,
      acceptedQuantity: acceptedQty,
      damagedQuantity: damagedQty,
      rejectedQuantity: rejectedQty,
      unitPrice: Number(it.unitPrice) || 0,
      remarks: it.remarks || ''
    });
  }

  const inwardRecord: IInwardEntry = {
    companyId,
    projectId,
    storeId,
    inwardNumber,
    receiptDate: dateObj,
    vendorName: vendorName.trim(),
    vendorContact: vendorContact?.trim(),
    vendorChallanNumber: vendorChallanNumber.trim(),
    invoiceNumber: invoiceNumber?.trim(),
    items: processedItems,
    receivedBy: {
      userId: receivedBy.sub || receivedBy.userId || receivedBy.id,
      name: receivedBy.name || `${receivedBy.firstName || ''} ${receivedBy.lastName || ''}`.trim() || 'Store Keeper',
      email: receivedBy.email,
      role: receivedBy.role
    },
    remarks: remarks?.trim(),
    attachments: attachments || [],
    createdAt: now
  };

  const insertResult = await db.collection('gi_inward_entries').insertOne(inwardRecord);
  return { ...inwardRecord, _id: insertResult.insertedId, id: insertResult.insertedId.toString() };
}

// Outward Issue Processing (Concurrency-Safe Backend Available Stock Validation)
export async function processOutwardIssue(
  db: Db,
  params: {
    companyId: string;
    projectId: string;
    storeId: string;
    issueDateTime: Date | string;
    materialId: string;
    quantity: number;
    personReceiving: string;
    issuedBy: any;
    agency?: string;
    location: string;
    purpose: string;
    returnClassification: 'returnable' | 'non-returnable';
    expectedReturnDate?: Date | string;
    remarks?: string;
    attachments?: any[];
  }
) {
  const {
    companyId,
    projectId,
    storeId,
    issueDateTime,
    materialId,
    quantity,
    personReceiving,
    issuedBy,
    agency,
    location,
    purpose,
    returnClassification,
    expectedReturnDate,
    remarks,
    attachments
  } = params;

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Outward quantity must be greater than zero.');
  }

  const material = await db.collection('gi_materials').findOne(idQuery(materialId));
  if (!material) {
    throw new Error('Material not found.');
  }

  const matId = material._id.toString();

  // Backend Concurrency-Safe Check:
  // Using atomic condition `{ currentBalance: { $gte: qty } }`
  const now = new Date();
  const dateObj = new Date(issueDateTime || now);

  const updateResult = await db.collection('gi_stock_balances').findOneAndUpdate(
    {
      companyId,
      projectId,
      storeId,
      materialId: matId,
      currentBalance: { $gte: qty }
    },
    {
      $inc: { currentBalance: -qty },
      $set: { updatedAt: now }
    },
    { returnDocument: 'after' }
  );

  const updatedDoc = updateResult?.value || updateResult;
  if (!updatedDoc || updatedDoc.currentBalance === undefined) {
    // Check what the current balance actually is for a clear error message
    const current = await db.collection('gi_stock_balances').findOne({ companyId, projectId, storeId, materialId: matId });
    const available = current ? (Number(current.currentBalance) || 0) : 0;
    throw new Error(`Insufficient available stock for ${material.name}. Requested: ${qty} ${material.uom}, Available: ${available} ${material.uom}.`);
  }

  const newBalance = Number(updatedDoc.currentBalance);
  const outwardNumber = await generateSequenceNumber(db, companyId, 'OUT');

  // Format agency - explicitly "Not Applicable" if empty or not provided
  const finalAgency = (agency && agency.trim()) ? agency.trim() : 'Not Applicable';

  const outwardRecord: IOutwardEntry = {
    companyId,
    projectId,
    storeId,
    outwardNumber,
    issueDateTime: dateObj,
    materialId: matId,
    materialName: material.name,
    uom: material.uom,
    quantity: qty,
    personReceiving: personReceiving.trim(),
    issuedBy: {
      userId: issuedBy.sub || issuedBy.userId || issuedBy.id,
      name: issuedBy.name || `${issuedBy.firstName || ''} ${issuedBy.lastName || ''}`.trim() || 'Store Incharge',
      email: issuedBy.email,
      role: issuedBy.role
    },
    agency: finalAgency,
    location: location.trim(),
    purpose: purpose.trim(),
    returnClassification,
    expectedReturnDate: returnClassification === 'returnable' && expectedReturnDate ? new Date(expectedReturnDate) : undefined,
    status: 'ISSUED',
    returnedQuantity: 0,
    damagedReturnedQuantity: 0,
    missingReturnedQuantity: 0,
    outstandingQuantity: qty,
    remarks: remarks?.trim(),
    attachments: attachments || [],
    createdAt: now
  };

  const insertResult = await db.collection('gi_outward_entries').insertOne(outwardRecord);

  // Log transaction
  const tx: IGeneralTransaction = {
    companyId,
    projectId,
    storeId,
    materialId: matId,
    materialName: material.name,
    uom: material.uom,
    transactionType: 'OUTWARD',
    quantity: qty,
    balanceAfter: newBalance,
    referenceType: 'OUTWARD',
    referenceNumber: outwardNumber,
    date: dateObj,
    performedBy: {
      userId: issuedBy.sub || issuedBy.userId || issuedBy.id,
      name: issuedBy.name || `${issuedBy.firstName || ''} ${issuedBy.lastName || ''}`.trim() || 'Store Incharge',
      email: issuedBy.email,
      role: issuedBy.role
    },
    remarks: `Issued to ${personReceiving} (${finalAgency}) for ${purpose}. Location: ${location}`,
    metadata: {
      outwardId: insertResult.insertedId.toString(),
      personReceiving,
      agency: finalAgency,
      location,
      returnClassification
    },
    createdAt: now
  };
  await db.collection('gi_transactions').insertOne(tx);

  return { ...outwardRecord, _id: insertResult.insertedId, id: insertResult.insertedId.toString(), balanceAfter: newBalance };
}

// Material Returns Processing (Unused or Borrowed Returns)
export async function processMaterialReturn(
  db: Db,
  params: {
    companyId: string;
    projectId: string;
    storeId: string;
    outwardId: string;
    returnType: 'UNUSED' | 'BORROWED';
    returnDate: Date | string;
    returnedByPerson: string;
    acceptedQuantity: number;
    damagedQuantity?: number;
    missingQuantity?: number;
    receivedBy: any;
    remarks?: string;
  }
) {
  const {
    companyId,
    projectId,
    storeId,
    outwardId,
    returnType,
    returnDate,
    returnedByPerson,
    acceptedQuantity,
    damagedQuantity = 0,
    missingQuantity = 0,
    receivedBy,
    remarks
  } = params;

  const outward = await db.collection('gi_outward_entries').findOne(idQuery(outwardId));
  if (!outward) {
    throw new Error('Original outward issue transaction not found.');
  }

  const acceptedQty = Number(acceptedQuantity) || 0;
  const damagedQty = Number(damagedQuantity) || 0;
  const missingQty = Number(missingQuantity) || 0;
  const totalReturnBatch = acceptedQty + damagedQty + missingQty;

  if (acceptedQty < 0 || damagedQty < 0 || missingQty < 0) {
    throw new Error('Return quantities cannot be negative.');
  }

  if (totalReturnBatch <= 0) {
    throw new Error('At least one return quantity (accepted, damaged, or missing) must be greater than zero.');
  }

  const outstanding = Number(outward.outstandingQuantity) || 0;
  if (totalReturnBatch > outstanding) {
    throw new Error(`Total return quantity (${totalReturnBatch}) exceeds outstanding quantity (${outstanding}) for this issue.`);
  }

  const now = new Date();
  const dateObj = new Date(returnDate || now);
  const returnNumber = await generateSequenceNumber(db, companyId, 'RET');

  // ONLY accepted, usable returned quantities increase available stock!
  let newBalance = 0;
  if (acceptedQty > 0) {
    const updateResult = await db.collection('gi_stock_balances').findOneAndUpdate(
      { companyId, projectId, storeId, materialId: outward.materialId },
      {
        $inc: { currentBalance: acceptedQty },
        $set: { updatedAt: now }
      },
      { upsert: true, returnDocument: 'after' }
    );
    newBalance = updateResult?.currentBalance ?? updateResult?.value?.currentBalance ?? acceptedQty;

    // Log transaction
    const tx: IGeneralTransaction = {
      companyId,
      projectId,
      storeId,
      materialId: outward.materialId,
      materialName: outward.materialName,
      uom: outward.uom,
      transactionType: returnType === 'UNUSED' ? 'RETURN_UNUSED' : 'RETURN_BORROWED',
      quantity: acceptedQty,
      balanceAfter: newBalance,
      referenceType: 'RETURN',
      referenceNumber: returnNumber,
      date: dateObj,
      performedBy: {
        userId: receivedBy.sub || receivedBy.userId || receivedBy.id,
        name: receivedBy.name || `${receivedBy.firstName || ''} ${receivedBy.lastName || ''}`.trim() || 'Store Incharge',
        email: receivedBy.email,
        role: receivedBy.role
      },
      remarks: `Return received from ${returnedByPerson} against Outward ${outward.outwardNumber}. Accepted: ${acceptedQty} ${outward.uom}. (Damaged: ${damagedQty}, Missing: ${missingQty})`,
      metadata: {
        outwardId: outward._id.toString(),
        outwardNumber: outward.outwardNumber,
        returnType,
        damagedQuantity: damagedQty,
        missingQuantity: missingQty
      },
      createdAt: now
    };
    await db.collection('gi_transactions').insertOne(tx);
  } else {
    const curr = await db.collection('gi_stock_balances').findOne({ companyId, projectId, storeId, materialId: outward.materialId });
    newBalance = curr ? (Number(curr.currentBalance) || 0) : 0;
  }

  // Update outward status and cumulative return counters (do NOT alter original outward fields)
  const newReturned = (Number(outward.returnedQuantity) || 0) + acceptedQty;
  const newDamaged = (Number(outward.damagedReturnedQuantity) || 0) + damagedQty;
  const newMissing = (Number(outward.missingReturnedQuantity) || 0) + missingQty;
  const newOutstanding = outstanding - totalReturnBatch;

  const newStatus = newOutstanding === 0 ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED';

  await db.collection('gi_outward_entries').updateOne(
    { _id: outward._id },
    {
      $set: {
        returnedQuantity: newReturned,
        damagedReturnedQuantity: newDamaged,
        missingReturnedQuantity: newMissing,
        outstandingQuantity: newOutstanding,
        status: newStatus,
        updatedAt: now
      }
    }
  );

  const returnRecord: IMaterialReturnEntry = {
    companyId,
    projectId,
    storeId,
    returnNumber,
    returnDate: dateObj,
    returnType,
    outwardId: outward._id.toString(),
    outwardNumber: outward.outwardNumber,
    materialId: outward.materialId,
    materialName: outward.materialName,
    uom: outward.uom,
    returnedByPerson: returnedByPerson.trim(),
    receivedBy: {
      userId: receivedBy.sub || receivedBy.userId || receivedBy.id,
      name: receivedBy.name || `${receivedBy.firstName || ''} ${receivedBy.lastName || ''}`.trim() || 'Store Incharge',
      email: receivedBy.email,
      role: receivedBy.role
    },
    acceptedQuantity: acceptedQty,
    damagedQuantity: damagedQty,
    missingQuantity: missingQty,
    remarks: remarks?.trim(),
    createdAt: now
  };

  const insertResult = await db.collection('gi_returns').insertOne(returnRecord);
  return { ...returnRecord, _id: insertResult.insertedId, id: insertResult.insertedId.toString(), balanceAfter: newBalance };
}

// Inter-Store Transfers (Within Same Project Only, Atomic Dual Balance Update)
export async function processStoreTransfer(
  db: Db,
  client: MongoClient | null,
  params: {
    companyId: string;
    projectId: string;
    sourceStoreId: string;
    destinationStoreId: string;
    materialId: string;
    quantity: number;
    transferDate: Date | string;
    responsibleUser: any;
    reference?: string;
    remarks?: string;
  }
) {
  const {
    companyId,
    projectId,
    sourceStoreId,
    destinationStoreId,
    materialId,
    quantity,
    transferDate,
    responsibleUser,
    reference,
    remarks
  } = params;

  if (sourceStoreId === destinationStoreId) {
    throw new Error('Source store and destination store must be different.');
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Transfer quantity must be greater than zero.');
  }

  // Verify stores belong to same project
  const [sourceStore, destStore, material] = await Promise.all([
    db.collection('gi_stores').findOne(idQuery(sourceStoreId)),
    db.collection('gi_stores').findOne(idQuery(destinationStoreId)),
    db.collection('gi_materials').findOne(idQuery(materialId))
  ]);

  if (!sourceStore || sourceStore.projectId !== projectId) {
    throw new Error('Source store not found or does not belong to this project.');
  }
  if (!destStore || destStore.projectId !== projectId) {
    throw new Error('Destination store not found or does not belong to this project.');
  }
  if (!material) {
    throw new Error('Material not found.');
  }

  const matId = material._id.toString();
  const now = new Date();
  const dateObj = new Date(transferDate || now);
  const transferNumber = await generateSequenceNumber(db, companyId, 'TRF');

  // Concurrency-safe atomic deduction from source store
  const deductResult = await db.collection('gi_stock_balances').findOneAndUpdate(
    {
      companyId,
      projectId,
      storeId: sourceStoreId,
      materialId: matId,
      currentBalance: { $gte: qty }
    },
    {
      $inc: { currentBalance: -qty },
      $set: { updatedAt: now }
    },
    { returnDocument: 'after' }
  );

  const updatedSource = deductResult?.value || deductResult;
  if (!updatedSource || updatedSource.currentBalance === undefined) {
    const current = await db.collection('gi_stock_balances').findOne({ companyId, projectId, storeId: sourceStoreId, materialId: matId });
    const available = current ? (Number(current.currentBalance) || 0) : 0;
    throw new Error(`Insufficient available stock in ${sourceStore.name}. Available: ${available} ${material.uom}, Requested transfer: ${qty} ${material.uom}.`);
  }

  const sourceBalanceAfter = Number(updatedSource.currentBalance);

  // Increment destination store
  let destBalanceAfter = 0;
  try {
    const addResult = await db.collection('gi_stock_balances').findOneAndUpdate(
      { companyId, projectId, storeId: destinationStoreId, materialId: matId },
      {
        $inc: { currentBalance: qty },
        $set: { updatedAt: now }
      },
      { upsert: true, returnDocument: 'after' }
    );
    destBalanceAfter = addResult?.currentBalance ?? addResult?.value?.currentBalance ?? qty;
  } catch (err: any) {
    // If destination increment fails, compensate and restore source balance immediately!
    await db.collection('gi_stock_balances').updateOne(
      { companyId, projectId, storeId: sourceStoreId, materialId: matId },
      { $inc: { currentBalance: qty }, $set: { updatedAt: new Date() } }
    );
    throw new Error(`Store transfer failed when crediting destination store: ${err.message}. Source balance restored.`);
  }

  const transferRecord: IStoreTransfer = {
    companyId,
    projectId,
    transferNumber,
    transferDate: dateObj,
    sourceStoreId,
    sourceStoreName: sourceStore.name,
    destinationStoreId,
    destinationStoreName: destStore.name,
    materialId: matId,
    materialName: material.name,
    uom: material.uom,
    quantity: qty,
    responsibleUser: {
      userId: responsibleUser.sub || responsibleUser.userId || responsibleUser.id,
      name: responsibleUser.name || `${responsibleUser.firstName || ''} ${responsibleUser.lastName || ''}`.trim() || 'Store Incharge',
      email: responsibleUser.email,
      role: responsibleUser.role
    },
    reference: reference?.trim(),
    remarks: remarks?.trim(),
    createdAt: now
  };

  const insertResult = await db.collection('gi_transfers').insertOne(transferRecord);

  // Log both transactions in the ledger
  const txOut: IGeneralTransaction = {
    companyId,
    projectId,
    storeId: sourceStoreId,
    materialId: matId,
    materialName: material.name,
    uom: material.uom,
    transactionType: 'TRANSFER_OUT',
    quantity: qty,
    balanceAfter: sourceBalanceAfter,
    referenceType: 'TRANSFER',
    referenceNumber: transferNumber,
    date: dateObj,
    performedBy: {
      userId: responsibleUser.sub || responsibleUser.userId || responsibleUser.id,
      name: responsibleUser.name || 'Store Incharge',
      email: responsibleUser.email,
      role: responsibleUser.role
    },
    remarks: `Transferred OUT to ${destStore.name}. Ref: ${reference || 'N/A'}`,
    metadata: { transferId: insertResult.insertedId.toString(), toStoreId: destinationStoreId, toStoreName: destStore.name },
    createdAt: now
  };

  const txIn: IGeneralTransaction = {
    companyId,
    projectId,
    storeId: destinationStoreId,
    materialId: matId,
    materialName: material.name,
    uom: material.uom,
    transactionType: 'TRANSFER_IN',
    quantity: qty,
    balanceAfter: destBalanceAfter,
    referenceType: 'TRANSFER',
    referenceNumber: transferNumber,
    date: dateObj,
    performedBy: {
      userId: responsibleUser.sub || responsibleUser.userId || responsibleUser.id,
      name: responsibleUser.name || 'Store Incharge',
      email: responsibleUser.email,
      role: responsibleUser.role
    },
    remarks: `Transferred IN from ${sourceStore.name}. Ref: ${reference || 'N/A'}`,
    metadata: { transferId: insertResult.insertedId.toString(), fromStoreId: sourceStoreId, fromStoreName: sourceStore.name },
    createdAt: now
  };

  await db.collection('gi_transactions').insertMany([txOut, txIn]);

  return {
    ...transferRecord,
    _id: insertResult.insertedId,
    id: insertResult.insertedId.toString(),
    sourceBalanceAfter,
    destBalanceAfter
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. PHYSICAL VERIFICATION & TRACEABLE ADJUSTMENTS
// ══════════════════════════════════════════════════════════════════════════════

// Record physical verification audit (Does NOT overwrite stock silently!)
export async function recordStockVerification(
  db: Db,
  params: {
    companyId: string;
    projectId: string;
    storeId: string;
    materialId: string;
    physicalQuantity: number;
    verificationDate: Date | string;
    responsibleUser: any;
    remarks?: string;
  }
) {
  const {
    companyId,
    projectId,
    storeId,
    materialId,
    physicalQuantity,
    verificationDate,
    responsibleUser,
    remarks
  } = params;

  const material = await db.collection('gi_materials').findOne(idQuery(materialId));
  if (!material) throw new Error('Material not found.');

  const current = await db.collection('gi_stock_balances').findOne({
    companyId,
    projectId,
    storeId,
    materialId: material._id.toString()
  });

  const systemQty = current ? (Number(current.currentBalance) || 0) : 0;
  const physQty = Number(physicalQuantity) || 0;
  const difference = physQty - systemQty;
  const now = new Date();

  const record: IStockVerification = {
    companyId,
    projectId,
    storeId,
    verificationDate: new Date(verificationDate || now),
    materialId: material._id.toString(),
    materialName: material.name,
    uom: material.uom,
    systemQuantity: systemQty,
    physicalQuantity: physQty,
    difference,
    responsibleUser: {
      userId: responsibleUser.sub || responsibleUser.userId || responsibleUser.id,
      name: responsibleUser.name || 'Auditor',
      email: responsibleUser.email,
      role: responsibleUser.role
    },
    remarks: remarks?.trim(),
    adjustmentCreated: false,
    createdAt: now
  };

  const res = await db.collection('gi_stock_verifications').insertOne(record);
  return { ...record, _id: res.insertedId, id: res.insertedId.toString() };
}

// Authorized Stock Adjustment (Traceable correction with who, when, why)
export async function processStockAdjustment(
  db: Db,
  params: {
    companyId: string;
    projectId: string;
    storeId: string;
    materialId: string;
    adjustmentType: 'ADD' | 'DEDUCT';
    quantity: number;
    reason: string;
    authorizedBy: any;
    verificationId?: string;
  }
) {
  const {
    companyId,
    projectId,
    storeId,
    materialId,
    adjustmentType,
    quantity,
    reason,
    authorizedBy,
    verificationId
  } = params;

  if (!reason || !reason.trim()) {
    throw new Error('A detailed reason is strictly required for stock adjustments.');
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Adjustment quantity must be greater than zero.');
  }

  const material = await db.collection('gi_materials').findOne(idQuery(materialId));
  if (!material) throw new Error('Material not found.');

  const matId = material._id.toString();
  const now = new Date();
  const adjNumber = await generateSequenceNumber(db, companyId, 'ADJ');

  let newBalance = 0;

  if (adjustmentType === 'ADD') {
    const updateResult = await db.collection('gi_stock_balances').findOneAndUpdate(
      { companyId, projectId, storeId, materialId: matId },
      {
        $inc: { currentBalance: qty },
        $set: { updatedAt: now }
      },
      { upsert: true, returnDocument: 'after' }
    );
    newBalance = updateResult?.currentBalance ?? updateResult?.value?.currentBalance ?? qty;
  } else {
    // DEDUCT: cannot exceed available stock
    const updateResult = await db.collection('gi_stock_balances').findOneAndUpdate(
      {
        companyId,
        projectId,
        storeId,
        materialId: matId,
        currentBalance: { $gte: qty }
      },
      {
        $inc: { currentBalance: -qty },
        $set: { updatedAt: now }
      },
      { returnDocument: 'after' }
    );

    const updatedDoc = updateResult?.value || updateResult;
    if (!updatedDoc || updatedDoc.currentBalance === undefined) {
      const current = await db.collection('gi_stock_balances').findOne({ companyId, projectId, storeId, materialId: matId });
      const available = current ? (Number(current.currentBalance) || 0) : 0;
      throw new Error(`Cannot deduct ${qty} ${material.uom}. Current available stock is only ${available} ${material.uom}.`);
    }
    newBalance = Number(updatedDoc.currentBalance);
  }

  const adjustmentRecord: IStockAdjustment = {
    companyId,
    projectId,
    storeId,
    adjustmentNumber: adjNumber,
    adjustmentDate: now,
    materialId: matId,
    materialName: material.name,
    uom: material.uom,
    adjustmentType,
    quantity: qty,
    reason: reason.trim(),
    authorizedBy: {
      userId: authorizedBy.sub || authorizedBy.userId || authorizedBy.id,
      name: authorizedBy.name || `${authorizedBy.firstName || ''} ${authorizedBy.lastName || ''}`.trim() || 'Admin User',
      email: authorizedBy.email,
      role: authorizedBy.role
    },
    verificationId,
    createdAt: now
  };

  const insertResult = await db.collection('gi_adjustments').insertOne(adjustmentRecord);

  // Link to verification if provided
  if (verificationId) {
    await db.collection('gi_stock_verifications').updateOne(
      idQuery(verificationId),
      { $set: { adjustmentCreated: true, adjustmentId: insertResult.insertedId.toString() } }
    );
  }

  // Log in transaction ledger
  const tx: IGeneralTransaction = {
    companyId,
    projectId,
    storeId,
    materialId: matId,
    materialName: material.name,
    uom: material.uom,
    transactionType: adjustmentType === 'ADD' ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_DEDUCT',
    quantity: qty,
    balanceAfter: newBalance,
    referenceType: 'ADJUSTMENT',
    referenceNumber: adjNumber,
    date: now,
    performedBy: {
      userId: authorizedBy.sub || authorizedBy.userId || authorizedBy.id,
      name: authorizedBy.name || 'Admin User',
      email: authorizedBy.email,
      role: authorizedBy.role
    },
    remarks: `Authorized Adjustment (${adjustmentType}): ${reason.trim()}`,
    metadata: { adjustmentId: insertResult.insertedId.toString(), verificationId },
    createdAt: now
  };
  await db.collection('gi_transactions').insertOne(tx);

  return { ...adjustmentRecord, _id: insertResult.insertedId, id: insertResult.insertedId.toString(), balanceAfter: newBalance };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. INCIDENT REPORTING (Does NOT automatically deduct stock!)
// ══════════════════════════════════════════════════════════════════════════════

export async function reportIncident(
  db: Db,
  params: {
    companyId: string;
    projectId: string;
    storeId: string;
    incidentType: 'Missing' | 'Suspected Theft' | 'Damaged' | 'Other Loss';
    materialId?: string;
    quantity?: number;
    date: Date | string;
    description: string;
    reportedBy: string;
    attachments?: any[];
  }
) {
  const {
    companyId,
    projectId,
    storeId,
    incidentType,
    materialId,
    quantity,
    date,
    description,
    reportedBy,
    attachments
  } = params;

  if (!description || !description.trim()) {
    throw new Error('A description of the incident is required.');
  }

  let materialName = '';
  let uom = '';

  if (materialId) {
    const mat = await db.collection('gi_materials').findOne(idQuery(materialId));
    if (mat) {
      materialName = mat.name;
      uom = mat.uom;
    }
  }

  const now = new Date();
  const incNumber = await generateSequenceNumber(db, companyId, 'INC');

  const record: IIncidentReport = {
    companyId,
    projectId,
    storeId,
    incidentNumber: incNumber,
    incidentType,
    materialId,
    materialName,
    uom,
    quantity: quantity ? Number(quantity) : undefined,
    date: new Date(date || now),
    description: description.trim(),
    reportedBy: reportedBy.trim(),
    status: 'REPORTED',
    attachments: attachments || [],
    createdAt: now
  };

  const res = await db.collection('gi_incidents').insertOne(record);
  return { ...record, _id: res.insertedId, id: res.insertedId.toString() };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. COMPREHENSIVE REPORTS GENERATION
// ══════════════════════════════════════════════════════════════════════════════

export async function generateInventoryReport(
  db: Db,
  companyId: string,
  projectId: string,
  reportType: string,
  filters: any = {}
) {
  const { storeId, materialId, startDate, endDate, returnClassification, agency, vendorName } = filters;

  const dateFilter: any = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  switch (reportType) {
    case 'store-wise-stock': {
      // 1. Current store-wise stock report
      const stores = await db.collection('gi_stores').find({ companyId, projectId, status: { $ne: 'inactive' } }).toArray();
      const materials = await db.collection('gi_materials').find({ companyId, projectId, isActive: true }).toArray();
      const balances = await db.collection('gi_stock_balances').find({ companyId, projectId }).toArray();

      const balanceMap = new Map<string, number>();
      balances.forEach((b: any) => {
        balanceMap.set(`${b.storeId}_${b.materialId}`, Number(b.currentBalance) || 0);
      });

      const reportRows: any[] = [];
      materials.forEach((m: any) => {
        const matId = m._id.toString();
        const threshold = Number(m.lowStockThreshold) || 0;

        stores.forEach((s: any) => {
          const sId = s._id.toString();
          if (storeId && storeId !== sId) return;

          const qty = balanceMap.get(`${sId}_${matId}`) || 0;
          let status: StockStatus = 'NORMAL';
          if (qty === 0) status = 'OUT_OF_STOCK';
          else if (qty <= threshold) status = 'LOW_STOCK';

          reportRows.push({
            storeId: sId,
            storeName: s.name,
            materialId: matId,
            materialName: m.name,
            category: m.category,
            materialCode: m.materialCode || '',
            uom: m.uom,
            currentBalance: qty,
            lowStockThreshold: threshold,
            status
          });
        });
      });

      return { reportType, title: 'Store-Wise Current Stock Balances', rows: reportRows };
    }

    case 'inward-register': {
      // 2. Inward register
      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;
      if (vendorName) query.vendorName = { $regex: vendorName, $options: 'i' };
      if (Object.keys(dateFilter).length > 0) query.receiptDate = dateFilter;

      const entries = await db.collection('gi_inward_entries').find(query).sort({ receiptDate: -1 }).toArray();
      return { reportType, title: 'Inward Goods Receipt Register', rows: entries };
    }

    case 'outward-register': {
      // 3. Outward register
      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;
      if (materialId) query.materialId = materialId;
      if (agency) query.agency = { $regex: agency, $options: 'i' };
      if (returnClassification) query.returnClassification = returnClassification;
      if (Object.keys(dateFilter).length > 0) query.issueDateTime = dateFilter;

      const entries = await db.collection('gi_outward_entries').find(query).sort({ issueDateTime: -1 }).toArray();
      return { reportType, title: 'Outward Material Issue Register', rows: entries };
    }

    case 'material-ledger': {
      // 4. Material ledger
      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;
      if (materialId) query.materialId = materialId;
      if (filters.transactionType) query.transactionType = filters.transactionType;
      if (Object.keys(dateFilter).length > 0) query.date = dateFilter;

      const entries = await db.collection('gi_transactions').find(query).sort({ date: -1, createdAt: -1 }).toArray();
      return { reportType, title: 'General Material Movement Ledger', rows: entries };
    }

    case 'low-stock': {
      // 5. Low-stock & out-of-stock materials
      const allStock = await getMaterialsWithStock(db, companyId, projectId, storeId);
      const lowStockRows = allStock.filter((m: any) => m.status === 'LOW_STOCK' || m.status === 'OUT_OF_STOCK');
      return { reportType, title: 'Critical Low-Stock & Out-of-Stock Alert Register', rows: lowStockRows };
    }

    case 'overdue-borrowed': {
      // 6. Outstanding and overdue borrowed items
      const now = new Date();
      const query: any = {
        companyId,
        projectId,
        returnClassification: 'returnable',
        outstandingQuantity: { $gt: 0 }
      };
      if (storeId) query.storeId = storeId;

      const items = await db.collection('gi_outward_entries').find(query).sort({ expectedReturnDate: 1 }).toArray();
      const rows = items.map((it: any) => {
        const exp = it.expectedReturnDate ? new Date(it.expectedReturnDate) : null;
        const isOverdue = exp ? now > exp : false;
        const daysOverdue = exp && isOverdue ? Math.ceil((now.getTime() - exp.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          ...it,
          isOverdue,
          daysOverdue
        };
      });
      return { reportType, title: 'Outstanding & Overdue Borrowed Items Register', rows };
    }

    case 'vendor-wise-inward': {
      // 7. Vendor-wise inward transactions
      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;
      if (Object.keys(dateFilter).length > 0) query.receiptDate = dateFilter;

      const entries = await db.collection('gi_inward_entries').find(query).toArray();
      const vendorSummary: Record<string, { vendorName: string; totalReceipts: number; totalAcceptedItems: number; challans: string[] }> = {};

      entries.forEach((e: any) => {
        const v = e.vendorName || 'Unknown Vendor';
        if (!vendorSummary[v]) {
          vendorSummary[v] = { vendorName: v, totalReceipts: 0, totalAcceptedItems: 0, challans: [] };
        }
        vendorSummary[v].totalReceipts += 1;
        if (e.vendorChallanNumber && !vendorSummary[v].challans.includes(e.vendorChallanNumber)) {
          vendorSummary[v].challans.push(e.vendorChallanNumber);
        }
        (e.items || []).forEach((it: any) => {
          vendorSummary[v].totalAcceptedItems += (Number(it.acceptedQuantity) || 0);
        });
      });

      return { reportType, title: 'Vendor-Wise Inward Summary Report', rows: Object.values(vendorSummary) };
    }

    case 'agency-wise-outward': {
      // 8. Agency-wise outward transactions
      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;
      if (Object.keys(dateFilter).length > 0) query.issueDateTime = dateFilter;

      const entries = await db.collection('gi_outward_entries').find(query).toArray();
      const agencySummary: Record<string, { agencyName: string; totalIssues: number; totalIssuedQuantity: number; outstandingQuantity: number }> = {};

      entries.forEach((e: any) => {
        const a = e.agency || 'Not Applicable';
        if (!agencySummary[a]) {
          agencySummary[a] = { agencyName: a, totalIssues: 0, totalIssuedQuantity: 0, outstandingQuantity: 0 };
        }
        agencySummary[a].totalIssues += 1;
        agencySummary[a].totalIssuedQuantity += (Number(e.quantity) || 0);
        agencySummary[a].outstandingQuantity += (Number(e.outstandingQuantity) || 0);
      });

      return { reportType, title: 'Agency-Wise Material Outward Summary Report', rows: Object.values(agencySummary) };
    }

    case 'discrepancies': {
      // 9. Stock discrepancies from physical verification
      const query: any = { companyId, projectId, difference: { $ne: 0 } };
      if (storeId) query.storeId = storeId;
      if (Object.keys(dateFilter).length > 0) query.verificationDate = dateFilter;

      const entries = await db.collection('gi_stock_verifications').find(query).sort({ verificationDate: -1 }).toArray();
      return { reportType, title: 'Physical Stock Audit Discrepancies Register', rows: entries };
    }

    case 'incidents': {
      // 10. Reported missing, theft, damage, and loss incidents
      const query: any = { companyId, projectId };
      if (storeId) query.storeId = storeId;
      if (filters.incidentType) query.incidentType = filters.incidentType;
      if (Object.keys(dateFilter).length > 0) query.date = dateFilter;

      const entries = await db.collection('gi_incidents').find(query).sort({ date: -1 }).toArray();
      return { reportType, title: 'Missing, Theft, Damage & Loss Incidents Register', rows: entries };
    }

    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}
