/**
 * Memory Stats — counts, sizes, TTL status.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw } from 'lucide-react';
import { memoryApi } from '../../lib/memory';
import type { MemoryStats as MemoryStatsType } from '../../types/memory';

interface StatCardProps {
  value: number;
  label: string;
}

const StatCard: React.FC<StatCardProps> = ({ value, label }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="oc-glass-panel p-4 text-center"
  >
    <div className="text-2xl font-bold text-emerald-400">{value}</div>
    <div className="text-xs text-zinc-500 mt-1">{label}</div>
  </motion.div>
);

export const MemoryStats: React.FC = () => {
  const [stats, setStats] = useState<MemoryStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await memoryApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) {
    return (
      <div className="oc-glass-panel p-6">
        <div className="text-center text-zinc-500 text-sm py-8">Loading stats...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="oc-glass-panel p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Memory Stats</h2>
        </div>
        <button onClick={loadStats} className="oc-glass-btn p-2" title="Refresh">
          <RefreshCw className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard value={stats?.truth_vault_count || 0} label="Truth Vault Facts" />
        <StatCard value={stats?.cross_session_milestones || 0} label="Milestones" />
        <StatCard value={stats?.memory_store_count || 0} label="Interactions" />
        <StatCard value={stats?.conversations_count || 0} label="Conversations" />
        <StatCard value={stats?.skills_count || 0} label="Adaptive Skills" />
      </div>

      {stats?.memory_store_details && (
        <div className="oc-glass-panel p-4 space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">Memory Store Details</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-lg font-semibold text-zinc-200">{stats.memory_store_details.total}</div>
              <div className="text-xs text-zinc-500">Total</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-emerald-400">{stats.memory_store_details.successful}</div>
              <div className="text-xs text-zinc-500">Successful</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-red-400">{stats.memory_store_details.failed}</div>
              <div className="text-xs text-zinc-500">Failed</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-yellow-400">{stats.memory_store_details.corrected}</div>
              <div className="text-xs text-zinc-500">Corrected</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
