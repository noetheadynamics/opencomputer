/**
 * Hook for managing messages in a conversation.
 */

import { useState, useCallback } from 'react';
import type { Message } from '../types/conversation';
import { conversationApi } from '../lib/conversation';

interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: string | null;
  load: (conversationId: string) => Promise<Message[]>;
  addMessage: (conversationId: string, role: 'user' | 'assistant' | 'system', content: string) => Promise<Message>;
  updateMessage: (conversationId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  clear: () => void;
}

export function useMessages(): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (conversationId: string): Promise<Message[]> => {
    try {
      setLoading(true);
      setError(null);
      const conv = await conversationApi.get(conversationId);
      const msgs = conv.messages || [];
      setMessages(msgs);
      return msgs;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const addMessage = useCallback(async (
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<Message> => {
    try {
      setError(null);
      const msg = await conversationApi.addMessage(conversationId, { role, content });
      setMessages((prev) => [...prev, msg]);
      return msg;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add message');
      throw err;
    }
  }, []);

  const updateMessage = useCallback(async (
    conversationId: string,
    messageId: string,
    content: string
  ) => {
    try {
      setError(null);
      await conversationApi.updateMessage(conversationId, messageId, { content });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update message');
    }
  }, []);

  const deleteMessage = useCallback(async (conversationId: string, messageId: string) => {
    try {
      setError(null);
      await conversationApi.deleteMessage(conversationId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message');
    }
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    loading,
    error,
    load,
    addMessage,
    updateMessage,
    deleteMessage,
    clear,
  };
}
