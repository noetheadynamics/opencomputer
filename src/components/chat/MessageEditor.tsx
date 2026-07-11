/**
 * Edit sent messages and regenerate responses.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface MessageEditorProps {
  content: string;
  onSave: (newContent: string) => void;
  onCancel: () => void;
}

export const MessageEditor: React.FC<MessageEditorProps> = ({
  content,
  onSave,
  onCancel,
}) => {
  const [value, setValue] = useState(content);

  const handleSave = () => {
    if (value.trim() && value.trim() !== content) {
      onSave(value.trim());
    } else {
      onCancel();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 resize-none focus:outline-none focus:border-emerald-500/50"
        rows={3}
        autoFocus
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded"
        >
          <Check className="w-3 h-3" />
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </motion.div>
  );
};
