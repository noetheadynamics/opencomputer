import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare } from 'lucide-react';
import { ChatBubble } from './ChatBubble';
import type { ChatMessage, Thread } from '../../types/chat';

interface ChatThreadProps {
  thread: Thread;
  allMessages: ChatMessage[];
  onClose: () => void;
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onCopy: (content: string) => void;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  thread,
  allMessages,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onCopy,
}) => {
  const parentMessage = allMessages.find((m) => m.id === thread.parentMessageId);
  if (!parentMessage) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-96 bg-oc-bg/95 backdrop-blur-lg border-l border-oc-surface-border z-40 flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-oc-surface-border">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-oc-accent" />
            <span className="text-sm font-medium text-oc-text-primary">Thread</span>
            <span className="text-xs text-oc-text-secondary">({thread.messages.length} replies)</span>
          </div>
          <button onClick={onClose} className="text-oc-text-secondary hover:text-oc-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <ChatBubble
            message={parentMessage}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onReact={onReact}
            onCopy={onCopy}
          />
          <div className="border-t border-oc-surface-border my-2" />
          {thread.messages.map((msg, i) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              isFirstInGroup={i === 0 || thread.messages[i - 1].role !== msg.role}
              isLastInGroup={i === thread.messages.length - 1 || thread.messages[i + 1]?.role !== msg.role}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
              onCopy={onCopy}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
