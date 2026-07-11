/**
 * Merge Strategy Panel — configure merge strategies per task type.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GitMerge, RefreshCw, CheckCircle, XCircle, Info } from 'lucide-react';
import { mergingApi } from '../../lib/merging';
import type { MergeStrategy, TaskStrategy, StrategyScore } from '../../types/merging';

const TASK_TYPES = ['coding', 'vision', 'reasoning', 'factual', 'design', 'general'];

export const MergeStrategyPanel: React.FC = () => {
  const [strategies, setStrategies] = useState<MergeStrategy[]>([]);
  const [taskStrategies, setTaskStrategies] = useState<TaskStrategy[]>([]);
  const [scores, setScores] = useState<Record<string, StrategyScore[]>>({});
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<{ taskType: string; ok: boolean; result?: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [stratData, taskData] = await Promise.all([
        mergingApi.getStrategies(),
        mergingApi.getTaskStrategies(),
      ]);
      setStrategies(stratData.strategies);
      setTaskStrategies(taskData);

      const scorePromises = TASK_TYPES.map(async (tt) => {
        try {
          const perf = await mergingApi.getPerformance(tt);
          return { taskType: tt, scores: perf.scores };
        } catch {
          return { taskType: tt, scores: [] as StrategyScore[] };
        }
      });
      const scoreResults = await Promise.all(scorePromises);
      const scoreMap: Record<string, StrategyScore[]> = {};
      for (const r of scoreResults) {
        scoreMap[r.taskType] = r.scores;
      }
      setScores(scoreMap);
    } catch (err) {
      console.error('Failed to load merge data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateStrategy = async (taskType: string, strategy: string) => {
    try {
      await mergingApi.setTaskStrategy(taskType, strategy);
      setTaskStrategies((prev) => {
        const existing = prev.find((t) => t.task_type === taskType);
        if (existing) {
          return prev.map((t) => (t.task_type === taskType ? { ...t, strategy } : t));
        }
        return [...prev, { task_type: taskType, strategy }];
      });
    } catch (err) {
      console.error('Failed to update strategy:', err);
    }
  };

  const handleTest = async (taskType: string) => {
    setTesting(taskType);
    try {
      const result = await mergingApi.testMerge(taskType, `Test query for ${taskType}`);
      setTestResult({ taskType, ok: result.success, result: result.result || result.error });
    } catch {
      setTestResult({ taskType, ok: false, result: 'Request failed' });
    }
    setTesting(null);
    setTimeout(() => setTestResult(null), 3000);
  };

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
          <GitMerge className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Model Merging</h2>
        </div>
        <button onClick={loadData} className="oc-glass-btn p-2" title="Refresh">
          <RefreshCw className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800">
              <th className="text-left py-2 pr-4">Task Type</th>
              <th className="text-left py-2 pr-4">Strategy</th>
              <th className="text-left py-2 pr-4">Test</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {TASK_TYPES.map((tt) => {
              const current = taskStrategies.find((t) => t.task_type === tt);
              const taskScores = scores[tt] || [];
              const bestStrategy = taskScores.length > 0 ? taskScores[0]?.strategy : null;

              return (
                <tr key={tt} className="border-b border-zinc-800/50">
                  <td className="py-2.5 pr-4 text-zinc-200 font-medium">{tt}</td>
                  <td className="py-2.5 pr-4">
                    <select
                      value={current?.strategy || 'default'}
                      onChange={(e) => updateStrategy(tt, e.target.value)}
                      className="oc-glass-input text-xs w-full"
                    >
                      <option value="default">Default</option>
                      {strategies.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-4">
                    <button
                      onClick={() => handleTest(tt)}
                      disabled={testing === tt}
                      className="oc-glass-btn px-2 py-1 text-xs"
                    >
                      {testing === tt ? '...' : 'Test'}
                    </button>
                  </td>
                  <td className="py-2.5">
                    {testResult?.taskType === tt ? (
                      testResult.ok ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <CheckCircle className="w-3.5 h-3.5" /> {testResult.result || 'OK'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <XCircle className="w-3.5 h-3.5" /> {testResult.result || 'Failed'}
                        </span>
                      )
                    ) : bestStrategy ? (
                      <span className="text-xs text-zinc-500">Best: {bestStrategy}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="oc-glass-panel p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-zinc-400" />
          <h4 className="text-sm font-medium text-zinc-300">Strategies</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {strategies.map((s) => (
            <div key={s.id} className="text-xs">
              <span className="text-emerald-400 font-medium">{s.name}:</span>{' '}
              <span className="text-zinc-500">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
