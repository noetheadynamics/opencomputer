import React from 'react';
import { ChatBubble } from './ChatBubble';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
  previousMessage?: ChatMessageType;
  nextMessage?: ChatMessageType;
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onCopy: (content: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  previousMessage,
  nextMessage,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onCopy,
}) => {
  const isFirstInGroup =
    !previousMessage ||
    previousMessage.role !== message.role ||
    new Date(message.timestamp).getTime() - new Date(previousMessage.timestamp).getTime() > 300000;

  const isLastInGroup =
    !nextMessage ||
    nextMessage.role !== message.role ||
    new Date(nextMessage.timestamp).getTime() - new Date(message.timestamp).getTime() > 300000;

  return (
    <ChatBubble
      message={message}
      isFirstInGroup={isFirstInGroup}
      isLastInGroup={isLastInGroup}
      onReply={onReply}
      onEdit={onEdit}
      onDelete={onDelete}
      onReact={onReact}
      onCopy={onCopy}
    />
  );
};
