import { ObjectId } from 'mongodb';
import {
  normalizeBlockName,
  validateBlocksPayload,
  MAX_BLOCKS_PER_PROJECT,
  insertProjectWithBlocks,
  assertBlockInProject,
  createBlockForProject,
  PROJECT_BLOCKS_COLLECTION,
} from './project-blocks.service';

describe('project-blocks.service validation', () => {
  it('normalizes block names', () => {
    expect(normalizeBlockName('  Tower   A ')).toBe('tower a');
  });

  it('allows empty / missing blocks array', () => {
    expect(validateBlocksPayload(undefined).ok).toBe(true);
    expect(validateBlocksPayload(null).items).toEqual([]);
    expect(validateBlocksPayload([]).items).toEqual([]);
  });

  it('accepts zero to N named blocks', () => {
    const v = validateBlocksPayload([{ name: 'Tower A' }, { name: 'Tower B' }]);
    expect(v.ok).toBe(true);
    expect(v.items).toHaveLength(2);
  });

  it('rejects empty block names', () => {
    const v = validateBlocksPayload([{ name: '  ' }]);
    expect(v.ok).toBe(false);
    expect(v.code).toBe('BLOCK_NAME_REQUIRED');
  });

  it('rejects duplicate names case-insensitively', () => {
    const v = validateBlocksPayload([{ name: 'Tower A' }, { name: 'tower a' }]);
    expect(v.ok).toBe(false);
    expect(v.code).toBe('BLOCK_NAME_DUPLICATE');
  });

  it('rejects more than MAX_BLOCKS_PER_PROJECT', () => {
    const blocks = Array.from({ length: MAX_BLOCKS_PER_PROJECT + 1 }, (_, i) => ({
      name: `Block ${i}`,
    }));
    const v = validateBlocksPayload(blocks);
    expect(v.ok).toBe(false);
    expect(v.code).toBe('BLOCKS_LIMIT');
  });
});

describe('insertProjectWithBlocks compensating path', () => {
  it('rolls back project when block insert fails', async () => {
    const projectId = new ObjectId();
    const deleted: string[] = [];
    const db = {
      collection: (name: string) => {
        if (name === 'projects') {
          return {
            insertOne: jest.fn().mockResolvedValue({ insertedId: projectId }),
            deleteOne: jest.fn().mockImplementation(async () => {
              deleted.push('projects');
              return { deletedCount: 1 };
            }),
          };
        }
        if (name === PROJECT_BLOCKS_COLLECTION) {
          return {
            insertMany: jest.fn().mockRejectedValue(new Error('simulated block insert failure')),
            deleteMany: jest.fn().mockImplementation(async () => {
              deleted.push('project_blocks');
              return { deletedCount: 0 };
            }),
          };
        }
        throw new Error(`unexpected collection ${name}`);
      },
    };

    await expect(
      insertProjectWithBlocks({
        db,
        client: null,
        projectDoc: {
          _id: projectId,
          companyId: 'comp_1',
          name: 'Green Valley',
          createdAt: new Date(),
        },
        blockItems: [{ name: 'Tower A' }],
      }),
    ).rejects.toThrow('simulated block insert failure');

    expect(deleted).toEqual(['project_blocks', 'projects']);
  });

  it('inserts project with zero blocks', async () => {
    const projectId = new ObjectId();
    const insertOne = jest.fn().mockResolvedValue({ insertedId: projectId });
    const db = {
      collection: (name: string) => {
        if (name === 'projects') return { insertOne };
        if (name === PROJECT_BLOCKS_COLLECTION) {
          return { insertMany: jest.fn() };
        }
        throw new Error(name);
      },
    };

    const result = await insertProjectWithBlocks({
      db,
      client: null,
      projectDoc: { _id: projectId, companyId: 'c1', name: 'Soft Start' },
      blockItems: [],
    });

    expect(result.blocks).toHaveLength(0);
    expect(result.project.blockCount).toBe(0);
    expect(insertOne).toHaveBeenCalled();
  });
});

describe('assertBlockInProject', () => {
  const ctx: any = {
    userId: 'u1',
    companyId: 'comp_1',
    role: 'Admin',
    roleNormalized: 'ADMIN',
    userDoc: null,
    assignedProjects: [],
    dataScope: 'organization',
    isCompanyAdmin: true,
    isPartnerAdmin: false,
    isDeveloper: false,
    requiresProjectAssignment: false,
  };

  it('rejects block belonging to another project', async () => {
    const projectId = new ObjectId();
    const otherProjectId = new ObjectId();
    const blockId = new ObjectId();

    const db = {
      collection: (name: string) => {
        if (name === 'projects') {
          return {
            findOne: jest.fn().mockResolvedValue({
              _id: projectId,
              companyId: 'comp_1',
              status: 'active',
            }),
          };
        }
        if (name === PROJECT_BLOCKS_COLLECTION) {
          return {
            findOne: jest.fn().mockImplementation(async (q: any) => {
              // Simulate: block exists but not for this project filter → null
              if (q.projectId === String(projectId)) return null;
              return {
                _id: blockId,
                projectId: String(otherProjectId),
                companyId: 'comp_1',
                status: 'active',
              };
            }),
          };
        }
        return { findOne: jest.fn() };
      },
    };

    await expect(
      assertBlockInProject(db, ctx, String(projectId), String(blockId)),
    ).rejects.toMatchObject({ status: 404, code: 'BLOCK_NOT_FOUND' });
  });
});

describe('createBlockForProject', () => {
  it('rejects duplicate name with 409', async () => {
    const projectId = new ObjectId();
    const ctx: any = {
      userId: 'u1',
      companyId: 'comp_1',
      isCompanyAdmin: true,
      requiresProjectAssignment: false,
      assignedProjects: [],
    };

    const db = {
      collection: (name: string) => {
        if (name === 'projects') {
          return {
            findOne: jest.fn().mockResolvedValue({
              _id: projectId,
              companyId: 'comp_1',
              status: 'active',
            }),
            updateOne: jest.fn(),
          };
        }
        if (name === PROJECT_BLOCKS_COLLECTION) {
          return {
            findOne: jest.fn().mockResolvedValue({ _id: new ObjectId(), nameLower: 'tower a' }),
            countDocuments: jest.fn().mockResolvedValue(1),
            insertOne: jest.fn(),
          };
        }
        return {};
      },
    };

    await expect(
      createBlockForProject({
        db,
        ctx,
        projectId: String(projectId),
        input: { name: 'Tower A' },
      }),
    ).rejects.toMatchObject({ status: 409, code: 'BLOCK_NAME_DUPLICATE' });
  });
});
