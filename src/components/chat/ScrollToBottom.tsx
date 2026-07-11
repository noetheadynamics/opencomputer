import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface ScrollToBottomProps {
  show: boolean;
  onClick: () => void;
}

export const ScrollToBottom: React.FC<ScrollToBottomProps> = ({ show, onClick }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          className="fixed bottom-24 right-8 z-40 w-10 h-10 rounded-full bg-oc-surface/80 border border-oc-surface-border shadow-lg flex items-center justify-center backdrop-blur-md hover:bg-oc-surface transition-colors"
        >
          <ChevronDown className="w-5 h-5 text-oc-text-secondary" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};
