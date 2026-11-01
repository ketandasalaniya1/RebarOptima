import { ObjectId } from 'mongodb';
import { ChatService } from './chat.service';

describe('ChatService Unit Tests', () => {
  let mockDb: any;
  let service: ChatService;
  let conversationsStore: any[] = [];
  let messagesStore: any[] = [];

  const matchId = (doc: any, q: any) => {
    if (!doc || !q) return false;
    if (q.$or) {
      return q.$or.some((sub: any) => sub._id && String(sub._id) === String(doc._id));
    }
    if (q._id) {
      return String(q._id) === String(doc._id);
    }
    return true;
  };

  beforeEach(() => {
    conversationsStore = [];
    messagesStore = [];

    mockDb = {
      collection: jest.fn((name: string) => {
        if (name === 'chat_conversations') {
          return {
            findOne: jest.fn(async (q: any) => {
              return conversationsStore.find(c => {
                if (q.type && c.type !== q.type) return false;
                if (q.companyId && c.companyId !== q.companyId) return false;
                if (q.memberIds?.$all) {
                  return q.memberIds.$all.every((m: string) => c.memberIds.includes(m));
                }
                return matchId(c, q);
              }) || null;
            }),
            insertOne: jest.fn(async (doc: any) => {
              const inserted = { ...doc, _id: new ObjectId() };
              conversationsStore.push(inserted);
              return { insertedId: inserted._id };
            }),
            updateOne: jest.fn(async (q: any, update: any) => {
              const target = conversationsStore.find(c => matchId(c, q));
              if (target && update.$set) {
                Object.assign(target, update.$set);
              }
              return { modifiedCount: 1 };
            }),
            find: jest.fn(() => ({
              sort: jest.fn(() => ({
                toArray: jest.fn(async () => [...conversationsStore]),
              })),
            })),
          };
        }
        if (name === 'chat_messages') {
          return {
            insertOne: jest.fn(async (doc: any) => {
              const inserted = { ...doc, _id: new ObjectId() };
              messagesStore.push(inserted);
              return { insertedId: inserted._id };
            }),
            findOne: jest.fn(async (q: any) => {
              return messagesStore.find(m => matchId(m, q)) || null;
            }),
            find: jest.fn(() => ({
              sort: jest.fn(() => ({
                limit: jest.fn(() => ({
                  toArray: jest.fn(async () => [...messagesStore]),
                })),
              })),
            })),
            countDocuments: jest.fn(async () => 0),
            updateMany: jest.fn(async () => ({ modifiedCount: 2 })),
            updateOne: jest.fn(async (q: any, update: any) => {
              const target = messagesStore.find(m => matchId(m, q));
              if (target && update.$set) {
                Object.assign(target, update.$set);
              }
              if (target && update.$addToSet?.deletedForUserIds) {
                target.deletedForUserIds = target.deletedForUserIds || [];
                target.deletedForUserIds.push(update.$addToSet.deletedForUserIds);
              }
              return { modifiedCount: 1 };
            }),
          };
        }
        if (name === 'chat_user_presence') {
          return {
            updateOne: jest.fn(async () => ({ upsertedCount: 1 })),
            findOne: jest.fn(async () => ({ isOnline: true })),
          };
        }
        if (name === 'users') {
          return {
            findOne: jest.fn(async () => ({ firstName: 'Test', lastName: 'Colleague', email: 'colleague@example.com' })),
            find: jest.fn(() => ({
              project: jest.fn(() => ({
                limit: jest.fn(() => ({
                  toArray: jest.fn(async () => [{ _id: new ObjectId(), firstName: 'Alice', email: 'alice@test.com' }]),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };

    service = new ChatService(mockDb);
  });

  test('getOrCreateDirectConversation should create conversation if not exists and reuse existing', async () => {
    const conv1 = await service.getOrCreateDirectConversation('comp-1', 'proj-1', 'user-1', 'user-2');
    expect(conv1).toBeDefined();
    expect(conv1.type).toBe('direct');
    expect(conv1.memberIds).toContain('user-1');
    expect(conv1.memberIds).toContain('user-2');

    // Retrieve again - should return the existing one
    const conv2 = await service.getOrCreateDirectConversation('comp-1', 'proj-1', 'user-2', 'user-1');
    expect(conv2._id?.toString()).toBe(conv1._id?.toString());
  });

  test('createGroupConversation should create group and initial system message', async () => {
    const group = await service.createGroupConversation({
      companyId: 'comp-1',
      projectId: 'proj-1',
      creatorId: 'user-1',
      creatorName: 'Ketan D.',
      name: 'Site Engineers Group',
      memberIds: ['user-2', 'user-3'],
    });

    expect(group.name).toBe('Site Engineers Group');
    expect(group.memberIds).toEqual(['user-1', 'user-2', 'user-3']);
    expect(group.adminIds).toContain('user-1');
    expect(messagesStore.length).toBe(1);
    expect(messagesStore[0].type).toBe('system');
  });

  test('saveMessage should record message and update conversation preview', async () => {
    const conv = await service.getOrCreateDirectConversation('comp-1', 'proj-1', 'user-1', 'user-2');
    const msg = await service.saveMessage({
      companyId: 'comp-1',
      projectId: 'proj-1',
      conversationId: conv._id!.toString(),
      senderId: 'user-1',
      senderName: 'Ketan D.',
      content: 'Has the rebar delivery arrived at site?',
    });

    expect(msg.content).toBe('Has the rebar delivery arrived at site?');
    expect(msg.readBy).toHaveLength(1);
    expect(conversationsStore[0].lastMessage).toBeDefined();
    expect(conversationsStore[0].lastMessage.contentSnippet).toContain('Has the rebar');
  });

  test('editMessage should update content and timestamp for sender', async () => {
    const conv = await service.getOrCreateDirectConversation('comp-1', 'proj-1', 'user-1', 'user-2');
    const msg = await service.saveMessage({
      companyId: 'comp-1',
      projectId: 'proj-1',
      conversationId: conv._id!.toString(),
      senderId: 'user-1',
      senderName: 'Ketan D.',
      content: 'Original message typo',
    });

    const edited = await service.editMessage('comp-1', msg._id!.toString(), 'user-1', 'Corrected message content');
    expect(edited.text).toBe('Corrected message content');
    expect(messagesStore[0].content).toBe('Corrected message content');
  });

  test('deleteMessage for everyone should mark isDeletedForEveryone', async () => {
    const conv = await service.getOrCreateDirectConversation('comp-1', 'proj-1', 'user-1', 'user-2');
    const msg = await service.saveMessage({
      companyId: 'comp-1',
      projectId: 'proj-1',
      conversationId: conv._id!.toString(),
      senderId: 'user-1',
      senderName: 'Ketan D.',
      content: 'Message to delete',
    });

    await service.deleteMessage('comp-1', msg._id!.toString(), 'user-1', true);
    expect(messagesStore[0].isDeletedForEveryone).toBe(true);
  });
});
