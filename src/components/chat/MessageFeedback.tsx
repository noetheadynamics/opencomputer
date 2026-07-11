/**
 * Message Feedback — thumbs up/down on responses.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { memoryApi } from '../../lib/memory';

interface MessageFeedbackProps {
  messageId: string;
  query: string;
  response: string;
}

export const MessageFeedback: React.FC<MessageFeedbackProps> = ({
  messageId,
  query,
  response,
}) => {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFeedback = async (type: 'up' | 'down') => {
    if (submitting) return;
    try {
      setSubmitting(true);
      setFeedback(type);

      if (type === 'down') {
        await memoryApi.storeCorrection({
          query,
          original_response: response,
          corrected_response: '',
        });
      }

      await memoryApi.storeMessageFeedback(messageId, type);
    } catch (err) {
      console.error('Failed to store feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex gap-1.5 mt-1">
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => handleFeedback('up')}
        disabled={submitting}
        className={`p-1 rounded-full transition-colors ${
          feedback === 'up'
            ? 'text-emerald-400 bg-emerald-500/20'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
        }`}
        title="Good response"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => handleFeedback('down')}
        disabled={submitting}
        className={`p-1 rounded-full transition-colors ${
          feedback === 'down'
            ? 'text-red-400 bg-red-500/20'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
        }`}
        title="Bad response — will be used for correction"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </motion.button>
    </div>
  );
};
