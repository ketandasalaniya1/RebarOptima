import { Db, ObjectId } from 'mongodb';
import { IAssistantConversation, IAssistantMessage, IAIProvider } from './ai-assistant.types';
import { MockAIProvider } from './mock-ai.provider';

export function idQuery(id: string): any {
  if (ObjectId.isValid(String(id)) && String(id).length === 24) {
    return { $or: [{ _id: new ObjectId(String(id)) }, { _id: String(id) }] };
  }
  return { _id: String(id) };
}

export class AiAssistantService {
  private db: Db;
  private provider: IAIProvider;

  constructor(db: Db, provider?: IAIProvider) {
    this.db = db;
    this.provider = provider || new MockAIProvider();
  }

  private conversationsCol() {
    return this.db.collection('ai_conversations');
  }

  private messagesCol() {
    return this.db.collection('ai_messages');
  }

  /**
   * List conversations for the given user, company and optional project
   */
  async listConversations(companyId: string, userId: string, projectId?: string) {
    const query: any = {
      companyId: String(companyId),
      userId: String(userId),
    };

    if (projectId && projectId !== 'all' && projectId !== 'null' && projectId !== 'undefined') {
      query.projectId = String(projectId);
    }

    const conversations = await this.conversationsCol()
      .find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1, createdAt: -1 })
      .limit(50)
      .toArray();

    return conversations.map((c: any) => ({
      ...c,
      _id: c._id.toString(),
    }));
  }

  /**
   * Create a new conversation session
   */
  async createConversation(
    companyId: string,
    userId: string,
    projectId: string,
    title?: string
  ): Promise<IAssistantConversation> {
    const now = new Date();
    const doc: IAssistantConversation = {
      companyId: String(companyId),
      userId: String(userId),
      projectId: String(projectId || 'default'),
      title: (title || 'New Conversation').trim().slice(0, 100),
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: 0,
    };

    const res = await this.conversationsCol().insertOne(doc as any);
    return {
      ...doc,
      _id: res.insertedId.toString(),
    };
  }

  /**
   * Get single conversation verifying ownership
   */
  async getConversation(conversationId: string, companyId: string, userId: string): Promise<any> {
    const filter: any = {
      ...idQuery(conversationId),
      companyId: String(companyId),
      userId: String(userId),
    };

    const conv = await this.conversationsCol().findOne(filter);
    if (!conv) return null;
    return {
      ...conv,
      _id: conv._id.toString(),
    };
  }

  /**
   * Get all messages for a conversation
   */
  async getMessages(conversationId: string, companyId: string, userId: string) {
    const conv = await this.getConversation(conversationId, companyId, userId);
    if (!conv) {
      throw new Error('Conversation not found or unauthorized');
    }

    const messages = await this.messagesCol()
      .find({
        conversationId: String(conversationId),
        companyId: String(companyId),
      })
      .sort({ createdAt: 1 })
      .toArray();

    return messages.map((m: any) => ({
      ...m,
      _id: m._id.toString(),
    }));
  }

  /**
   * Send a user prompt, retrieve ground-truth database records, and generate AI response
   */
  async sendMessage(params: {
    conversationId: string;
    companyId: string;
    userId: string;
    userName: string;
    role: string;
    roleNormalized: string;
    projectId: string;
    projectName: string;
    prompt: string;
    userPermissions?: any;
    groundedContext?: any;
    logAuditFn?: any;
  }) {
    const {
      conversationId,
      companyId,
      userId,
      userName,
      role,
      roleNormalized,
      projectId,
      projectName,
      prompt,
      userPermissions,
      groundedContext,
      logAuditFn,
    } = params;

    const conv = await this.getConversation(conversationId, companyId, userId);
    if (!conv) {
      throw new Error('Conversation not found or unauthorized');
    }

    const now = new Date();

    // 1. Insert user message
    const userMsgDoc: IAssistantMessage = {
      conversationId: String(conversationId),
      companyId: String(companyId),
      userId: String(userId),
      role: 'user',
      content: prompt.trim(),
      createdAt: now,
    };
    const userMsgRes = await this.messagesCol().insertOne(userMsgDoc as any);
    const savedUserMsg = { ...userMsgDoc, _id: userMsgRes.insertedId.toString() };

    // 2. Fetch recent conversation history for context
    const recentMessages = await this.messagesCol()
      .find({ conversationId: String(conversationId) })
      .sort({ createdAt: 1 })
      .limit(10)
      .toArray();

    const conversationHistory = recentMessages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 3. Generate response via AI provider with ground-truth database context
    const aiResult = await this.provider.generateResponse({
      prompt: prompt.trim(),
      role,
      roleNormalized,
      userId,
      userName,
      companyId,
      projectId: groundedContext?.projectId || projectId,
      projectName: groundedContext?.projectName || projectName,
      userPermissions,
      conversationHistory,
      groundedContext,
    });

    const assistantMetadata = {
      ...(aiResult.metadata || {}),
      sources: groundedContext?.sources || aiResult.metadata?.sources || [],
      warnings: groundedContext?.warnings || aiResult.metadata?.warnings || [],
      asOf: groundedContext?.asOf || new Date().toISOString(),
      projectId: groundedContext?.projectId || projectId,
      projectName: groundedContext?.projectName || projectName,
      groundingStatus: 'verified_database',
    };

    // 4. Insert assistant message
    const assistantMsgDoc: IAssistantMessage = {
      conversationId: String(conversationId),
      companyId: String(companyId),
      userId: String(userId),
      role: 'assistant',
      content: aiResult.content,
      category: aiResult.category,
      metadata: assistantMetadata,
      createdAt: new Date(),
    };
    const assistantMsgRes = await this.messagesCol().insertOne(assistantMsgDoc as any);
    const savedAssistantMsg = { ...assistantMsgDoc, _id: assistantMsgRes.insertedId.toString() };

    // 5. Update conversation metadata and title if still default
    let newTitle: string = conv.title;
    if (conv.title === 'New Conversation' || !conv.title) {
      newTitle = prompt.slice(0, 45).trim() + (prompt.length > 45 ? '…' : '');
    }

    await this.conversationsCol().updateOne(idQuery(conversationId), {
      $set: {
        title: newTitle,
        updatedAt: new Date(),
        lastMessageAt: new Date(),
      },
      $inc: { messageCount: 2 },
    });

    // 6. Audit log
    if (logAuditFn) {
      try {
        await logAuditFn(this.db, {
          actorId: userId,
          actorType: 'user',
          actorName: userName,
          actorRole: role,
          companyId,
          projectId: groundedContext?.projectId || projectId,
          module: 'ai-assistant',
          action: 'CHAT_INTERACTION',
          resource: 'ai_conversations',
          resourceId: conversationId,
          description: `AI Assistant prompt on "${groundedContext?.projectName || projectName}": "${prompt.slice(0, 80)}" [Category: ${aiResult.category}]`,
        });
      } catch (e) {
        // Non-blocking
      }
    }

    return {
      userMessage: savedUserMsg,
      assistantMessage: savedAssistantMsg,
      conversationTitle: newTitle,
      groundedContext: {
        projectId: groundedContext?.projectId || projectId,
        projectName: groundedContext?.projectName || projectName,
        asOf: groundedContext?.asOf,
        sources: groundedContext?.sources || [],
        warnings: groundedContext?.warnings || [],
      },
    };
  }

  /**
   * Delete conversation and all its messages
   */
  async deleteConversation(conversationId: string, companyId: string, userId: string) {
    const conv = await this.getConversation(conversationId, companyId, userId);
    if (!conv) {
      throw new Error('Conversation not found or unauthorized');
    }

    await this.messagesCol().deleteMany({
      conversationId: String(conversationId),
      companyId: String(companyId),
    });

    const deleteFilter: any = {
      ...idQuery(conversationId),
      companyId: String(companyId),
      userId: String(userId),
    };

    await this.conversationsCol().deleteOne(deleteFilter);

    return true;
  }
}
