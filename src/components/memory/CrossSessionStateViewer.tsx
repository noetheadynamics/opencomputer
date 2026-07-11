/**
 * Cross-Session State Viewer — milestones, blockers, skills.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layers, RefreshCw, CheckCircle, AlertTriangle, XCircle, Ban, Brain } from 'lucide-react';
import { memoryApi } from '../../lib/memory';
import type { CrossSessionState } from '../../types/memory';

interface BadgeProps {
  label: string;
  color: 'emerald' | 'yellow' | 'red' | 'blue' | 'zinc';
}

const Badge: React.FC<BadgeProps> = ({ label, color }) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    red: 'bg-red-500/20 text-red-400',
    blue: 'bg-blue-500/20 text-blue-400',
    zinc: 'bg-zinc-500/20 text-zinc-400',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs ${colors[color]}`}>
      {label}
    </span>
  );
};

export const CrossSessionStateViewer: React.FC = () => {
  const [state, setState] = useState<CrossSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadState = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await memoryApi.getCrossSessionState();
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadState(); }, []);

  if (loading) {
    return (
      <div className="oc-glass-panel p-6">
        <div className="text-center text-zinc-500 text-sm py-8">Loading...</div>
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
          <Layers className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Cross-Session State</h2>
        </div>
        <button onClick={loadState} className="oc-glass-btn p-2" title="Refresh">
          <RefreshCw className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
      )}

      <div className="space-y-4">
        <Section
          icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}
          title="Milestones Completed"
          items={state?.milestones || []}
          color="emerald"
          empty="No milestones yet"
        />
        <Section
          icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
          title="Open Issues"
          items={state?.open_issues || []}
          color="yellow"
          empty="No open issues"
        />
        <Section
          icon={<XCircle className="w-4 h-4 text-red-400" />}
          title="Failed Attempts"
          items={state?.failed_attempts || []}
          color="red"
          empty="No failures"
        />
        <Section
          icon={<Ban className="w-4 h-4 text-red-400" />}
          title="Known Blockers"
          items={state?.known_blockers || []}
          color="red"
          empty="No blockers"
        />
        <Section
          icon={<Brain className="w-4 h-4 text-blue-400" />}
          title="Skills Learned"
          items={state?.skills_learned || []}
          color="blue"
          empty="No skills yet"
        />
      </div>

      {state?.last_updated && (
        <div className="text-xs text-zinc-600 pt-2 border-t border-zinc-800">
          Last updated: {new Date(state.last_updated).toLocaleString()}
        </div>
      )}
    </motion.div>
  );
};

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  items: string[];
  color: BadgeProps['color'];
  empty: string;
}> = ({ icon, title, items, color, empty }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
      <span className="text-xs text-zinc-600">({items.length})</span>
    </div>
    {items.length === 0 ? (
      <div className="text-xs text-zinc-600 pl-6">{empty}</div>
    ) : (
      <div className="flex flex-wrap gap-2 pl-6">
        {items.map((item, i) => (
          <Badge key={`${item}-${i}`} label={item} color={color} />
        ))}
      </div>
    )}
  </div>
);
