/**
 * Truth Vault Viewer — cached facts with TTL status.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Trash2, RefreshCw, Filter } from 'lucide-react';
import { memoryApi } from '../../lib/memory';
import type { TruthVaultFact } from '../../types/memory';

export const TruthVaultViewer: React.FC = () => {
  const [facts, setFacts] = useState<TruthVaultFact[]>([]);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadFacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await memoryApi.getTruthVault(200, typeFilter || undefined);
      setFacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFacts(); }, [typeFilter]);

  const handleDelete = async (id: string) => {
    try {
      await memoryApi.deleteTruthVaultFact(id);
      setFacts((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const filtered = filter
    ? facts.filter(
        (f) =>
          f.query.toLowerCase().includes(filter.toLowerCase()) ||
          f.answer.toLowerCase().includes(filter.toLowerCase())
      )
    : facts;

  const activeCount = facts.filter((f) => !f.is_expired).length;
  const expiredCount = facts.filter((f) => f.is_expired).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="oc-glass-panel p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Truth Vault</h2>
          <span className="text-xs text-zinc-500 ml-2">
            {activeCount} active, {expiredCount} expired
          </span>
        </div>
        <button onClick={loadFacts} className="oc-glass-btn p-2" title="Refresh">
          <RefreshCw className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter facts..."
          className="oc-glass-input flex-1"
        />
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="oc-glass-input text-xs w-28"
          >
            <option value="">All Types</option>
            <option value="factual">Factual</option>
            <option value="procedural">Procedural</option>
            <option value="preference">Preference</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="text-center text-zinc-500 text-sm py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-zinc-500 text-sm py-8">
          {filter ? 'No matching facts' : 'No facts in Truth Vault yet'}
        </div>
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {filtered.map((fact) => (
            <motion.div
              key={fact.id}
              layout
              className="oc-glass-panel p-3 group"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-100 truncate">{fact.query}</div>
                  <div className="text-xs text-zinc-400 mt-1 line-clamp-2">{fact.answer}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        fact.is_expired
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {fact.is_expired ? 'Expired' : 'Active'}
                    </span>
                    <span className="text-xs text-zinc-500">Type: {fact.fact_type}</span>
                    {fact.expires_at && (
                      <span className="text-xs text-zinc-600">
                        Expires: {new Date(fact.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {fact.sources && fact.sources.length > 0 && (
                    <div className="text-xs text-zinc-600 mt-1">
                      Sources: {fact.sources.join(', ')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setConfirmDeleteId(fact.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                  title="Delete fact"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setConfirmDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="oc-glass-modal p-4 w-80"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-medium text-zinc-100 mb-2">Delete Fact</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Are you sure you want to delete this fact from the Truth Vault?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (confirmDeleteId) {
                      await handleDelete(confirmDeleteId);
                      setConfirmDeleteId(null);
                    }
                  }}
                  className="flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
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
