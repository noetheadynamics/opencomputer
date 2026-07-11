import React from 'react';
import { User, Bot } from 'lucide-react';

interface AvatarProps {
  role: 'user' | 'assistant';
  size?: 'sm' | 'md' | 'lg';
  imageUrl?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ role, size = 'md', imageUrl }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };
  const iconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 22;
  const isUser = role === 'user';

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-oc-accent/20' : 'bg-oc-surface/80 border border-oc-surface-border'
      }`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={role} className="rounded-full w-full h-full object-cover" />
      ) : isUser ? (
        <User size={iconSize} className="text-oc-accent" />
      ) : (
        <Bot size={iconSize} className="text-oc-text-secondary" />
      )}
    </div>
  );
};
