import { ObjectId } from 'mongodb';
import { createCastingRouter } from './casting.routes';

function createMockDb() {
  const collections: Record<string, any[]> = {
    projects: [],
    project_blocks: [],
    casting_projects: [],
    casting_blocks: [],
    casting_levels: [],
    casting_members: [],
    casting_events: [],
    users: [],
  };

  const db = {
    collection: (name: string) => {
      if (!collections[name]) {
        collections[name] = [];
      }
      const data = collections[name];

      return {
        find: (query: any = {}) => {
          const filter = (item: any) => {
            for (const [k, v] of Object.entries(query)) {
              if (k === '$or' && Array.isArray(v)) {
                const orMatch = v.some((cond) => {
                  for (const [ck, cv] of Object.entries(cond)) {
                    if (String(item[ck]) !== String(cv)) return false;
                  }
                  return true;
                });
                if (!orMatch) return false;
                continue;
              }
              if (v && typeof v === 'object' && '$ne' in (v as any)) {
                if (item[k] === (v as any).$ne) return false;
                continue;
              }
              if (v && typeof v === 'object' && '$in' in (v as any)) {
                if (!(v as any).$in.map(String).includes(String(item[k]))) return false;
                continue;
              }
              if (String(item[k]) !== String(v)) return false;
            }
            return true;
          };

          return {
            sort: () => ({
              toArray: async () => data.filter(filter),
            }),
            toArray: async () => data.filter(filter),
          };
        },
        findOne: async (query: any = {}) => {
          return (
            data.find((item: any) => {
              for (const [k, v] of Object.entries(query)) {
                if (k === '$or' && Array.isArray(v)) {
                  const orMatch = v.some((cond) => {
                    for (const [ck, cv] of Object.entries(cond)) {
                      if (String(item[ck]) !== String(cv)) return false;
                    }
                    return true;
                  });
                  if (!orMatch) return false;
                  continue;
                }
                if (v && typeof v === 'object' && '$ne' in (v as any)) {
                  if (item[k] === (v as any).$ne) return false;
                  continue;
                }
                if (v && typeof v === 'object' && '$regex' in (v as any)) {
                  if (!(v as any).$regex.test(String(item[k]))) return false;
                  continue;
                }
                if (String(item[k]) !== String(v)) return false;
              }
              return true;
            }) || null
          );
        },
        insertOne: async (doc: any) => {
          const insertedId = doc._id || new ObjectId();
          const saved = { ...doc, _id: insertedId };
          data.push(saved);
          return { insertedId };
        },
        updateOne: async (query: any, update: any, options: any = {}) => {
          const item = await db.collection(name).findOne(query);
          if (item && update.$set) {
            Object.assign(item, update.$set);
            return { matchedCount: 1, modifiedCount: 1 };
          }
          if (!item && options.upsert && update.$set) {
            const newItem = { ...query, ...update.$set };
            if (!newItem._id) newItem._id = new ObjectId();
            data.push(newItem);
            return { matchedCount: 0, modifiedCount: 0, upsertedId: newItem._id };
          }
          return { matchedCount: 0, modifiedCount: 0 };
        },
        updateMany: async (query: any, update: any) => {
          let count = 0;
          for (const item of data) {
            let matches = true;
            for (const [k, v] of Object.entries(query)) {
              if (String(item[k]) !== String(v)) {
                matches = false;
                break;
              }
            }
            if (matches && update.$set) {
              Object.assign(item, update.$set);
              count++;
            }
          }
          return { matchedCount: count, modifiedCount: count };
        },
        countDocuments: async (query: any = {}) => {
          const res = await db.collection(name).find(query).toArray();
          return res.length;
        },
        createIndex: jest.fn().mockResolvedValue(true),
      };
    },
    _collections: collections,
  };

  return db;
}

function invokeRouter(router: any, reqOptions: { method: string; url: string; body?: any; user?: any }): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    let statusCode = 200;
    const req: any = {
      method: reqOptions.method.toUpperCase(),
      url: reqOptions.url,
      originalUrl: reqOptions.url,
      path: reqOptions.url.split('?')[0],
      query: {},
      params: {},
      body: reqOptions.body || {},
      user: reqOptions.user,
      headers: {},
      get: (header: string) => req.headers[header.toLowerCase()],
    };

    const res: any = {
      statusCode: 200,
      status(code: number) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        resolve({ status: statusCode, body: data });
      },
      send(data: any) {
        resolve({ status: statusCode, body: data });
      },
    };

    router.handle(req, res, (err: any) => {
      if (err) {
        resolve({ status: err.status || 500, body: { message: err.message } });
      } else {
        resolve({ status: statusCode, body: null });
      }
    });
  });
}

