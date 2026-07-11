import React from 'react';
import { X } from 'lucide-react';
import type { ChatMessage } from '../../types/chat';

interface ReplyIndicatorProps {
  replyTo: ChatMessage;
  onClose: () => void;
}

export const ReplyIndicator: React.FC<ReplyIndicatorProps> = ({ replyTo, onClose }) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-oc-surface/30 border-l-2 border-oc-accent rounded-r-md mb-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-oc-accent">
          Replying to {replyTo.role === 'user' ? 'yourself' : 'AI'}
        </div>
        <div className="text-xs text-oc-text-secondary truncate">
          {replyTo.content.substring(0, 100)}
        </div>
      </div>
      <button onClick={onClose} className="text-oc-text-secondary hover:text-oc-text-primary">
        <X size={14} />
      </button>
    </div>
  );
};
