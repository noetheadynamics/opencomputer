import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { File, Folder, CheckSquare, MessageSquare, Bot } from 'lucide-react';
import type { MentionItem } from '../../types/chat';

interface MentionsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: MentionItem) => void;
  filter: string;
  items: MentionItem[];
}

const iconMap = {
  file: File,
  folder: Folder,
  task: CheckSquare,
  conversation: MessageSquare,
  subagent: Bot,
};

export const MentionsPopover: React.FC<MentionsPopoverProps> = ({ isOpen, onClose, onSelect, filter, items }) => {
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(filter.toLowerCase()) ||
      item.description?.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => { setSelected(0); }, [filter]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && filtered[selected]) { onSelect(filtered[selected]); onClose(); }
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, filtered, selected, onSelect, onClose]);

  return (
    <AnimatePresence>
      {isOpen && filtered.length > 0 && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-0 right-0 mb-2 glass-panel border border-oc-surface-border shadow-xl max-h-48 overflow-y-auto z-50"
        >
          {filtered.map((item, i) => {
            const Icon = iconMap[item.type] || File;
            return (
              <button
                key={item.id}
                onClick={() => { onSelect(item); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  i === selected ? 'bg-oc-accent/10 text-oc-accent' : 'text-oc-text-primary hover:bg-oc-surface/50'
                }`}
              >
                <Icon size={14} className="text-oc-text-secondary" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-oc-text-secondary truncate">{item.description}</div>
                  )}
                </div>
                <span className="text-[10px] text-oc-text-secondary/50">{item.type}</span>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
