import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Db, ObjectId } from 'mongodb';
import { ChatService, idQuery, companyFilter } from './chat.service';
import { NotificationService } from '../notifications/notification.service';
import { IChatMessage } from './chat.types';

export class ChatSocketGateway {
  private io: SocketIOServer;
  private chatService: ChatService;
  private notificationService: NotificationService;
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(
    server: HttpServer,
    private db: Db,
    private jwtSecret: string
  ) {
    this.chatService = new ChatService(db);
    this.notificationService = new NotificationService(db);

    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
      maxHttpBufferSize: 1e7, // 10MB
    });

    this.setupMiddleware();
    this.setupHandlers();
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  private setupMiddleware() {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
          socket.handshake.query?.token;

        if (!token) {
          return next(new Error('Authentication error: Missing token'));
        }

        const decoded = jwt.verify(String(token), this.jwtSecret) as any;
        const userId = String(decoded.sub || decoded.id || decoded._id);
        let companyId = String(decoded.companyId || decoded.cid || '');
        let userName = decoded.name || decoded.username || decoded.email || 'User';

        // Asynchronously resolve true user metadata from MongoDB
        try {
          const userDoc = await this.db.collection('users').findOne(idQuery(userId));
          if (userDoc) {
            if (userDoc.companyId) {
              companyId = String(userDoc.companyId);
            }
            userName = `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.email || userName;
          }
        } catch {}

        (socket as any).user = {
          userId,
          companyId: companyId || 'default-company',
          name: userName,
          role: decoded.role,
        };

        next();
      } catch (err: any) {
        next(new Error(`Authentication failed: ${err.message}`));
      }
    });
  }

  private setupHandlers() {
    this.io.on('connection', async (socket: Socket) => {
      const user = (socket as any).user;
      if (!user) {
        socket.disconnect();
        return;
      }

      const { userId, companyId, name } = user;

      // Track socket connection
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Join user room & company room
      socket.join(`user:${userId}`);
      if (companyId) {
        socket.join(`company:${companyId}`);
      }

      // Mark presence online
      await this.chatService.updateUserPresence(userId, true);
      this.io.emit('user_presence_changed', { userId, isOnline: true, lastSeenAt: new Date() });

      // Join conversation room with strict membership authorization
      socket.on('join_conversation', async (payload: any, ack?: any) => {
        const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
        if (!conversationId) {
          if (ack) ack({ success: false, error: 'Missing conversationId' });
          return;
        }

        const conv = await this.chatService.getConversationById(conversationId);
        if (!conv) {
          socket.emit('error', { message: 'Conversation not found' });
          if (ack) ack({ success: false, error: 'Conversation not found' });
          return;
        }

        // Authorization check: User must be a participant and in same company
        const isMember = (conv.memberIds || []).includes(userId);
        const isSameCompany = String(conv.companyId) === String(companyId);
        if (!isMember || !isSameCompany) {
          socket.emit('error', { message: 'Unauthorized: You are not a member of this conversation' });
          if (ack) ack({ success: false, error: 'Unauthorized: You are not a member of this conversation' });
          return;
        }

        socket.join(`conv:${conversationId}`);
        if (ack) ack({ success: true, conversationId });

        // Mark any delivered
        await this.chatService.markAsDelivered(companyId, conversationId, userId);
        this.io.to(`conv:${conversationId}`).emit('messages_delivered', {
          conversationId,
          userId,
          deliveredAt: new Date(),
        });
      });

      // Leave conversation room
      socket.on('leave_conversation', (payload: any, ack?: any) => {
        const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
        if (!conversationId) {
          if (ack) ack({ success: false });
          return;
        }
        socket.leave(`conv:${conversationId}`);
        if (ack) ack({ success: true });
      });

      // Send message with validation and real-time delivery calculation
      socket.on('send_message', async (data: {
        conversationId: string;
        text?: string;
        content?: string;
        type?: any;
        attachments?: any[];
        replyTo?: any;
      }, ack?: (response: any) => void) => {
        try {
          const { conversationId, text, content, type, attachments, replyTo } = data;
          if (!conversationId) {
            if (ack) ack({ success: false, error: 'Missing conversationId' });
            return;
          }

          const conv = await this.chatService.getConversationById(conversationId);
          if (!conv) {
            if (ack) ack({ success: false, error: 'Conversation not found' });
            return;
          }

          // Authorization: must be a member
          if (!conv.memberIds?.includes(userId) || String(conv.companyId) !== String(companyId)) {
            if (ack) ack({ success: false, error: 'Unauthorized: You cannot post in this conversation' });
            return;
          }

          // Determine who is currently online for immediate delivery status
          const now = new Date();
          const deliveredTo = [{ userId, deliveredAt: now }];
          if (conv.memberIds) {
            for (const memberId of conv.memberIds) {
              if (memberId !== userId && this.userSockets.has(memberId) && this.userSockets.get(memberId)!.size > 0) {
                deliveredTo.push({ userId: memberId, deliveredAt: now });
              }
            }
          }

          const message = await this.chatService.saveMessage({
            conversationId,
            companyId,
            projectId: conv.projectId || 'all',
            senderId: userId,
            senderName: name,
            type: type || 'text',
            content: content || text || '',
            attachments: attachments || [],
            replyTo,
            deliveredTo,
          });

          // Broadcast to conversation room
          this.io.to(`conv:${conversationId}`).emit('new_message', message);

          // Notify conversation participants for list re-ordering
          if (conv && conv.memberIds) {
            for (const memberId of conv.memberIds) {
              this.io.to(`user:${memberId}`).emit('conversation_updated', {
                conversationId,
                lastMessage: {
                  contentSnippet: message.content || (message.attachments?.length ? 'Attachment' : ''),
                  createdAt: message.createdAt,
                  senderId: message.senderId,
                  senderName: message.senderName,
                },
                unreadDelta: memberId === userId ? 0 : 1,
              });

              // Send in-app toast notification event & Web Push to recipients
              if (String(memberId) !== String(userId)) {
                const title = conv.type === 'group' || conv.type === 'project_group'
                  ? `${name} in ${conv.name || 'Group'}`
                  : name;
                const snippet = message.content || (message.attachments?.length ? '📎 Sent an attachment' : 'New message');

                this.io.to(`user:${memberId}`).emit('new_chat_message_notification', {
                  conversationId,
                  conversationTitle: title,
                  conversationType: conv.type,
                  senderName: name,
                  senderId: userId,
                  message,
                });

                this.notificationService.sendPushNotification(memberId, {
                  title,
                  body: snippet,
                  data: {
                    conversationId,
                    url: `/chat?conv=${conversationId}`,
                  },
                }).catch(() => {});
              }
            }
          }

          if (ack) ack({ success: true, message });
        } catch (err: any) {
          if (ack) ack({ success: false, error: err.message });
        }
      });

      // Typing indicators
      socket.on('typing_start', ({ conversationId }: { conversationId: string }) => {
        if (!conversationId) return;
        socket.to(`conv:${conversationId}`).emit('user_typing', {
          conversationId,
          userId,
          userName: name,
        });
      });

      socket.on('typing_stop', ({ conversationId }: { conversationId: string }) => {
        if (!conversationId) return;
        socket.to(`conv:${conversationId}`).emit('user_stop_typing', {
          conversationId,
          userId,
        });
      });

      // Client marks messages as read
      socket.on('mark_read', async (payload: any) => {
        const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
        if (!conversationId) return;
        try {
          await this.chatService.markAsRead(companyId, conversationId, userId);
          this.io.to(`conv:${conversationId}`).emit('messages_read', {
            conversationId,
            userId,
            readAt: new Date(),
          });
        } catch {}
      });

      // Client acknowledges message delivery
      socket.on('mark_delivered', async (payload: any) => {
        const conversationId = typeof payload === 'string' ? payload : payload?.conversationId;
        if (!conversationId) return;
        try {
          await this.chatService.markAsDelivered(companyId, conversationId, userId);
          this.io.to(`conv:${conversationId}`).emit('messages_delivered', {
            conversationId,
            userId,
            deliveredAt: new Date(),
          });
        } catch {}
      });

      // Toggle / Add reaction
      const handleReaction = async (data: { messageId: string; conversationId: string; emoji: string }) => {
        try {
          const reactions = await this.chatService.toggleReaction(companyId, data.messageId, userId, name, data.emoji);
          this.io.to(`conv:${data.conversationId}`).emit('reaction_updated', {
            messageId: data.messageId,
            reactions,
          });
        } catch {}
      };
      socket.on('toggle_reaction', handleReaction);
      socket.on('add_reaction', handleReaction);

      // Edit message
      socket.on('edit_message', async (data: { messageId: string; conversationId: string; newText?: string; text?: string }) => {
        try {
          const newText = data.newText || data.text || '';
          const updated = await this.chatService.editMessage(companyId, data.messageId, userId, newText);
          if (updated) {
            this.io.to(`conv:${data.conversationId}`).emit('message_edited', {
              messageId: data.messageId,
              text: updated.text,
              isEdited: true,
              editedAt: updated.editedAt,
            });
          }
        } catch {}
      });

      // Delete message
      socket.on('delete_message', async (data: { messageId: string; conversationId: string; deleteType: 'me' | 'everyone' }) => {
        try {
          const ok = await this.chatService.deleteMessage(companyId, data.messageId, userId, data.deleteType === 'everyone');
          if (ok) {
            this.io.to(`conv:${data.conversationId}`).emit('message_deleted', {
              messageId: data.messageId,
              deleteType: data.deleteType,
              deletedBy: userId,
            });
          }
        } catch {}
      });

      // Disconnect
      socket.on('disconnect', async () => {
        const userSet = this.userSockets.get(userId);
        if (userSet) {
          userSet.delete(socket.id);
          if (userSet.size === 0) {
            this.userSockets.delete(userId);
            // User went offline
            await this.chatService.updateUserPresence(userId, false);
            this.io.emit('user_presence_changed', {
              userId,
              isOnline: false,
              lastSeenAt: new Date(),
            });
          }
        }
      });
    });
  }
}
