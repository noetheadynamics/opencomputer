/**
 * useMemory — hook for memory stats, truth vault, cross-session state, and unified search.
 */

import { useState, useCallback } from 'react';
import { memoryApi } from '../lib/memory';
import type { MemoryStats, TruthVaultFact, CrossSessionState, MemoryInteraction } from '../types/memory';

interface SearchResult {
  truth_vault: TruthVaultFact[];
  memory_store: MemoryInteraction[];
  conversations: { id: string; title: string; updated_at: string }[];
}

export function useMemory() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [truthVault, setTruthVault] = useState<TruthVaultFact[]>([]);
  const [crossSession, setCrossSession] = useState<CrossSessionState | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await memoryApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTruthVault = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await memoryApi.getTruthVault();
      setTruthVault(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load truth vault');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCrossSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await memoryApi.getCrossSessionState();
      setCrossSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cross-session state');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchAll = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await memoryApi.searchAll(query);
      setSearchResults(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    truthVault,
    crossSession,
    searchResults,
    loading,
    error,
    loadStats,
    loadTruthVault,
    loadCrossSession,
    searchAll,
  };
}
