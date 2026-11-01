import { Db, ObjectId } from 'mongodb';
import {
  IChatConversation,
  IChatMessage,
  ConversationType,
  MessageType,
  IChatAttachmentInfo,
  IMessageReplyInfo,
} from './chat.types';

export function toObjectId(id: any): ObjectId | null {
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

export function idQuery(id: any): any {
  if (!id) return { _id: id };
  if (id instanceof ObjectId) return { _id: id };
  const objId = toObjectId(id);
  if (objId) {
    return { $or: [{ _id: objId }, { _id: String(id) }] };
  }
  return { _id: String(id) };
}

export function companyFilter(companyId: any): any {
  if (!companyId) return {};
  const objId = toObjectId(companyId);
  if (objId) {
    return { $or: [{ companyId: objId }, { companyId: String(companyId) }] };
  }
  return { companyId: String(companyId) };
}

export class ChatService {
  constructor(private db: Db) {}

  /**
   * Get or create a 1-on-1 direct conversation between two users
   */
  async getOrCreateDirectConversation(
    companyId: string,
    projectId: string,
    userAId: string,
    userBId: string
  ): Promise<IChatConversation> {
    if (userAId === userBId) {
      throw new Error('Cannot start a direct conversation with yourself.');
    }

    const members = [String(userAId), String(userBId)].sort();

    const query: any = {
      ...companyFilter(companyId),
      type: 'direct',
      memberIds: { $all: members, $size: 2 },
    };
    if (projectId && projectId !== 'all') {
      query.projectId = String(projectId);
    }
    const existing = await this.db.collection('chat_conversations').findOne(query);

    if (existing) {
      return existing as unknown as IChatConversation;
    }

    const now = new Date();
    const newConv: IChatConversation = {
      companyId: String(companyId),
      projectId: String(projectId || 'all'),
      type: 'direct',
      createdBy: String(userAId),
      adminIds: members,
      memberIds: members,
      createdAt: now,
      updatedAt: now,
    };

    const res = await this.db.collection('chat_conversations').insertOne(newConv as any);
    newConv._id = res.insertedId;
    return newConv;
  }

  /**
   * Create a new group or project group conversation
   */
  async createGroupConversation(params: {
    companyId: string;
    projectId: string;
    creatorId: string;
    creatorName: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    memberIds: string[];
    type?: ConversationType;
  }): Promise<IChatConversation> {
    const {
      companyId,
      projectId,
      creatorId,
      creatorName,
      name,
      description,
      avatarUrl,
      memberIds,
      type = 'group',
    } = params;

    if (!name || !name.trim()) {
      throw new Error('Group name is required.');
    }

    const uniqueMembers = Array.from(new Set([String(creatorId), ...memberIds.map(String)]));
    const now = new Date();

    const newConv: IChatConversation = {
      companyId: String(companyId),
      projectId: String(projectId || 'all'),
      type,
      name: name.trim(),
      description: description?.trim() || '',
      avatarUrl: avatarUrl || '',
      createdBy: String(creatorId),
      adminIds: [String(creatorId)],
      memberIds: uniqueMembers,
      settings: {
        onlyAdminsCanPost: false,
        onlyAdminsCanEditInfo: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    const res = await this.db.collection('chat_conversations').insertOne(newConv as any);
    newConv._id = res.insertedId;

    // Insert initial system message
    const sysMsg: IChatMessage = {
      conversationId: res.insertedId.toString(),
      companyId: String(companyId),
      projectId: String(projectId || 'all'),
      senderId: 'system',
      senderName: 'System',
      type: 'system',
      content: `${creatorName} created the group "${name.trim()}".`,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collection('chat_messages').insertOne(sysMsg as any);

    return newConv;
  }

  /**
   * List all conversations for user in project/company scope
   */
  async getUserConversations(
    companyId: string,
    projectId: string,
    userId: string
  ): Promise<any[]> {
    const query: any = {
      ...companyFilter(companyId),
      memberIds: String(userId),
    };

    if (projectId && projectId !== 'all') {
      query.projectId = String(projectId);
    }

    const convs = await this.db
      .collection('chat_conversations')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();

    // Enrich direct conversations with other member's profile
    const enriched = await Promise.all(
      convs.map(async (conv: any) => {
        let displayName = conv.name;
        let displayAvatar = conv.avatarUrl;
        let isOnline = false;
        let otherUserId: string | null = null;

        if (conv.type === 'direct') {
          const otherId = (conv.memberIds || []).find((m: string) => m !== String(userId));
          if (otherId) {
            otherUserId = otherId;
            const u = await this.db.collection('users').findOne(idQuery(otherId));
            if (u) {
              displayName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
              displayAvatar = u.avatar || null;
            }
            const presence = await this.db.collection('chat_user_presence').findOne({ _id: otherId });
            isOnline = presence?.isOnline === true;
          }
        }

        // Calculate unread count for this user
        const unreadCount = await this.db.collection('chat_messages').countDocuments({
          conversationId: conv._id.toString(),
          senderId: { $ne: String(userId) },
          'readBy.userId': { $ne: String(userId) },
        });

        return {
          ...conv,
          id: conv._id.toString(),
          displayName: displayName || 'Unnamed Chat',
          displayAvatar,
          isOnline,
          otherUserId,
          unreadCount,
          isPinned: (conv.pinnedFor || []).includes(String(userId)),
          isArchived: (conv.isArchivedFor || []).includes(String(userId)),
        };
      })
    );

    return enriched;
  }

  /**
   * Fetch paginated message history for a conversation
   */
  async getMessages(
    companyId: string,
    conversationId: string,
    userId: string,
    limit = 50,
    beforeMessageId?: string
  ): Promise<IChatMessage[]> {
    // Verify user is a member
    const conv = await this.db.collection('chat_conversations').findOne({
      ...idQuery(conversationId),
      ...companyFilter(companyId),
      memberIds: String(userId),
    });

    if (!conv) {
      throw new Error('Access denied: You are not a participant in this conversation.');
    }

    const query: any = {
      conversationId: String(conversationId),
      deletedForUserIds: { $ne: String(userId) },
    };

    if (beforeMessageId) {
      const target = await this.db.collection('chat_messages').findOne(idQuery(beforeMessageId));
      if (target) {
        query.createdAt = { $lt: target.createdAt };
      }
    }

    const messages = await this.db
      .collection('chat_messages')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return messages.reverse().map((m: any) => ({
      ...m,
      id: m._id.toString(),
      content: m.isDeletedForEveryone ? 'This message was deleted' : m.content,
      attachments: m.isDeletedForEveryone ? [] : m.attachments,
    })) as IChatMessage[];
  }

  /**
   * Save a new message and update the conversation's lastMessage preview
   */
  async saveMessage(params: {
    companyId: string;
    projectId: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    type?: MessageType;
    content: string;
    attachments?: IChatAttachmentInfo[];
    replyTo?: IMessageReplyInfo;
    deliveredTo?: Array<{ userId: string; deliveredAt: Date }>;
  }): Promise<IChatMessage> {
    const {
      companyId,
      projectId,
      conversationId,
      senderId,
      senderName,
      senderAvatar,
      type = 'text',
      content,
      attachments,
      replyTo,
      deliveredTo,
    } = params;

    const now = new Date();

    const newMsg: IChatMessage = {
      conversationId: String(conversationId),
      companyId: String(companyId),
      projectId: String(projectId || 'all'),
      senderId: String(senderId),
      senderName: senderName || 'User',
      senderAvatar,
      type,
      content: (content || '').trim(),
      attachments: attachments || [],
      replyTo,
      readBy: [{ userId: String(senderId), readAt: now }],
      deliveredTo: deliveredTo || [{ userId: String(senderId), deliveredAt: now }],
      createdAt: now,
      updatedAt: now,
    };

    const res = await this.db.collection('chat_messages').insertOne(newMsg as any);
    newMsg._id = res.insertedId;

    // Snippet for conversation preview
    let snippet = newMsg.content;
    if (type === 'image') snippet = '📷 Photo';
    else if (type === 'video') snippet = '📹 Video';
    else if (type === 'audio') snippet = '🎤 Voice note';
    else if (type === 'document') snippet = `📄 ${attachments?.[0]?.name || 'Document'}`;

    await this.db.collection('chat_conversations').updateOne(
      idQuery(conversationId),
      {
        $set: {
          lastMessage: {
            messageId: res.insertedId.toString(),
            senderId: String(senderId),
            senderName,
            type,
            contentSnippet: snippet.substring(0, 100),
            createdAt: now,
          },
          updatedAt: now,
        },
      }
    );

    return newMsg;
  }

  /**
   * Mark all unread messages in a conversation as read by the user
   */
  async markAsRead(
    companyId: string,
    conversationId: string,
    userId: string
  ): Promise<number> {
    const now = new Date();
    const result = await this.db.collection('chat_messages').updateMany(
      {
        conversationId: String(conversationId),
        senderId: { $ne: String(userId) },
        'readBy.userId': { $ne: String(userId) },
      },
      {
        $push: {
          readBy: { userId: String(userId), readAt: now } as any,
          deliveredTo: { userId: String(userId), deliveredAt: now } as any,
        },
      }
    );

    return result.modifiedCount;
  }

  /**
   * Mark messages as delivered
   */
  async markAsDelivered(
    companyId: string,
    conversationId: string,
    userId: string
  ): Promise<number> {
    const now = new Date();
    const result = await this.db.collection('chat_messages').updateMany(
      {
        conversationId: String(conversationId),
        senderId: { $ne: String(userId) },
        'deliveredTo.userId': { $ne: String(userId) },
      },
      {
        $push: {
          deliveredTo: { userId: String(userId), deliveredAt: now } as any,
        },
      }
    );

    return result.modifiedCount;
  }

  /**
   * Toggle emoji reaction on a message
   */
  async toggleReaction(
    companyId: string,
    messageId: string,
    userId: string,
    userName: string,
    emoji: string
  ): Promise<any> {
    const msg = await this.db.collection('chat_messages').findOne(idQuery(messageId));
    if (!msg) throw new Error('Message not found');

    const existingReactions = (msg.reactions || []) as any[];
    // WhatsApp Rule: Each user can only have at most ONE reaction per message
    const userPrevReaction = existingReactions.find((r) => String(r.userId) === String(userId));

    let updatedReactions: any[];
    if (userPrevReaction && userPrevReaction.emoji === emoji) {
      // Clicking the same emoji removes it (toggle off)
      updatedReactions = existingReactions.filter((r) => String(r.userId) !== String(userId));
    } else {
      // Clicking a different emoji replaces previous reaction or adds new
      updatedReactions = [
        ...existingReactions.filter((r) => String(r.userId) !== String(userId)),
        {
          emoji,
          userId: String(userId),
          userName,
          createdAt: new Date(),
        },
      ];
    }

    await this.db.collection('chat_messages').updateOne(
      idQuery(messageId),
      { $set: { reactions: updatedReactions, updatedAt: new Date() } }
    );

    return updatedReactions;
  }

  /**
   * Get single conversation by ID
   */
  async getConversationById(conversationId: string): Promise<any | null> {
    return this.db.collection('chat_conversations').findOne(idQuery(conversationId));
  }

  /**
   * Update user presence status
   */
  async updateUserPresence(userId: string, isOnline: boolean): Promise<void> {
    const now = new Date();
    await this.db.collection('chat_user_presence').updateOne(
      { _id: String(userId) as any },
      {
        $set: {
          isOnline,
          lastSeenAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  /**
   * Edit a sent message
   */
  async editMessage(
    companyId: string,
    messageId: string,
    userId: string,
    newContent: string
  ): Promise<{ text: string; editedAt: Date }> {
    const msg = await this.db.collection('chat_messages').findOne(idQuery(messageId));
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== String(userId)) throw new Error('You can only edit your own messages');

    const editedAt = new Date();
    await this.db.collection('chat_messages').updateOne(
      idQuery(messageId),
      {
        $set: {
          content: newContent.trim(),
          editedAt,
          updatedAt: editedAt,
        },
      }
    );

    return { text: newContent.trim(), editedAt };
  }

  /**
   * Delete message
   */
  async deleteMessage(
    companyId: string,
    messageId: string,
    userId: string,
    forEveryone = false
  ): Promise<boolean> {
    const msg = await this.db.collection('chat_messages').findOne(idQuery(messageId));
    if (!msg) throw new Error('Message not found');

    if (forEveryone) {
      if (msg.senderId !== String(userId)) {
        throw new Error('Only the sender can delete a message for everyone');
      }
      await this.db.collection('chat_messages').updateOne(
        idQuery(messageId),
        {
          $set: {
            isDeletedForEveryone: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
    } else {
      await this.db.collection('chat_messages').updateOne(
        idQuery(messageId),
        {
          $addToSet: { deletedForUserIds: String(userId) },
        }
      );
    }
    return true;
  }

  /**
   * Toggle Pin conversation for user
   */
  async togglePinConversation(
    companyId: string,
    conversationId: string,
    userId: string
  ): Promise<{ isPinned: boolean }> {
    const conv = await this.db.collection('chat_conversations').findOne({
      ...idQuery(conversationId),
      memberIds: String(userId),
    });
    if (!conv) throw new Error('Conversation not found or access denied');

    const pinnedFor: string[] = conv.pinnedFor || [];
    const isCurrentlyPinned = pinnedFor.includes(String(userId));
    const nextPinned = !isCurrentlyPinned;

    if (isCurrentlyPinned) {
      await this.db.collection('chat_conversations').updateOne(
        idQuery(conversationId),
        { $pull: { pinnedFor: String(userId) } as any }
      );
    } else {
      await this.db.collection('chat_conversations').updateOne(
        idQuery(conversationId),
        { $addToSet: { pinnedFor: String(userId) } as any }
      );
    }

    return { isPinned: nextPinned };
  }

  /**
   * Toggle Pin message in conversation
   */
  async togglePinMessage(
    companyId: string,
    conversationId: string,
    userId: string,
    messageId: string
  ): Promise<{ pinnedMessageIds: string[]; isPinned: boolean }> {
    const conv = await this.db.collection('chat_conversations').findOne({
      ...idQuery(conversationId),
      memberIds: String(userId),
    });
    if (!conv) throw new Error('Conversation not found or access denied');

    const pinnedMessageIds: string[] = conv.pinnedMessageIds || [];
    const isCurrentlyPinned = pinnedMessageIds.includes(String(messageId));
    let nextPinnedIds: string[];

    if (isCurrentlyPinned) {
      nextPinnedIds = pinnedMessageIds.filter((id) => id !== String(messageId));
      await this.db.collection('chat_conversations').updateOne(
        idQuery(conversationId),
        { $pull: { pinnedMessageIds: String(messageId) } as any }
      );
    } else {
      nextPinnedIds = [...pinnedMessageIds, String(messageId)];
      await this.db.collection('chat_conversations').updateOne(
        idQuery(conversationId),
        { $addToSet: { pinnedMessageIds: String(messageId) } as any }
      );
    }

    return { pinnedMessageIds: nextPinnedIds, isPinned: !isCurrentlyPinned };
  }

  /**
   * Toggle Star message for user
   */
  async toggleStarMessage(
    companyId: string,
    messageId: string,
    userId: string
  ): Promise<{ isStarred: boolean; starredBy: string[] }> {
    const msg = await this.db.collection('chat_messages').findOne(idQuery(messageId));
    if (!msg) throw new Error('Message not found');

    const starredBy: string[] = msg.starredBy || [];
    const isCurrentlyStarred = starredBy.includes(String(userId));
    const nextStarred = !isCurrentlyStarred;
    let nextStarredBy: string[];

    if (isCurrentlyStarred) {
      nextStarredBy = starredBy.filter((id) => id !== String(userId));
      await this.db.collection('chat_messages').updateOne(
        idQuery(messageId),
        { $pull: { starredBy: String(userId) } as any }
      );
    } else {
      nextStarredBy = [...starredBy, String(userId)];
      await this.db.collection('chat_messages').updateOne(
        idQuery(messageId),
        { $addToSet: { starredBy: String(userId) } as any }
      );
    }

    return { isStarred: nextStarred, starredBy: nextStarredBy };
  }

  /**
   * Group Administration: Add member
   */
  async addGroupMember(
    companyId: string,
    conversationId: string,
    adminUserId: string,
    newUserId: string
  ): Promise<IChatConversation> {
    const conv = await this.db.collection('chat_conversations').findOne({
      ...idQuery(conversationId),
      ...companyFilter(companyId),
    });
    if (!conv) throw new Error('Conversation not found');
    if (!conv.adminIds?.includes(String(adminUserId))) {
      throw new Error('Only group administrators can add members');
    }

    const now = new Date();
    await this.db.collection('chat_conversations').updateOne(
      idQuery(conversationId),
      {
        $addToSet: { memberIds: String(newUserId) },
        $set: { updatedAt: now },
      }
    );

    const userDoc = await this.db.collection('users').findOne(idQuery(newUserId));
    const memberName = userDoc ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.email : 'New member';
    await this.saveMessage({
      conversationId,
      companyId,
      projectId: conv.projectId || 'all',
      senderId: 'system',
      senderName: 'System',
      type: 'system',
      content: `${memberName} was added to the group.`,
    });

    const updated = await this.db.collection('chat_conversations').findOne(idQuery(conversationId));
    return updated as any;
  }

  /**
   * Group Administration: Remove member
   */
  async removeGroupMember(
    companyId: string,
    conversationId: string,
    adminUserId: string,
    targetUserId: string
  ): Promise<IChatConversation> {
    const conv = await this.db.collection('chat_conversations').findOne({
      ...idQuery(conversationId),
      ...companyFilter(companyId),
    });
    if (!conv) throw new Error('Conversation not found');
    if (!conv.adminIds?.includes(String(adminUserId))) {
      throw new Error('Only group administrators can remove members');
    }

    const now = new Date();
    await this.db.collection('chat_conversations').updateOne(
      idQuery(conversationId),
      {
        $pull: { memberIds: String(targetUserId), adminIds: String(targetUserId) } as any,
        $set: { updatedAt: now },
      }
    );

    const userDoc = await this.db.collection('users').findOne(idQuery(targetUserId));
    const memberName = userDoc ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.email : 'Member';
    await this.saveMessage({
      conversationId,
      companyId,
      projectId: conv.projectId || 'all',
      senderId: 'system',
      senderName: 'System',
      type: 'system',
      content: `${memberName} was removed from the group.`,
    });

    const updated = await this.db.collection('chat_conversations').findOne(idQuery(conversationId));
    return updated as any;
  }

  /**
   * Group Administration: Update subject/info
   */
  async updateGroupInfo(
    companyId: string,
    conversationId: string,
    adminUserId: string,
    updates: { name?: string; description?: string; avatarUrl?: string }
  ): Promise<IChatConversation> {
    const conv = await this.db.collection('chat_conversations').findOne({
      ...idQuery(conversationId),
      ...companyFilter(companyId),
    });
    if (!conv) throw new Error('Conversation not found');
    if (!conv.adminIds?.includes(String(adminUserId))) {
      throw new Error('Only group administrators can edit group info');
    }

    const setFields: any = { updatedAt: new Date() };
    if (updates.name && updates.name.trim()) setFields.name = updates.name.trim();
    if (updates.description !== undefined) setFields.description = updates.description.trim();
    if (updates.avatarUrl !== undefined) setFields.avatarUrl = updates.avatarUrl;

    await this.db.collection('chat_conversations').updateOne(
      idQuery(conversationId),
      { $set: setFields }
    );

    const updated = await this.db.collection('chat_conversations').findOne(idQuery(conversationId));
    return updated as any;
  }

  /**
   * Leave group
   */
  async leaveGroup(
    companyId: string,
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    const conv = await this.db.collection('chat_conversations').findOne({
      ...idQuery(conversationId),
      ...companyFilter(companyId),
      memberIds: String(userId),
    });
    if (!conv) throw new Error('Conversation not found or you are not a member');

    const now = new Date();
    await this.db.collection('chat_conversations').updateOne(
      idQuery(conversationId),
      {
        $pull: { memberIds: String(userId), adminIds: String(userId) } as any,
        $set: { updatedAt: now },
      }
    );

    const userDoc = await this.db.collection('users').findOne(idQuery(userId));
    const memberName = userDoc ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.email : 'A member';
    await this.saveMessage({
      conversationId,
      companyId,
      projectId: conv.projectId || 'all',
      senderId: 'system',
      senderName: 'System',
      type: 'system',
      content: `${memberName} left the group.`,
    });

    return true;
  }

  /**
   * Search message contents within user's conversations
   */
  async searchMessages(
    companyId: string,
    userId: string,
    queryText: string,
    conversationId?: string
  ): Promise<any[]> {
    if (!queryText || !queryText.trim()) return [];

    const reg = new RegExp(queryText.trim(), 'i');
    const filter: any = {
      ...companyFilter(companyId),
      deletedForUserIds: { $ne: String(userId) },
      isDeletedForEveryone: { $ne: true },
      content: reg,
    };

    if (conversationId) {
      filter.conversationId = String(conversationId);
    } else {
      const userConvs = await this.db.collection('chat_conversations').find({
        ...companyFilter(companyId),
        memberIds: String(userId),
      }).project({ _id: 1 }).toArray();

      const convIds = userConvs.map((c) => c._id.toString());
      filter.conversationId = { $in: convIds };
    }

    const msgs = await this.db
      .collection('chat_messages')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    return msgs.map((m: any) => ({
      ...m,
      id: m._id.toString(),
    }));
  }

  /**
   * Search colleagues in company & project to start direct chats
   */
  async getDirectChatCandidates(
    companyId: string,
    projectId: string,
    currentUserId: string,
    search?: string
  ): Promise<any[]> {
    const query: any = {
      ...companyFilter(companyId),
      isActive: { $ne: false },
      _id: { $nin: [toObjectId(currentUserId), String(currentUserId)].filter(Boolean) },
    };

    if (projectId && projectId !== 'all' && projectId !== 'undefined' && projectId !== 'null') {
      const pIdStr = String(projectId);
      const pIdObj = toObjectId(pIdStr);
      const projectScope = {
        $or: [
          { assignedProjects: { $in: [pIdStr, pIdObj].filter(Boolean) } },
          { projectId: { $in: [pIdStr, pIdObj].filter(Boolean) } },
          { assignedProject: { $in: [pIdStr, pIdObj].filter(Boolean) } },
        ],
      };
      if (search && search.trim()) {
        const reg = new RegExp(search.trim(), 'i');
        query.$and = [
          projectScope,
          {
            $or: [
              { firstName: reg },
              { lastName: reg },
              { email: reg },
            ],
          },
        ];
      } else {
        Object.assign(query, projectScope);
      }
    } else if (search && search.trim()) {
      const reg = new RegExp(search.trim(), 'i');
      query.$or = [
        { firstName: reg },
        { lastName: reg },
        { email: reg },
      ];
    }

    const users = await this.db
      .collection('users')
      .find(query)
      .project({ firstName: 1, lastName: 1, email: 1, role: 1, avatar: 1, mobileNumber: 1 })
      .limit(30)
      .toArray();

    return users.map((u: any) => ({
      id: u._id.toString(),
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
      email: u.email,
      role: u.role || 'Member',
      avatar: u.avatar || null,
      mobileNumber: u.mobileNumber || '',
    }));
  }
}
