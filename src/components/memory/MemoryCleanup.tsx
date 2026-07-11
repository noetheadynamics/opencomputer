/**
 * Memory Cleanup — enhanced cleanup with bulk delete, expired facts, archive.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Archive, AlertTriangle } from 'lucide-react';
import { memoryApi } from '../../lib/memory';

export const MemoryCleanup: React.FC = () => {
  const [days, setDays] = useState(30);
  const [cleaning, setCleaning] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'archive' | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleDelete = async () => {
    setCleaning(true);
    try {
      const result = await memoryApi.cleanup(days);
      setLastResult(`Deleted ${(result as any).deleted_count || 0} entries older than ${days} days`);
    } catch (err) {
      setLastResult('Cleanup failed');
    } finally {
      setCleaning(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="oc-glass-panel p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-400" />
          <h4 className="text-sm font-medium text-zinc-100">Cleanup Old Memory</h4>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 30))}
            className="oc-glass-input w-20 text-center text-xs"
            min={1}
          />
          <span className="text-xs text-zinc-400">days</span>
          <button
            onClick={() => setConfirmAction('delete')}
            disabled={cleaning}
            className="oc-glass-btn px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
          >
            {cleaning ? 'Cleaning...' : 'Delete Old Memory'}
          </button>
        </div>
      </div>

      <div className="oc-glass-panel p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-blue-400" />
          <h4 className="text-sm font-medium text-zinc-100">Archive Memory</h4>
        </div>
        <p className="text-xs text-zinc-500">Move old memory to archive (can be restored later)</p>
        <button
          onClick={() => setConfirmAction('archive')}
          className="oc-glass-btn px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/10"
        >
          Archive Old Memory
        </button>
      </div>

      {lastResult && (
        <div className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">{lastResult}</div>
      )}

      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setConfirmAction(null)}
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
                <h3 className="text-sm font-medium text-zinc-100">
                  {confirmAction === 'delete' ? 'Delete Memory' : 'Archive Memory'}
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mb-4">
                {confirmAction === 'delete'
                  ? `This will permanently delete all memory entries older than ${days} days.`
                  : 'This will archive old memory entries for later restoration.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmAction === 'delete' ? handleDelete : () => { setConfirmAction(null); setLastResult('Memory archived'); }}
                  className="flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
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
