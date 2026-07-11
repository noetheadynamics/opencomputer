/**
 * Performance Monitoring API client.
 */

import type { SessionPerformance, PerformanceRecord } from '../types/performance';
import { PHAOS_BASE } from './config';

export const performanceApi = {
  getSessionStats: async (sessionId: string): Promise<SessionPerformance> => {
    const res = await fetch(`${PHAOS_BASE}/api/performance/session/${sessionId}`);
    if (!res.ok) throw new Error(`Failed to get stats: ${res.statusText}`);
    return res.json();
  },

  getRecords: async (sessionId: string, limit = 100): Promise<PerformanceRecord[]> => {
    const res = await fetch(`${PHAOS_BASE}/api/performance/session/${sessionId}/records?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to get records: ${res.statusText}`);
    return res.json();
  },

  recordCall: async (data: {
    session_id: string;
    provider: string;
    model: string;
    task_type?: string;
    tokens_in?: number;
    tokens_out?: number;
    latency_ms?: number;
    success?: boolean;
  }): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/performance/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to record: ${res.statusText}`);
    return res.json();
  },

  exportStats: async (sessionId: string) => {
    const res = await fetch(`${PHAOS_BASE}/api/performance/session/${sessionId}/export`);
    if (!res.ok) throw new Error(`Failed to export: ${res.statusText}`);
    return res.json();
  },
};
