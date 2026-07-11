/**
 * Chat types for Phase 14 — Enhanced chat with iMessage-style UI.
 */

export interface ChatAttachment {
  id: string;
  name: string;
  type: 'file' | 'image' | 'code' | 'document';
  size: number;
  url?: string;
  content?: string;
  mimeType?: string;
  thumbnail?: string;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  reactions?: ChatReaction[];
  replyTo?: string;
  threadId?: string;
  isEdited?: boolean;
  isStreaming?: boolean;
  artifacts?: Artifact[];
}

export interface Artifact {
  id: string;
  type: 'code' | 'file' | 'result' | 'image';
  title: string;
  content: string;
  language?: string;
  filename?: string;
  createdAt: string;
}

export interface MessageGroup {
  date: Date;
  label: string;
  messages: ChatMessage[];
}

export interface Thread {
  id: string;
  parentMessageId: string;
  messages: ChatMessage[];
  replyCount: number;
}

export interface CommandItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'tools' | 'actions' | 'navigation';
  handler: string;
}

export interface MentionItem {
  id: string;
  type: 'file' | 'folder' | 'task' | 'conversation' | 'subagent';
  name: string;
  path?: string;
  description?: string;
}

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  hostname?: string;
}

export interface SubagentConfig {
  id: string;
  name: string;
  task_type: string;
  system_prompt: string;
  model: string;
  tools: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_REACTIONS = ['👍', '👎', '😄', '🚀', '❤️', '🎉', '🔥', '💡', '🐛'] as const;

export const COMMANDS: CommandItem[] = [
  { id: 'code', name: '/code', description: 'Generate or analyze code', icon: 'Code', category: 'tools', handler: 'code' },
  { id: 'vision', name: '/vision', description: 'Analyze an image', icon: 'Eye', category: 'tools', handler: 'vision' },
  { id: 'search', name: '/search', description: 'Search the web', icon: 'Globe', category: 'tools', handler: 'search' },
  { id: 'file', name: '/file', description: 'Attach a file', icon: 'Paperclip', category: 'tools', handler: 'file' },
  { id: 'clear', name: '/clear', description: 'Clear chat history', icon: 'Trash2', category: 'actions', handler: 'clear' },
  { id: 'compact', name: '/compact', description: 'Compact context', icon: 'Minimize2', category: 'actions', handler: 'compact' },
  { id: 'export', name: '/export', description: 'Export conversation', icon: 'Download', category: 'actions', handler: 'export' },
  { id: 'help', name: '/help', description: 'Show available commands', icon: 'HelpCircle', category: 'navigation', handler: 'help' },
];
