import { Router } from 'express';
import { Db, ObjectId } from 'mongodb';
import { ChatService, idQuery, companyFilter } from './chat.service';
import { IChatAttachmentInfo } from './chat.types';
import { NotificationService } from '../notifications/notification.service';

export function createChatRouter(
  getDb: () => any,
  authMiddleware: any,
  ioProvider?: () => any
): Router {
  const router = Router();

  const resolveUserContext = async (req: any, db: Db) => {
    const userId = String(req.user?.sub || req.user?.id || req.user?._id || '');
    let companyId = req.user?.companyId || req.headers['x-company-id'];
    let userName = req.user?.name || req.user?.username || req.user?.email || 'User';

    if ((!companyId || companyId === 'default-company') && userId) {
      try {
        const u = await db.collection('users').findOne(idQuery(userId));
        if (u) {
          if (u.companyId) companyId = String(u.companyId);
          userName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || userName;
        }
      } catch {}
    }
    let rawPid = req.query?.projectId || req.body?.projectId || req.headers['x-project-id'];
    if (!rawPid || rawPid === 'undefined' || rawPid === 'null') {
      rawPid = 'all';
    }
    const projectId = String(rawPid);
    return { userId, companyId: String(companyId || 'default-company'), userName, projectId };
  };

  // 1. Get conversations for current user
  router.get('/conversations', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId, projectId } = await resolveUserContext(req, db);
      const conversations = await service.getUserConversations(companyId, projectId, userId);
      res.json({ success: true, data: conversations });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. Start or retrieve 1:1 direct chat
  router.post('/conversations/direct', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId, projectId } = await resolveUserContext(req, db);
      const { otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({ success: false, message: 'otherUserId is required' });
      }

      const conv = await service.getOrCreateDirectConversation(
        companyId,
        projectId,
        userId,
        otherUserId
      );

      res.json({ success: true, data: conv });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. Create group chat
  router.post('/conversations/group', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId, userName, projectId } = await resolveUserContext(req, db);
      const { title, description, memberUserIds, avatarUrl, type } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: 'Group title is required' });
      }

      const memberIds = Array.isArray(memberUserIds) ? memberUserIds : [];
      const conv = await service.createGroupConversation({
        companyId,
        projectId,
        creatorId: userId,
        creatorName: userName,
        name: title.trim(),
        description,
        avatarUrl,
        memberIds,
        type: type === 'project_group' ? 'project_group' : 'group',
      });

      res.json({ success: true, data: conv });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. Get messages in a conversation (enforces membership security)
  router.get('/conversations/:id/messages', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;
      const limit = Number(req.query.limit) || 40;
      const before = req.query.before as string;

      const messages = await service.getMessages(companyId, id, userId, limit, before);
      res.json({ success: true, data: messages });
    } catch (err: any) {
      if (err.message && (err.message.includes('Access denied') || err.message.includes('not a participant') || err.message.includes('Unauthorized'))) {
        return res.status(403).json({ success: false, message: err.message });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. REST fallback for sending messages (enforces membership security)
  router.post('/conversations/:id/messages', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId, userName, projectId } = await resolveUserContext(req, db);
      const { id } = req.params;
      const { content, text, type, attachments, replyTo } = req.body;

      // Verify conversation and membership
      const conv = await service.getConversationById(id);
      if (!conv) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }
      if (!conv.memberIds?.includes(userId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: You are not a member of this conversation' });
      }

      const message = await service.saveMessage({
        conversationId: id,
        companyId,
        projectId,
        senderId: userId,
        senderName: userName,
        type: type || 'text',
        content: content || text || '',
        attachments: attachments || [],
        replyTo,
      });

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`conv:${id}`).emit('new_message', message);
            if (conv.memberIds) {
              for (const memberId of conv.memberIds) {
                io.to(`user:${memberId}`).emit('conversation_updated', {
                  conversationId: id,
                  lastMessage: {
                    contentSnippet: message.content || (message.attachments?.length ? 'Attachment' : ''),
                    createdAt: message.createdAt,
                    senderId: message.senderId,
                    senderName: message.senderName,
                  },
                  unreadDelta: memberId === userId ? 0 : 1,
                });

                if (String(memberId) !== String(userId)) {
                  const title = conv.type === 'group' || conv.type === 'project_group'
                    ? `${userName} in ${conv.name || 'Group'}`
                    : userName;

                  io.to(`user:${memberId}`).emit('new_chat_message_notification', {
                    conversationId: String(id),
                    conversationTitle: title,
                    conversationType: conv.type,
                    senderName: userName,
                    senderId: String(userId),
                    message,
                  });
                }
              }
            }
          }
        } catch {}
      }

      // Dispatch Web Push and FCM Push notifications to other members
      try {
        const notifService = new NotificationService(db);
        if (conv.memberIds && Array.isArray(conv.memberIds)) {
          for (const memberId of conv.memberIds) {
            if (String(memberId) !== String(userId)) {
              const title = conv.type === 'group' || conv.type === 'project_group'
                ? `${userName} in ${conv.name || 'Group'}`
                : userName;
              const snippet = message.content || (message.attachments?.length ? '📎 Sent an attachment' : 'New message');

              notifService.sendPushNotification(String(memberId), {
                title,
                body: snippet,
                data: {
                  conversationId: String(id),
                  url: `/chat?conv=${id}`,
                },
              }).catch((e: any) => console.error('Push notification dispatch error:', e.message));
            }
          }
        }
      } catch (pushErr: any) {
        console.error('Failed to trigger push notifications from chat route:', pushErr.message);
      }

      res.json({ success: true, data: message });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. Mark conversation as read
  router.post('/conversations/:id/read', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;

      await service.markAsRead(companyId, id, userId);

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`conv:${id}`).emit('messages_read', {
              conversationId: id,
              userId,
              readAt: new Date(),
            });
          }
        } catch {}
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 7. Mark conversation messages as delivered
  router.post('/conversations/:id/delivered', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;

      await service.markAsDelivered(companyId, id, userId);

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`conv:${id}`).emit('messages_delivered', {
              conversationId: id,
              userId,
              deliveredAt: new Date(),
            });
          }
        } catch {}
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 8. Group Administration: Add Member
  router.post('/conversations/:id/members', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;
      const { newUserId } = req.body;

      if (!newUserId) {
        return res.status(400).json({ success: false, message: 'newUserId is required' });
      }

      const updated = await service.addGroupMember(companyId, id, userId, newUserId);

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`conv:${id}`).emit('group_updated', updated);
            io.to(`user:${newUserId}`).emit('group_added', updated);
          }
        } catch {}
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 9. Group Administration: Remove Member
  router.delete('/conversations/:id/members/:memberId', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id, memberId } = req.params;

      const updated = await service.removeGroupMember(companyId, id, userId, memberId);

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`conv:${id}`).emit('group_updated', updated);
            io.to(`user:${memberId}`).emit('group_removed', { conversationId: id });
          }
        } catch {}
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 10. Group Administration: Update Group Info
  router.put('/conversations/:id', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;
      const { name, description, avatarUrl } = req.body;

      const updated = await service.updateGroupInfo(companyId, id, userId, { name, description, avatarUrl });

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`conv:${id}`).emit('group_updated', updated);
          }
        } catch {}
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 11. Leave Group
  router.post('/conversations/:id/leave', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;

      await service.leaveGroup(companyId, id, userId);

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`conv:${id}`).emit('member_left', { conversationId: id, userId });
          }
        } catch {}
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 12. Toggle Pin conversation for current user
  router.post('/conversations/:id/pin', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;

      const result = await service.togglePinConversation(companyId, id, userId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 13. Toggle Pin message in conversation (broadcasts to all members)
  router.post('/conversations/:id/pin-message', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;
      const { messageId } = req.body;

      if (!messageId) {
        return res.status(400).json({ success: false, message: 'messageId is required' });
      }

      const result = await service.togglePinMessage(companyId, id, userId, messageId);

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`conv:${id}`).emit('pinned_messages_updated', {
              conversationId: id,
              pinnedMessageIds: result.pinnedMessageIds,
              messageId,
              isPinned: result.isPinned,
            });
          }
        } catch {}
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 14. Toggle Star message for current user
  router.post('/messages/:id/star', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const { id } = req.params;

      const result = await service.toggleStarMessage(companyId, id, userId);

      if (ioProvider) {
        try {
          const io = ioProvider();
          if (io) {
            io.to(`user:${userId}`).emit('message_starred', {
              messageId: id,
              isStarred: result.isStarred,
              starredBy: result.starredBy,
            });
          }
        } catch {}
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 15. Search messages across conversations
  router.get('/search', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId } = await resolveUserContext(req, db);
      const q = String(req.query.q || '');
      const conversationId = req.query.conversationId as string;

      const results = await service.searchMessages(companyId, userId, q, conversationId);
      res.json({ success: true, data: results });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 13. Get potential chat contacts within company / project
  router.get('/users', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const service = new ChatService(db);
      const { userId, companyId, projectId } = await resolveUserContext(req, db);
      const search = req.query.search as string;

      const candidates = await service.getDirectChatCandidates(companyId, projectId, userId, search);
      res.json({ success: true, data: candidates });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 14. Upload attachment (Base64 or JSON body with data URL)
  router.post('/attachments', authMiddleware, async (req: any, res) => {
    try {
      const db: Db = getDb();
      const { userId, companyId } = await resolveUserContext(req, db);
      const { fileName, mimeType, sizeBytes, dataBase64, durationSeconds } = req.body;

      if (!fileName || !mimeType || !dataBase64) {
        return res.status(400).json({ success: false, message: 'Missing required file data' });
      }

      // Security Check: Block dangerous executable and script files
      const BLOCKED_EXTENSIONS = [
        '.exe', '.bat', '.cmd', '.sh', '.vbs', '.php', '.dll', '.scr',
        '.msi', '.jar', '.jsp', '.py', '.com', '.pif', '.reg', '.app',
        '.dmg', '.bin', '.iso', '.apk', '.wsf', '.cpl'
      ];
      const lowerName = String(fileName || '').toLowerCase();
      if (BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        return res.status(400).json({
          success: false,
          message: 'Security Alert: Executable and script files are blocked for server safety.',
        });
      }

      // Server Crash Protection: Maximum file size limit (MongoDB BSON max 16MB)
      const MAX_SAFE_SIZE_BYTES = 16 * 1024 * 1024;
      if (Number(sizeBytes) > MAX_SAFE_SIZE_BYTES || (dataBase64 && dataBase64.length > 22 * 1024 * 1024)) {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the 16MB safe limit to prevent server overload.',
        });
      }

      const doc = {
        companyId,
        uploadedBy: userId,
        fileName,
        mimeType,
        sizeBytes: Number(sizeBytes) || 0,
        dataBase64,
        durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
        createdAt: new Date(),
      };

      const result = await db.collection('chat_attachments').insertOne(doc);
      const attachmentId = result.insertedId.toString();

      const attachment: IChatAttachmentInfo = {
        fileId: attachmentId,
        name: fileName,
        sizeBytes: Number(sizeBytes) || 0,
        mimeType,
        url: `/api/chat/attachments/${attachmentId}`,
        durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
      };

      res.json({ success: true, data: attachment });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 15. Download or view attachment
  router.get('/attachments/:id', async (req: any, res) => {
    try {
      const db: Db = getDb();
      const { id } = req.params;

      let doc;
      try {
        doc = await db.collection('chat_attachments').findOne({ _id: new ObjectId(id) });
      } catch {
        doc = await db.collection('chat_attachments').findOne({ _id: id as any });
      }

      if (!doc) {
        return res.status(404).json({ success: false, message: 'Attachment not found' });
      }

      res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${doc.fileName || 'file'}"`);

      let base64 = doc.dataBase64;
      if (base64.includes(',')) {
        base64 = base64.split(',')[1];
      }
      const buffer = Buffer.from(base64, 'base64');
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
