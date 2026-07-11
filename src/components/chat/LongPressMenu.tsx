import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Reply, Edit, Trash2 } from 'lucide-react';

interface LongPressMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isUser?: boolean;
}

export const LongPressMenu: React.FC<LongPressMenuProps> = ({
  isOpen,
  onClose,
  onCopy,
  onReply,
  onEdit,
  onDelete,
  isUser,
}) => {
  const items = [
    { icon: Copy, label: 'Copy', onClick: onCopy },
    { icon: Reply, label: 'Reply', onClick: onReply },
    ...(isUser ? [{ icon: Edit, label: 'Edit', onClick: onEdit }] : []),
    { icon: Trash2, label: 'Delete', onClick: onDelete, danger: true },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="glass-panel p-2 border border-oc-surface-border shadow-xl min-w-[180px]"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  onClick={() => { item.onClick(); onClose(); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-oc-surface/50 transition-colors text-sm ${
                    item.danger ? 'text-red-400 hover:text-red-300' : 'text-oc-text-primary'
                  }`}
                >
                  <Icon size={16} className={item.danger ? 'text-red-400' : 'text-oc-text-secondary'} />
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
