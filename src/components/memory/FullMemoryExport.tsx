/**
 * Full Memory Export — one-click export of all memory types as ZIP.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Trash2 } from 'lucide-react';
import { memoryApi } from '../../lib/memory';

export const FullMemoryExport: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [days, setDays] = useState(30);
  const [lastCleanup, setLastCleanup] = useState<string | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await memoryApi.exportAll();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opencomputer_memory_export_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setCleaning(true);
      const result = await memoryApi.cleanup(days);
      setLastCleanup(`Cleaned ${result.deleted_count || 0} entries older than ${days} days`);
    } catch (err) {
      console.error('Cleanup failed:', err);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="oc-glass-panel p-6 space-y-6"
    >
      <div className="flex items-center gap-2">
        <Download className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Memory Management</h2>
      </div>

      <div className="space-y-4">
        <div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="oc-glass-btn-primary px-6 py-3 text-sm font-medium"
          >
            {exporting ? 'Exporting...' : 'Export All Memory (ZIP)'}
          </button>
          <p className="text-xs text-zinc-500 mt-2">
            Exports Truth Vault, Cross-Session State, Memory Store, and Conversations.
          </p>
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 30))}
              className="oc-glass-input w-20 text-center"
              min={1}
            />
            <span className="text-xs text-zinc-400">days</span>
            <button
              onClick={() => setConfirmCleanup(true)}
              disabled={cleaning}
              className="flex items-center gap-1 px-4 py-2 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {cleaning ? 'Cleaning...' : 'Cleanup Old Memory'}
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Archives/deletes memory entries older than the specified number of days.
          </p>
          {lastCleanup && (
            <div className="text-xs text-emerald-400 mt-2">{lastCleanup}</div>
          )}
        </div>
      </div>

      {/* Cleanup Confirmation */}
      <AnimatePresence>
        {confirmCleanup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setConfirmCleanup(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="oc-glass-modal p-4 w-80"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-medium text-zinc-100 mb-2">Cleanup Memory</h3>
              <p className="text-xs text-zinc-400 mb-4">
                This will delete all memory entries older than {days} days. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setConfirmCleanup(false);
                    await handleCleanup();
                  }}
                  className="flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmCleanup(false)}
                  className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
