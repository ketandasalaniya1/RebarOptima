import { apiRequest } from './api';

export const aiAssistantApi = {
  getSuggestedPrompts: async () => {
    return apiRequest('/ai-assistant/suggested-prompts');
  },

  getConversations: async (projectId = '') => {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return apiRequest(`/ai-assistant/conversations${q}`);
  },

  createConversation: async (projectId = '', title = 'New Conversation') => {
    return apiRequest('/ai-assistant/conversations', {
      method: 'POST',
      body: { projectId, title },
    });
  },

  getConversation: async (conversationId) => {
    return apiRequest(`/ai-assistant/conversations/${conversationId}`);
  },

  getMessages: async (conversationId) => {
    return apiRequest(`/ai-assistant/conversations/${conversationId}/messages`);
  },

  sendMessage: async (conversationId, prompt, projectId = '') => {
    return apiRequest(`/ai-assistant/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { prompt, projectId },
    });
  },

  deleteConversation: async (conversationId) => {
    return apiRequest(`/ai-assistant/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  },
};

