/**
 * User Preferences API client.
 */

import { PHAOS_BASE } from './config';

export const preferencesApi = {
  getAll: async (): Promise<Record<string, unknown>> => {
    const res = await fetch(`${PHAOS_BASE}/api/preferences`);
    if (!res.ok) throw new Error(`Failed to get preferences: ${res.statusText}`);
    return res.json();
  },

  get: async (key: string): Promise<{ key: string; value: unknown }> => {
    const res = await fetch(`${PHAOS_BASE}/api/preferences/${key}`);
    if (!res.ok) throw new Error(`Failed to get preference: ${res.statusText}`);
    return res.json();
  },

  set: async (key: string, value: unknown): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/preferences/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error(`Failed to set preference: ${res.statusText}`);
    return res.json();
  },

  delete: async (key: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/preferences/${key}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete preference: ${res.statusText}`);
    return res.json();
  },
};
