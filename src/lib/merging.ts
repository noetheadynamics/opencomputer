/**
 * Model Merging API client.
 */

import type { MergeStrategy, TaskStrategy, MergePerformance, MergeStatus } from '../types/merging';
import { PHAOS_BASE } from './config';

export const mergingApi = {
  getStrategies: async (): Promise<{ strategies: MergeStrategy[] }> => {
    const res = await fetch(`${PHAOS_BASE}/api/merging/strategies`);
    if (!res.ok) throw new Error(`Failed to get strategies: ${res.statusText}`);
    return res.json();
  },

  getTaskStrategies: async (): Promise<TaskStrategy[]> => {
    const res = await fetch(`${PHAOS_BASE}/api/merging/task-strategies`);
    if (!res.ok) throw new Error(`Failed to get task strategies: ${res.statusText}`);
    return res.json();
  },

  setTaskStrategy: async (taskType: string, strategy: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/merging/task-strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_type: taskType, strategy }),
    });
    if (!res.ok) throw new Error(`Failed to set strategy: ${res.statusText}`);
    return res.json();
  },

  testMerge: async (taskType: string, query: string, strategy?: string) => {
    const res = await fetch(`${PHAOS_BASE}/api/merging/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_type: taskType, query, strategy }),
    });
    if (!res.ok) throw new Error(`Failed to test merge: ${res.statusText}`);
    return res.json();
  },

  getPerformance: async (taskType: string): Promise<MergePerformance> => {
    const res = await fetch(`${PHAOS_BASE}/api/merging/performance/${taskType}`);
    if (!res.ok) throw new Error(`Failed to get performance: ${res.statusText}`);
    return res.json();
  },

  getStatus: async (): Promise<MergeStatus> => {
    const res = await fetch(`${PHAOS_BASE}/api/merging/status`);
    if (!res.ok) throw new Error(`Failed to get status: ${res.statusText}`);
    return res.json();
  },
};
