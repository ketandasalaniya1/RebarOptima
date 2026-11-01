import { ObjectId } from 'mongodb';

export function isDepartLabourDeptName(name: string): boolean {
  const normalized = String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const compacted = normalized.replace(/\s/g, '');
  return (
    normalized.includes('depart labour') ||
    compacted.includes('departlabour') ||
    compacted.includes('departlabor')
  );
}

export function resolveContractorLabourMode(
  contractor: { attendanceMethod?: string } | null | undefined,
  departments: Array<{ name?: string; nameLower?: string }> = [],
): 'named' | 'workforce' {
  const hasDepartLabourDept = departments.some((d) =>
    isDepartLabourDeptName(d.name || d.nameLower || ''),
  );
  const eachWorkerSeparately = contractor?.attendanceMethod === 'each_worker_separately';
  return hasDepartLabourDept || eachWorkerSeparately ? 'named' : 'workforce';
}

function toObjectId(id: any): ObjectId | null {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  const str = String(id).trim();
  if (ObjectId.isValid(str) && str.length === 24) {
    try {
      return new ObjectId(str);
    } catch {
      return null;
    }
  }
  return null;
}

function companyFilter(companyId: any): any {
  if (!companyId) return { companyId: null };
  const objId = toObjectId(companyId);
  if (objId) {
    return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  }
  return { companyId: String(companyId) };
}

function projectFilter(projectId: string): any {
  const objId = toObjectId(projectId);
  if (objId) {
    return { $or: [{ projectId: objId }, { projectId: String(projectId) }] };
  }
  return { projectId: String(projectId) };
}

function andFilters(...parts: any[]): any {
  const clauses = parts.filter((p) => p && typeof p === 'object' && Object.keys(p).length > 0);
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

function idQueryLocal(id: string) {
  const oid = toObjectId(id);
  if (oid) return { $or: [{ _id: oid }, { _id: String(id) }] };
  return { _id: String(id) };
}

/** Load contractor + departments and resolve named | workforce mode. */
export async function loadContractorMode(
  db: any,
  companyId: string,
  projectId: string,
  contractorId: string,
): Promise<{
  contractor: any;
  departments: Array<{ id: string; name: string; nameLower: string }>;
  mode: 'named' | 'workforce';
}> {
  const contractor = await db.collection('contractors').findOne(
    andFilters(idQueryLocal(contractorId), companyFilter(companyId), projectFilter(projectId), {
      isActive: { $ne: false },
    }),
  );
  if (!contractor) {
    const err: any = new Error('Contractor not found on this project');
    err.status = 404;
    throw err;
  }

  const deptIds = (contractor.departmentIds || []).map((d: any) => String(d));
  const deptRows = await db
    .collection('contractor_departments')
    .find(
      andFilters(companyFilter(companyId), projectFilter(projectId), {
        isActive: { $ne: false },
      }),
    )
    .toArray();
  const deptMap = new Map<string, { name: string; nameLower: string }>();
  for (const r of deptRows) {
    const name = r.name || '';
    deptMap.set(String(r._id), {
      name,
      nameLower: r.nameLower || String(name).toLowerCase(),
    });
  }

  let departments = deptIds
    .map((id: string) => {
      const fromMap = deptMap.get(id);
      if (!fromMap) return null;
      return { id, name: fromMap.name, nameLower: fromMap.nameLower };
    })
    .filter(Boolean) as Array<{ id: string; name: string; nameLower: string }>;

  if (departments.length === 0 && deptIds.length > 0) {
    const deptObjIds = deptIds.map(toObjectId).filter(Boolean) as ObjectId[];
    const depts =
      deptObjIds.length > 0
        ? await db
            .collection('contractor_departments')
            .find({ _id: { $in: deptObjIds }, isActive: { $ne: false } })
            .toArray()
        : [];
    departments = depts.map((d: any) => ({
      id: String(d._id),
      name: d.name || '',
      nameLower: d.nameLower || String(d.name || '').toLowerCase(),
    }));
  }

  const mode = resolveContractorLabourMode(contractor, departments);
  return { contractor, departments, mode };
}
