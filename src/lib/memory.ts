/**
 * Memory API client for OpenComputer — calls PHAOS memory endpoints.
 */

import type {
  TruthVaultFact,
  CrossSessionState,
  MemoryInteraction,
  MemoryStats,
  CorrectionRequest,
} from '../types/memory';
import { PHAOS_BASE } from './config';

export const memoryApi = {
  // ── Truth Vault ──────────────────────────────────────────────────

  getTruthVault: async (limit = 100, factType?: string): Promise<TruthVaultFact[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (factType) params.set('fact_type', factType);
    const res = await fetch(`${PHAOS_BASE}/api/memory/truth-vault?${params}`);
    if (!res.ok) throw new Error(`Failed to get truth vault: ${res.statusText}`);
    return res.json();
  },

  deleteTruthVaultFact: async (id: string): Promise<void> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/truth-vault/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete fact: ${res.statusText}`);
  },

  // ── Cross-Session State ──────────────────────────────────────────

  getCrossSessionState: async (): Promise<CrossSessionState> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/cross-session-state`);
    if (!res.ok) throw new Error(`Failed to get cross-session state: ${res.statusText}`);
    return res.json();
  },

  deleteMilestone: async (id: string): Promise<void> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/cross-session-state/milestone/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete milestone: ${res.statusText}`);
  },

  // ── Memory Store ─────────────────────────────────────────────────

  getMemoryStore: async (params: {
    query?: string;
    limit?: number;
    success_only?: boolean;
  }): Promise<MemoryInteraction[]> => {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set('query', params.query);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.success_only !== undefined) searchParams.set('success_only', String(params.success_only));
    const res = await fetch(`${PHAOS_BASE}/api/memory/memory-store?${searchParams}`);
    if (!res.ok) throw new Error(`Failed to get memory store: ${res.statusText}`);
    return res.json();
  },

  deleteInteraction: async (id: string): Promise<void> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/memory-store/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete interaction: ${res.statusText}`);
  },

  // ── Stats ────────────────────────────────────────────────────────

  getStats: async (): Promise<MemoryStats> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/stats`);
    if (!res.ok) throw new Error(`Failed to get stats: ${res.statusText}`);
    return res.json();
  },

  // ── Export ───────────────────────────────────────────────────────

  exportAll: async (): Promise<Blob> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/export`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to export: ${res.statusText}`);
    return res.blob();
  },

  // ── Cleanup ──────────────────────────────────────────────────────

  cleanup: async (days: number): Promise<{ success: boolean; days: number; deleted_count?: number }> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    if (!res.ok) throw new Error(`Failed to cleanup: ${res.statusText}`);
    return res.json();
  },

  // ── Corrections / Feedback ───────────────────────────────────────

  storeCorrection: async (data: CorrectionRequest): Promise<{ id: string }> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/corrections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to store correction: ${res.statusText}`);
    return res.json();
  },

  storeMessageFeedback: async (
    messageId: string,
    type: 'up' | 'down'
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/memory/feedback/${messageId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) throw new Error(`Failed to store feedback: ${res.statusText}`);
    return res.json();
  },

  // ── Unified Search ───────────────────────────────────────────────

  searchAll: async (query: string): Promise<{
    truth_vault: TruthVaultFact[];
    memory_store: MemoryInteraction[];
    conversations: { id: string; title: string; updated_at: string }[];
  }> => {
    const params = new URLSearchParams({ q: query });
    const res = await fetch(`${PHAOS_BASE}/api/memory/search?${params}`);
    if (!res.ok) throw new Error(`Failed to search: ${res.statusText}`);
    return res.json();
  },
};
