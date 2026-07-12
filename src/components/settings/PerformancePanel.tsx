/**
 * Performance Panel — per-session API call stats.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw, Download } from 'lucide-react';
import { performanceApi } from '../../lib/performance';
import type { SessionPerformance } from '../../types/performance';

interface PerformancePanelProps {
  sessionId: string;
}

export const PerformancePanel: React.FC<PerformancePanelProps> = ({ sessionId }) => {
  const [stats, setStats] = useState<SessionPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const data = await performanceApi.getSessionStats(sessionId);
      setStats(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleExport = async () => {
    try {
      const data = await performanceApi.exportStats(sessionId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance_${sessionId}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (loading) {
    return <div className="flex h-full flex-col p-4"><div className="oc-glass-panel p-6"><div className="text-center text-zinc-500 text-sm py-8">Loading...</div></div></div>;
  }

  return (
    <div className="flex h-full flex-col p-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col flex-1 min-h-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Performance</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={loadStats} className="oc-glass-btn p-2" title="Refresh">
              <RefreshCw className="w-4 h-4 text-zinc-400" />
            </button>
            <button onClick={handleExport} className="oc-glass-btn p-2" title="Export">
              <Download className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard value={stats?.summary?.total_calls || 0} label="API Calls" />
            <StatCard value={stats?.summary?.total_tokens || 0} label="Total Tokens" />
            <StatCard value={`${stats?.summary?.avg_latency || 0}ms`} label="Avg Latency" />
            <StatCard value={`${stats?.summary?.success_rate || 0}%`} label="Success Rate" />
          </div>

          {stats?.by_model && Object.keys(stats.by_model).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">By Model</h3>
              <div className="space-y-1">
                {Object.entries(stats.by_model).map(([model, data]) => (
                  <div key={model} className="oc-glass-panel p-2 flex justify-between text-xs">
                    <span className="text-zinc-300">{model}</span>
                    <span className="text-zinc-500">{data.calls} calls, {data.tokens.toLocaleString()} tokens</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats?.by_task && Object.keys(stats.by_task).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">By Task Type</h3>
              <div className="space-y-1">
                {Object.entries(stats.by_task).map(([task, data]) => (
                  <div key={task} className="oc-glass-panel p-2 flex justify-between text-xs">
                    <span className="text-zinc-300">{task}</span>
                    <span className="text-zinc-500">{data.calls} calls, {data.tokens.toLocaleString()} tokens</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const StatCard: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <div className="oc-glass-panel p-3 text-center">
    <div className="text-xl font-bold text-emerald-400">{value}</div>
    <div className="text-xs text-zinc-500 mt-1">{label}</div>
  </div>
);
