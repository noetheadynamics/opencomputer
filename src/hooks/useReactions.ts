import { useState, useCallback } from 'react';
import { toggleReaction } from '../lib/reactions';
import type { ChatReaction } from '../types/chat';

export function useReactions() {
  const [reactionsMap, setReactionsMap] = useState<Record<string, ChatReaction[]>>({});

  const toggle = useCallback((messageId: string, emoji: string) => {
    setReactionsMap((prev) => {
      const current = prev[messageId] || [];
      return { ...prev, [messageId]: toggleReaction(current, emoji) };
    });
  }, []);

  const getReactions = useCallback(
    (messageId: string): ChatReaction[] => {
      return reactionsMap[messageId] || [];
    },
    [reactionsMap]
  );

  return { reactionsMap, toggle, getReactions };
}
