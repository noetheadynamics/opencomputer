/**
 * Model Routing API client.
 */

import type { RouteRule } from '../types/routing';
import { PHAOS_BASE } from './config';

export const routingApi = {
  getRules: async (): Promise<RouteRule[]> => {
    const res = await fetch(`${PHAOS_BASE}/api/routing/rules`);
    if (!res.ok) throw new Error(`Failed to get rules: ${res.statusText}`);
    return res.json();
  },

  updateRule: async (taskType: string, rule: Partial<RouteRule>): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/routing/rules/${taskType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (!res.ok) throw new Error(`Failed to update rule: ${res.statusText}`);
    return res.json();
  },

  testModel: async (providerId: string, modelName: string) => {
    const res = await fetch(`${PHAOS_BASE}/api/routing/test?provider_id=${providerId}&model_name=${modelName}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to test model: ${res.statusText}`);
    return res.json();
  },
};
