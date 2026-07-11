/**
 * Background Task Panel — shows all tasks for a session with lifecycle controls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, RefreshCw, Cpu } from 'lucide-react';
import { backgroundTaskApi } from '../../lib/backgroundTasks';
import type { BackgroundTask } from '../../types/backgroundTasks';

interface BackgroundTaskPanelProps {
  sessionId: string;
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-zinc-500/20 text-zinc-400',
  running: 'bg-emerald-500/20 text-emerald-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-zinc-500/20 text-zinc-500',
};

export const BackgroundTaskPanel: React.FC<BackgroundTaskPanelProps> = ({ sessionId }) => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const data = await backgroundTaskApi.getSessionTasks(sessionId);
      setTasks(data.tasks);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 3000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleAction = async (taskId: string, action: 'start' | 'pause' | 'resume' | 'cancel') => {
    try {
      if (action === 'start') await backgroundTaskApi.start(taskId);
      else if (action === 'pause') await backgroundTaskApi.pause(taskId);
      else if (action === 'resume') await backgroundTaskApi.resume(taskId);
      else if (action === 'cancel') await backgroundTaskApi.cancel(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Task action failed:', err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="oc-glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-zinc-100">Background Tasks</h3>
          <span className="text-xs text-zinc-500">({tasks.length})</span>
        </div>
        <button onClick={loadTasks} className="oc-glass-btn p-1.5" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      </div>

      {loading ? (
        <div className="text-center text-zinc-500 text-xs py-4">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-zinc-500 text-xs py-4">No background tasks</div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {tasks.map((task) => (
            <div key={task.id} className="oc-glass-panel p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">{task.task_type}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${STATUS_COLORS[task.status] || ''}`}>
                      {task.status}
                    </span>
                  </div>
                  {task.progress > 0 && task.progress < 100 && (
                    <div className="mt-1.5 w-full bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                  {task.error && <div className="text-xs text-red-400 mt-1 truncate">{task.error}</div>}
                </div>
                <div className="flex gap-1">
                  {(task.status === 'queued' || task.status === 'paused') && (
                    <button onClick={() => handleAction(task.id, task.status === 'queued' ? 'start' : 'resume')} className="p-1 hover:bg-emerald-500/20 rounded" title={task.status === 'queued' ? 'Start' : 'Resume'}>
                      <Play className="w-3 h-3 text-emerald-400" />
                    </button>
                  )}
                  {task.status === 'running' && (
                    <button onClick={() => handleAction(task.id, 'pause')} className="p-1 hover:bg-yellow-500/20 rounded" title="Pause">
                      <Pause className="w-3 h-3 text-yellow-400" />
                    </button>
                  )}
                  {['queued', 'running', 'paused'].includes(task.status) && (
                    <button onClick={() => handleAction(task.id, 'cancel')} className="p-1 hover:bg-red-500/20 rounded" title="Cancel">
                      <Square className="w-3 h-3 text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
