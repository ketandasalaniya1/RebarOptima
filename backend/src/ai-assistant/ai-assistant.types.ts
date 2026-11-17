import { ObjectId } from 'mongodb';

export interface IAssistantConversation {
  _id?: ObjectId | string;
  companyId: string;
  userId: string;
  projectId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
}

export interface IAssistantMessage {
  _id?: ObjectId | string;
  conversationId: string;
  companyId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  category?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface IAIProviderParams {
  prompt: string;
  role: string;
  roleNormalized: string;
  userId: string;
  userName: string;
  companyId: string;
  projectId: string;
  projectName: string;
  userPermissions?: any;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  groundedContext?: any;
}

export interface IAIProviderResult {
  content: string;
  category: string;
  metadata?: Record<string, any>;
}

export interface IAIProvider {
  generateResponse(params: IAIProviderParams): Promise<IAIProviderResult>;
}

export interface IRolePromptSuggestion {
  id: string;
  title: string;
  prompt: string;
  category: string;
  icon: string;
  roles: string[];
}

