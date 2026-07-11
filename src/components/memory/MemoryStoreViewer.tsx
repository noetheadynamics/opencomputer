/**
 * Memory Store Viewer — interactions, failures, corrections with search.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Database, Search, Trash2, RefreshCw } from 'lucide-react';
import { memoryApi } from '../../lib/memory';
import type { MemoryInteraction } from '../../types/memory';

export const MemoryStoreViewer: React.FC = () => {
  const [interactions, setInteractions] = useState<MemoryInteraction[]>([]);
  const [query, setQuery] = useState('');
  const [filterSuccess, setFilterSuccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInteractions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await memoryApi.getMemoryStore({
        query: query || undefined,
        success_only: filterSuccess ?? undefined,
        limit: 100,
      });
      setInteractions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [query, filterSuccess]);

  useEffect(() => { loadInteractions(); }, [loadInteractions]);

  const handleDelete = async (id: string) => {
    try {
      await memoryApi.deleteInteraction(id);
      setInteractions((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleSearch = () => loadInteractions();

  const successCount = interactions.filter((i) => i.success).length;
  const failureCount = interactions.filter((i) => !i.success).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="oc-glass-panel p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Memory Store</h2>
          <span className="text-xs text-zinc-500 ml-2">
            {successCount} success, {failureCount} failed
          </span>
        </div>
        <button onClick={loadInteractions} className="oc-glass-btn p-2" title="Refresh">
          <RefreshCw className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search interactions..."
            className="oc-glass-input pl-8"
          />
        </div>
        <select
          value={filterSuccess === null ? 'all' : filterSuccess ? 'success' : 'failure'}
          onChange={(e) =>
            setFilterSuccess(e.target.value === 'all' ? null : e.target.value === 'success')
          }
          className="oc-glass-input text-xs w-28"
        >
          <option value="all">All</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        <button onClick={handleSearch} className="oc-glass-btn-primary px-4 py-1.5 text-xs">
          Search
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="text-center text-zinc-500 text-sm py-8">Loading...</div>
      ) : interactions.length === 0 ? (
        <div className="text-center text-zinc-500 text-sm py-8">
          {query ? 'No matching interactions' : 'No interactions stored yet'}
        </div>
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {interactions.map((interaction) => (
            <motion.div
              key={interaction.id}
              layout
              className="oc-glass-panel p-3 group"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-100 truncate">
                    {interaction.query}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {interaction.response?.substring(0, 200)}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        interaction.success
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {interaction.success ? 'Success' : 'Failure'}
                    </span>
                    {interaction.user_correction && (
                      <span className="text-xs text-yellow-400">
                        Correction: {interaction.user_correction.substring(0, 60)}
                      </span>
                    )}
                    <span className="text-xs text-zinc-600">
                      {new Date(interaction.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(interaction.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
