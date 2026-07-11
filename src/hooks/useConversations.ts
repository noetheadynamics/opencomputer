/**
 * Hook for managing conversations.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Conversation } from '../types/conversation';
import { conversationApi } from '../lib/conversation';

interface UseConversationsReturn {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (title?: string) => Promise<Conversation>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setActiveId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await conversationApi.list();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (title?: string): Promise<Conversation> => {
    try {
      setError(null);
      const conv = await conversationApi.create({ title: title || 'New Chat' });
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      return conv;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      throw err;
    }
  }, []);

  const rename = useCallback(async (id: string, title: string) => {
    try {
      setError(null);
      await conversationApi.update(id, { title });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename conversation');
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      setError(null);
      await conversationApi.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }, [activeId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    conversations,
    activeId,
    loading,
    error,
    load,
    create,
    rename,
    remove,
    setActiveId,
    refresh: load,
  };
}
