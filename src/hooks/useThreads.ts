import { useState, useCallback } from 'react';
import type { Thread, ChatMessage } from '../types/chat';

export function useThreads(_messages?: ChatMessage[]) {
  const [activeThread, setActiveThread] = useState<Thread | null>(null);

  const createThread = useCallback((parentMessageId: string) => {
    const thread: Thread = {
      id: `thread_${Date.now()}`,
      parentMessageId,
      messages: [],
      replyCount: 0,
    };
    setActiveThread(thread);
    return thread;
  }, []);

  const addReply = useCallback((message: ChatMessage) => {
    setActiveThread((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, message], replyCount: prev.replyCount + 1 }
        : prev
    );
  }, []);

  const closeThread = useCallback(() => {
    setActiveThread(null);
  }, []);

  const getThreadForMessage = useCallback(
    (messageId: string): Thread | undefined => {
      return activeThread?.parentMessageId === messageId ? activeThread : undefined;
    },
    [activeThread]
  );

  return { activeThread, createThread, addReply, closeThread, getThreadForMessage };
}
