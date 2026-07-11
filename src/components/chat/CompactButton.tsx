/**
 * Compact Button — DCP-inspired token usage display with Force Compact.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minimize2, AlertTriangle } from 'lucide-react';
import { compactApi } from '../../lib/compact';

interface CompactButtonProps {
  conversationId: string;
}

export const CompactButton: React.FC<CompactButtonProps> = ({ conversationId }) => {
  const [tokens, setTokens] = useState({ total: 0, max: 0, used_percent: 0, should_auto_compact: false });
  const [compacting, setCompacting] = useState(false);
  const [showForceConfirm, setShowForceConfirm] = useState(false);

  const loadTokens = React.useCallback(async () => {
    try {
      const data = await compactApi.getTokenCount(conversationId);
      setTokens(data);
    } catch {
      // silently fail
    }
  }, [conversationId]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleForceCompact = async () => {
    setCompacting(true);
    try {
      await compactApi.forceCompact(conversationId);
      await loadTokens();
    } catch (err) {
      console.error('Force compact failed:', err);
    } finally {
      setCompacting(false);
      setShowForceConfirm(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500">
        {tokens.total.toLocaleString()} / {tokens.max.toLocaleString()} tokens ({tokens.used_percent}%)
      </span>

      {/* Auto-compact warning when usage > 80% */}
      {tokens.should_auto_compact && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForceConfirm(true)}
          disabled={compacting}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/20 transition-colors"
        >
          <Minimize2 className="w-3 h-3" />
          {compacting ? 'Compacting...' : 'Compact'}
        </motion.button>
      )}

      {/* Force Compact — always available */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowForceConfirm(true)}
        disabled={compacting}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-colors"
      >
        <Minimize2 className="w-3 h-3" />
        Force Compact
      </motion.button>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showForceConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowForceConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="oc-glass-modal p-4 w-80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-medium text-zinc-100">Force Compact</h3>
              </div>
              <p className="text-xs text-zinc-400 mb-4">
                {tokens.should_auto_compact
                  ? `Context is at ${tokens.used_percent}%. Compacting will summarize older messages.`
                  : `Context is only at ${tokens.used_percent}%. Compacting now may lose detail. Continue?`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleForceCompact}
                  disabled={compacting}
                  className="flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                >
                  {compacting ? 'Compacting...' : 'Compact Now'}
                </button>
                <button
                  onClick={() => setShowForceConfirm(false)}
                  className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
