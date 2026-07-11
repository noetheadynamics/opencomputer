/**
 * Subagent Manager API client.
 */

import type { SubagentConfig, SubagentCreateRequest, SubagentTestResult } from '../types/subagent';
import { PHAOS_BASE } from './config';

export const subagentApi = {
  list: async (): Promise<{ subagents: SubagentConfig[] }> => {
    const res = await fetch(`${PHAOS_BASE}/api/subagents/`);
    if (!res.ok) throw new Error(`Failed to list subagents: ${res.statusText}`);
    return res.json();
  },

  get: async (id: string): Promise<SubagentConfig> => {
    const res = await fetch(`${PHAOS_BASE}/api/subagents/${id}`);
    if (!res.ok) throw new Error(`Failed to get subagent: ${res.statusText}`);
    return res.json();
  },

  create: async (data: SubagentCreateRequest): Promise<{ id: string; success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/subagents/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create subagent: ${res.statusText}`);
    return res.json();
  },

  update: async (id: string, data: Partial<SubagentCreateRequest>): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/subagents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update subagent: ${res.statusText}`);
    return res.json();
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/subagents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete subagent: ${res.statusText}`);
    return res.json();
  },

  toggle: async (id: string, enabled: boolean): Promise<{ success: boolean; enabled: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/subagents/${id}/toggle?enabled=${enabled}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to toggle subagent: ${res.statusText}`);
    return res.json();
  },

  test: async (id: string, query: string): Promise<SubagentTestResult> => {
    const res = await fetch(`${PHAOS_BASE}/api/subagents/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`Failed to test subagent: ${res.statusText}`);
    return res.json();
  },
};
