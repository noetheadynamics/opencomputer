/**
 * Single conversation item in the list.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Trash2, Pencil } from 'lucide-react';
import type { Conversation } from '../../types/conversation';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
  onRename,
  onDelete,
}) => {
  return (
    <motion.div
      layout
      whileHover={{ x: 2 }}
      className={`group flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-colors ${
        isActive
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'hover:bg-zinc-800/50'
      }`}
      onClick={onClick}
    >
      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-100 truncate">
          {conversation.title}
        </div>
        <div className="text-xs text-zinc-500 truncate">
          {formatTimestamp(conversation.updated_at)}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onRename(); }}
          className="p-1 hover:bg-zinc-700 rounded"
        >
          <Pencil className="w-3 h-3 text-zinc-400" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 hover:bg-red-500/20 rounded"
        >
          <Trash2 className="w-3 h-3 text-red-400" />
        </button>
      </div>
    </motion.div>
  );
};
