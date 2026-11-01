import { ObjectId } from 'mongodb';

export type ConversationType = 'direct' | 'group' | 'project_group';

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'system';

export interface IChatAttachmentInfo {
  fileId: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  url?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
}

export interface IMessageReplyInfo {
  messageId: string;
  senderName: string;
  contentSnippet: string;
  type: MessageType;
}

export interface IMessageReaction {
  emoji: string;
  userId: string;
  userName: string;
  createdAt: Date;
}

export interface IChatConversation {
  _id?: ObjectId | string;
  companyId: string;
  projectId: string; // Associated project context
  type: ConversationType;
  name?: string; // Group title; direct chats leave this null
  description?: string;
  avatarUrl?: string;
  createdBy: string;
  adminIds: string[];
  memberIds: string[]; // Fast indexing lookup
  lastMessage?: {
    messageId: string;
    senderId: string;
    senderName: string;
    type: MessageType;
    contentSnippet: string;
    createdAt: Date;
  };
  pinnedMessageIds?: string[];
  isArchivedFor?: string[];
  isMutedFor?: Array<{ userId: string; until?: Date }>;
  pinnedFor?: string[];
  settings?: {
    onlyAdminsCanPost: boolean;
    onlyAdminsCanEditInfo: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatMessage {
  _id?: ObjectId | string;
  conversationId: string;
  companyId: string;
  projectId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: MessageType;
  content: string;
  attachments?: IChatAttachmentInfo[];
  replyTo?: IMessageReplyInfo;
  forwarded?: boolean;
  forwardedFrom?: string;
  reactions?: IMessageReaction[];
  starredBy?: string[];
  readBy?: Array<{
    userId: string;
    readAt: Date;
  }>;
  deliveredTo?: Array<{
    userId: string;
    deliveredAt: Date;
  }>;
  editedAt?: Date;
  deletedAt?: Date;
  deletedForUserIds?: string[];
  isDeletedForEveryone?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatAttachment {
  _id?: ObjectId | string;
  companyId: string;
  conversationId: string;
  uploaderId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  createdAt: Date;
}

export interface IChatUserPresence {
  _id: string; // userId
  companyId: string;
  userName: string;
  avatar?: string;
  isOnline: boolean;
  lastSeenAt: Date;
  currentConversationId?: string | null;
  typingInConversationId?: string | null;
}
