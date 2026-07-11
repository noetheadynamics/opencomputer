import React from 'react';

interface ChatMessageGroupProps {
  date: Date;
  children: React.ReactNode;
}

function getGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export const ChatMessageGroup: React.FC<ChatMessageGroupProps> = ({ date, children }) => {
  return (
    <div className="flex flex-col">
      <div className="text-center my-4">
        <span className="text-xs text-oc-text-secondary/50 bg-oc-surface/50 px-3 py-1 rounded-full">
          {getGroupLabel(date)}
        </span>
      </div>
      {children}
    </div>
  );
};
