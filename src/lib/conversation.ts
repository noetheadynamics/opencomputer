/**
 * Conversation API client for OpenComputer.
 */

import type {
  Conversation,
  ConversationListResponse,
  ConversationCreateRequest,
  ConversationUpdateRequest,
  Message,
  MessageCreateRequest,
  MessageUpdateRequest,
} from '../types/conversation';
import { PHAOS_BASE } from './config';

export const conversationApi = {
  /**
   * List all conversations.
   */
  list: async (): Promise<ConversationListResponse> => {
    const res = await fetch(`${PHAOS_BASE}/api/conversations`);
    if (!res.ok) throw new Error(`Failed to list conversations: ${res.statusText}`);
    return res.json();
  },

  /**
   * Get a conversation with its messages.
   */
  get: async (id: string): Promise<Conversation> => {
    const res = await fetch(`${PHAOS_BASE}/api/conversations/${id}`);
    if (!res.ok) throw new Error(`Failed to get conversation: ${res.statusText}`);
    return res.json();
  },

  /**
   * Create a new conversation.
   */
  create: async (data: ConversationCreateRequest = {}): Promise<Conversation> => {
    const res = await fetch(`${PHAOS_BASE}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create conversation: ${res.statusText}`);
    return res.json();
  },

  /**
   * Update a conversation.
   */
  update: async (id: string, data: ConversationUpdateRequest): Promise<Conversation> => {
    const res = await fetch(`${PHAOS_BASE}/api/conversations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update conversation: ${res.statusText}`);
    return res.json();
  },

  /**
   * Delete a conversation.
   */
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${PHAOS_BASE}/api/conversations/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete conversation: ${res.statusText}`);
  },

  /**
   * Add a message to a conversation.
   */
  addMessage: async (
    conversationId: string,
    message: MessageCreateRequest
  ): Promise<Message> => {
    const res = await fetch(`${PHAOS_BASE}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!res.ok) throw new Error(`Failed to add message: ${res.statusText}`);
    return res.json();
  },

  /**
   * Update a message.
   */
  updateMessage: async (
    conversationId: string,
    messageId: string,
    data: MessageUpdateRequest
  ): Promise<Message> => {
    const res = await fetch(
      `${PHAOS_BASE}/api/conversations/${conversationId}/messages/${messageId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    if (!res.ok) throw new Error(`Failed to update message: ${res.statusText}`);
    return res.json();
  },

  /**
   * Delete a message.
   */
  deleteMessage: async (conversationId: string, messageId: string): Promise<void> => {
    const res = await fetch(
      `${PHAOS_BASE}/api/conversations/${conversationId}/messages/${messageId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error(`Failed to delete message: ${res.statusText}`);
  },

  /**
   * Search conversations.
   */
  search: async (q: string): Promise<ConversationListResponse> => {
    const res = await fetch(`${PHAOS_BASE}/api/conversations/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`Failed to search conversations: ${res.statusText}`);
    return res.json();
  },

  /**
   * Create an EventSource for streaming.
   */
  stream: (conversationId: string): EventSource => {
    return new EventSource(`${PHAOS_BASE}/api/conversations/${conversationId}/stream`);
  },
};
