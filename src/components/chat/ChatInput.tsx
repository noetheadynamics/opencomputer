import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, AtSign, Smile, Image } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { MentionsPopover } from './MentionsPopover';
import { FormattingToolbar } from './FormattingToolbar';
import { AttachmentPreview } from './AttachmentPreview';
import { ReplyIndicator } from './ReplyIndicator';
import { uploadFile } from '../../lib/upload';
import { debounce } from '../../lib/utils';
import type { ChatAttachment, ChatMessage, CommandItem, MentionItem } from '../../types/chat';

interface ChatInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  onCommand?: (command: CommandItem) => void;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  placeholder?: string;
  disabled?: boolean;
  mentionItems?: MentionItem[];
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onCommand,
  replyTo,
  onCancelReply,
  placeholder = 'Type a message...',
  disabled,
  mentionItems = [],
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [mentionFilter, setMentionFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (value: string) => {
    setText(value);
    const lastLine = value.split('\n').pop() || '';
    if (lastLine.startsWith('/')) {
      setShowCommands(true);
      setCommandFilter(lastLine);
    } else {
      setShowCommands(false);
    }
    if (lastLine.includes('@')) {
      const atIdx = lastLine.lastIndexOf('@');
      setShowMentions(true);
      setMentionFilter(lastLine.substring(atIdx + 1));
    } else {
      setShowMentions(false);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    const sanitized = trimmed.replace(/<[^>]*>/g, '');
    onSend(sanitized, attachments.length > 0 ? attachments : undefined);
    setText('');
    setAttachments([]);
    onCancelReply?.();
  };

  const debouncedSend = useCallback(
    debounce(() => {
      handleSend();
    }, 300),
    [handleSend]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      debouncedSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const uploaded = await uploadFile(file);
      setAttachments((prev) => [...prev, { ...uploaded, type: uploaded.type as ChatAttachment['type'] }]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const uploaded = await uploadFile(file);
      setAttachments((prev) => [...prev, { ...uploaded, type: uploaded.type as ChatAttachment['type'] }]);
    }
    setUploading(false);
  }, []);

  const handleCommandSelect = (cmd: CommandItem) => {
    setText('');
    onCommand?.(cmd);
  };

  const handleMentionSelect = (item: MentionItem) => {
    const lines = text.split('\n');
    const lastLine = lines.pop() || '';
    const atIdx = lastLine.lastIndexOf('@');
    lines.push(lastLine.substring(0, atIdx) + `@${item.name} `);
    setText(lines.join('\n'));
  };

  const handleFormat = (prefix: string, suffix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = text.substring(start, end);
    const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
    setText(newText);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="border-t border-oc-surface-border bg-oc-bg/50 backdrop-blur-md"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Reply indicator */}
      {replyTo && (
        <div className="px-4 pt-2">
          <ReplyIndicator replyTo={replyTo} onClose={onCancelReply || (() => {})} />
        </div>
      )}

      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pt-2 flex flex-wrap gap-2"
          >
            {attachments.map((att) => (
              <AttachmentPreview
                key={att.id}
                file={att}
                onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formatting toolbar */}
      <AnimatePresence>
        {showFormatting && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <FormattingToolbar onFormat={handleFormat} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Action buttons */}
        <div className="flex items-center gap-1 pb-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-1.5 rounded-full hover:bg-oc-surface/50 text-oc-text-secondary hover:text-oc-accent transition-colors"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-1.5 rounded-full hover:bg-oc-surface/50 text-oc-text-secondary hover:text-oc-accent transition-colors"
            title="Attach image"
          >
            <Image size={18} />
          </button>
          <button
            onClick={() => { setText((t) => t + '@'); setShowMentions(true); }}
            disabled={disabled}
            className="p-1.5 rounded-full hover:bg-oc-surface/50 text-oc-text-secondary hover:text-oc-accent transition-colors"
            title="Mention"
          >
            <AtSign size={18} />
          </button>
          <button
            onClick={() => setShowFormatting(!showFormatting)}
            disabled={disabled}
            className={`p-1.5 rounded-full transition-colors ${
              showFormatting ? 'bg-oc-accent/20 text-oc-accent' : 'hover:bg-oc-surface/50 text-oc-text-secondary hover:text-oc-accent'
            }`}
            title="Formatting"
          >
            <Smile size={18} />
          </button>
        </div>

        {/* Text input */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={uploading ? 'Uploading...' : placeholder}
            disabled={disabled || uploading}
            rows={1}
            className="w-full resize-none bg-oc-surface/50 border border-oc-surface-border rounded-2xl px-4 py-2.5 text-sm text-oc-text-primary placeholder:text-oc-text-secondary/40 focus:outline-none focus:border-oc-accent/50 transition-colors max-h-32"
            style={{ minHeight: '42px' }}
          />

          {/* Command palette */}
          <CommandPalette
            isOpen={showCommands}
            onClose={() => setShowCommands(false)}
            onSelect={handleCommandSelect}
            filter={commandFilter}
          />

          {/* Mentions popover */}
          <MentionsPopover
            isOpen={showMentions}
            onClose={() => setShowMentions(false)}
            onSelect={handleMentionSelect}
            filter={mentionFilter}
            items={mentionItems}
          />
        </div>

        {/* Send button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={debouncedSend}
          disabled={disabled || (!text.trim() && attachments.length === 0)}
          className="p-2.5 rounded-full bg-oc-accent text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          <Send size={18} />
        </motion.button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
};