describe('Casting Module Project & Blocks Integration', () => {
  let router: any;
  let mockDb: any;
  const companyId = 'comp_test_123';
  const globalProjectId = new ObjectId().toString();

  const user = {
    sub: 'user_admin',
    email: 'admin@rebar.com',
    companyId,
    role: 'org_admin',
    accountType: 'user',
  };

  beforeEach(() => {
    mockDb = createMockDb();
    // Seed global project in canonical `projects` collection
    mockDb._collections.projects.push({
      _id: new ObjectId(globalProjectId),
      id: globalProjectId,
      companyId,
      name: 'Skyline Towers',
      code: 'SKT-01',
      status: 'active',
      isDeleted: false,
      blockCount: 1,
      createdAt: new Date(),
    });

    // Seed block in canonical `project_blocks` collection
    const blockId = new ObjectId();
    mockDb._collections.project_blocks.push({
      _id: blockId,
      id: blockId.toString(),
      companyId,
      projectId: globalProjectId,
      name: 'Tower A',
      nameLower: 'tower a',
      code: 'BLK-01',
      description: 'Tower A Main Building',
      displayOrder: 1,
      status: 'active',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const authMiddleware = (req: any, _res: any, next: any) => {
      req.user = user;
      next();
    };

    router = createCastingRouter(() => mockDb, authMiddleware);
  });

  it('GET /projects/:projectId/blocks should sync blocks from project_blocks to casting_blocks', async () => {
    const res = await invokeRouter(router, {
      method: 'GET',
      url: `/projects/${globalProjectId}/blocks`,
      user,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Tower A');
    expect(res.body[0].code).toBe('BLK-01');

    // Verify it was synced into casting_blocks
    expect(mockDb._collections.casting_blocks.length).toBe(1);
    expect(mockDb._collections.casting_blocks[0].name).toBe('Tower A');
    expect(String(mockDb._collections.casting_blocks[0]._id)).toBe(String(mockDb._collections.project_blocks[0]._id));
  });

  it('POST /projects/:projectId/blocks should create block under canonical project without Project Not Found error', async () => {
    const res = await invokeRouter(router, {
      method: 'POST',
      url: `/projects/${globalProjectId}/blocks`,
      body: {
        name: 'Tower B',
        code: 'TWR-B',
        description: 'Second residential tower',
      },
      user,
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Tower B');
    expect(res.body.code).toBe('TWR-B');
    expect(res.body.projectId).toBe(globalProjectId);

    // Verify block was created in both project_blocks and casting_blocks with same ID
    const pb = mockDb._collections.project_blocks.find((b: any) => b.name === 'Tower B');
    const cb = mockDb._collections.casting_blocks.find((b: any) => b.name === 'Tower B');

    expect(pb).toBeDefined();
    expect(cb).toBeDefined();
    expect(String(pb._id)).toBe(String(cb._id));
    expect(String(pb._id)).toBe(String(res.body.id));
  });

  it('POST /projects/:projectId/blocks should return 404 when project does not exist', async () => {
    const nonExistentProjectId = new ObjectId().toString();
    const res = await invokeRouter(router, {
      method: 'POST',
      url: `/projects/${nonExistentProjectId}/blocks`,
      body: { name: 'Tower C' },
      user,
    });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Project not found');
  });

  it('POST /blocks/:blockId/levels should find block from project_blocks and create level', async () => {
    const block = mockDb._collections.project_blocks[0];
    const blockId = block._id.toString();

    const res = await invokeRouter(router, {
      method: 'POST',
      url: `/blocks/${blockId}/levels`,
      body: {
        name: 'Ground Floor',
        floorNumber: 0,
      },
      user,
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ground Floor');
    expect(res.body.blockId).toBe(blockId);
    expect(res.body.projectId).toBe(globalProjectId);
  });

  it('PUT /blocks/:id should update block in both casting_blocks and project_blocks', async () => {
    const block = mockDb._collections.project_blocks[0];
    const blockId = block._id.toString();

    const res = await invokeRouter(router, {
      method: 'PUT',
      url: `/blocks/${blockId}`,
      body: {
        name: 'Tower A Renamed',
        code: 'TWR-A-NEW',
      },
      user,
    });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Tower A Renamed');

    const pb = mockDb._collections.project_blocks.find((b: any) => String(b._id) === blockId);
    const cb = mockDb._collections.casting_blocks.find((b: any) => String(b._id) === blockId);

    expect(pb.name).toBe('Tower A Renamed');
    expect(cb.name).toBe('Tower A Renamed');
  });

  it('DELETE /blocks/:id should soft delete block in both casting_blocks and project_blocks', async () => {
    const block = mockDb._collections.project_blocks[0];
    const blockId = block._id.toString();

    const res = await invokeRouter(router, {
      method: 'DELETE',
      url: `/blocks/${blockId}`,
      user,
    });

    expect(res.status).toBe(200);

    const pb = mockDb._collections.project_blocks.find((b: any) => String(b._id) === blockId);
    const cb = mockDb._collections.casting_blocks.find((b: any) => String(b._id) === blockId);

    expect(pb.isDeleted).toBe(true);
    expect(cb.isDeleted).toBe(true);
  });
});
