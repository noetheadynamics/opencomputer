import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Eye, Globe, Paperclip, Trash2, Minimize2, Download, HelpCircle, type LucideIcon } from 'lucide-react';
import { COMMANDS } from '../../types/chat';
import type { CommandItem } from '../../types/chat';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: CommandItem) => void;
  filter: string;
}

const iconMap: Record<string, LucideIcon> = {
  Code, Eye, Globe, Paperclip, Trash2, Minimize2, Download, HelpCircle,
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onSelect, filter }) => {
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
      cmd.description.toLowerCase().includes(filter.toLowerCase())
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
          className="absolute bottom-full left-0 right-0 mb-2 glass-panel border border-oc-surface-border shadow-xl max-h-64 overflow-y-auto z-50"
        >
          {filtered.map((cmd, i) => {
            const Icon = iconMap[cmd.icon] || Code;
            return (
              <button
                key={cmd.id}
                onClick={() => { onSelect(cmd); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selected ? 'bg-oc-accent/10 text-oc-accent' : 'text-oc-text-primary hover:bg-oc-surface/50'
                }`}
              >
                <Icon size={16} />
                <div>
                  <div className="text-sm font-medium">{cmd.name}</div>
                  <div className="text-xs text-oc-text-secondary">{cmd.description}</div>
                </div>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
