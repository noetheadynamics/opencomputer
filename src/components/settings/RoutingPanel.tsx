/**
 * Model Routing Configuration — full UI for task-type to model routing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Route, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { routingApi } from '../../lib/routing';
import { loadProviders, type Provider } from '../../lib/providers';
import type { RouteRule } from '../../types/routing';

const TASK_TYPES = ['coding', 'vision', 'reasoning', 'factual', 'design', 'general'];

export const RoutingPanel: React.FC = () => {
  const [rules, setRules] = useState<RouteRule[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<{ taskType: string; ok: boolean } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [rulesData, providersData] = await Promise.all([
        routingApi.getRules(),
        loadProviders(),
      ]);
      setRules(rulesData);
      setProviders(providersData);
    } catch (err) {
      console.error('Failed to load routing data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateRule = async (taskType: string, field: string, value: string) => {
    const existing = rules.find((r) => r.task_type === taskType);
    const updated = { ...existing, task_type: taskType, [field]: value } as RouteRule;
    setRules((prev) => prev.map((r) => (r.task_type === taskType ? updated : r)));
    try {
      await routingApi.updateRule(taskType, updated);
    } catch (err) {
      console.error('Failed to update rule:', err);
    }
  };

  const handleTest = async (taskType: string, providerId: string, modelName: string) => {
    try {
      await routingApi.testModel(providerId, modelName);
      setTestResult({ taskType, ok: true });
    } catch {
      setTestResult({ taskType, ok: false });
    }
    setTimeout(() => setTestResult(null), 2000);
  };

  if (loading) {
    return <div className="flex h-full flex-col p-4"><div className="oc-glass-panel p-6"><div className="text-center text-zinc-500 text-sm py-8">Loading...</div></div></div>;
  }

  return (
    <div className="flex h-full flex-col p-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col flex-1 min-h-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Model Routing</h2>
          </div>
          <button onClick={loadData} className="oc-glass-btn p-2" title="Refresh">
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800">
              <th className="text-left py-2 pr-4">Task Type</th>
              <th className="text-left py-2 pr-4">Provider</th>
              <th className="text-left py-2 pr-4">Model</th>
              <th className="text-left py-2 pr-4">Fallback</th>
              <th className="text-left py-2">Test</th>
            </tr>
          </thead>
          <tbody>
            {TASK_TYPES.map((tt) => {
              const rule = rules.find((r) => r.task_type === tt) || { task_type: tt, provider_id: '', model_name: '', fallback_model_name: '' };
              return (
                <tr key={tt} className="border-b border-zinc-800/50">
                  <td className="py-2.5 pr-4 text-zinc-200 font-medium">{tt}</td>
                  <td className="py-2.5 pr-4">
                    <select
                      value={rule.provider_id || ''}
                      onChange={(e) => updateRule(tt, 'provider_id', e.target.value)}
                      className="oc-glass-input text-xs w-full"
                    >
                      <option value="">Select provider</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 pr-4">
                    <input
                      type="text"
                      value={rule.model_name || ''}
                      onChange={(e) => updateRule(tt, 'model_name', e.target.value)}
                      placeholder="Model name"
                      className="oc-glass-input text-xs w-full"
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    <input
                      type="text"
                      value={rule.fallback_model_name || ''}
                      onChange={(e) => updateRule(tt, 'fallback_model_name', e.target.value)}
                      placeholder="Fallback model"
                      className="oc-glass-input text-xs w-full"
                    />
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleTest(tt, rule.provider_id, rule.model_name)}
                      disabled={!rule.provider_id || !rule.model_name}
                      className="oc-glass-btn px-2 py-1 text-xs"
                    >
                      {testResult?.taskType === tt ? (
                        testResult.ok ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />
                      ) : 'Test'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};
