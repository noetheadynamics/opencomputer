import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { detectLinks } from '../../lib/links';
import { Avatar } from './Avatar';
import { ReactionPicker } from './ReactionPicker';
import { LongPressMenu } from './LongPressMenu';
import { LinkPreview } from './LinkPreview';
import { AttachmentPreview } from './AttachmentPreview';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatBubbleProps {
  message: ChatMessageType;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onCopy: (content: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isFirstInGroup = true,
  isLastInGroup = true,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onCopy,
}) => {
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const isUser = message.role === 'user';
  const links = detectLinks(message.content);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => setShowMenu(true), 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex items-end gap-2 group ${isUser ? 'flex-row-reverse' : 'flex-row'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
    >
      {/* Avatar */}
            {isLastInGroup ? (
              <Avatar role={message.role as 'user' | 'assistant'} size="sm" />
            ) : (
        <div className="w-6" />
      )}

      {/* Bubble */}
      <div className="relative max-w-[75%]">
        <div
          className={`relative px-4 py-2 text-sm leading-relaxed ${
            isUser
              ? 'bg-oc-accent text-white'
              : 'bg-oc-surface/80 text-oc-text-primary border border-oc-surface-border'
          } ${
            isLastInGroup
              ? isUser
                ? 'rounded-2xl rounded-br-sm'
                : 'rounded-2xl rounded-bl-sm'
              : 'rounded-2xl'
          } transition-all duration-200`}
          onContextMenu={handleContextMenu}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Tail */}
          {isLastInGroup && (
            <div
              className={`absolute bottom-0 w-3 h-3 ${
                isUser
                  ? 'right-0 -mr-1.5 bg-oc-accent rounded-bl-lg'
                  : 'left-0 -ml-1.5 bg-oc-surface/80 border border-oc-surface-border rounded-br-lg'
              }`}
            />
          )}

          {/* Content */}
          <div className="whitespace-pre-wrap break-words">
            {message.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
              part.match(/^https?:\/\//) ? (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${isUser ? 'text-white underline' : 'text-blue-400 underline hover:text-blue-300'} transition-colors`}
                >
                  {part}
                </a>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.attachments.map((att) => (
                <AttachmentPreview key={att.id} file={att} mini />
              ))}
            </div>
          )}

          {/* Link previews */}
          {links.length > 0 && (
            <div className="mt-2 space-y-1">
              {links.slice(0, 2).map((link, i) => (
                <LinkPreview key={i} url={link} />
              ))}
            </div>
          )}

          {/* Timestamp + reactions */}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] ${isUser ? 'text-white/60' : 'text-oc-text-secondary/60'}`}>
              {formatTime(message.timestamp)}
            </span>
            {message.isEdited && (
              <span className={`text-[10px] ${isUser ? 'text-white/40' : 'text-oc-text-secondary/40'}`}>(edited)</span>
            )}
          </div>
        </div>

        {/* Inline reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-0.5 mt-1 flex-wrap">
            {message.reactions.map((r, i) => (
              <span
                key={i}
                className="text-xs bg-oc-surface/50 border border-oc-surface-border rounded-full px-1.5 py-0.5 cursor-pointer hover:bg-oc-surface/80 transition-colors"
                onClick={() => onReact(message.id, r.emoji)}
              >
                {r.emoji} {r.count > 1 && r.count}
              </span>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        <ReactionPicker
          isOpen={showReactions}
          onClose={() => setShowReactions(false)}
          onSelect={(emoji) => onReact(message.id, emoji)}
          position={isUser ? 'bottom-right' : 'bottom-left'}
        />

        {/* Long press menu */}
        <LongPressMenu
          isOpen={showMenu}
          onClose={() => setShowMenu(false)}
          onCopy={() => onCopy(message.content)}
          onReply={() => onReply(message.id)}
          onEdit={() => onEdit(message.id)}
          onDelete={() => onDelete(message.id)}
          isUser={isUser}
        />

        {/* Reaction trigger */}
        <button
          onClick={() => setShowReactions(true)}
          className={`absolute -bottom-1 ${
            isUser ? 'left-0' : 'right-0'
          } text-oc-text-secondary/20 hover:text-oc-text-secondary/60 text-xs opacity-0 group-hover:opacity-100 transition-opacity`}
        >
          +
        </button>
      </div>
    </motion.div>
  );
};
