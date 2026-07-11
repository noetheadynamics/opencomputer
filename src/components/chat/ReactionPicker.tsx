import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_REACTIONS } from '../../types/chat';

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  position = 'bottom-right',
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen, onClose]);

  const pos = {
    'top-left': 'bottom-full left-0 mb-2',
    'top-right': 'bottom-full right-0 mb-2',
    'bottom-left': 'top-full left-0 mt-2',
    'bottom-right': 'top-full right-0 mt-2',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={ref}
          initial={{ scale: 0.8, opacity: 0, y: 5 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 5 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`absolute z-50 ${pos[position]} glass-panel p-2 border border-oc-surface-border shadow-xl`}
        >
          <div className="flex gap-1">
            {DEFAULT_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onSelect(emoji); onClose(); }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-oc-surface/50 transition-all text-xl hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
