/**
 * Hook for harness management.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Harness } from '../types/harness';
import {
  listHarnesses,
  activateHarness,
  installHarness,
  uninstallHarness,
} from '../lib/harness';

interface UseHarnessReturn {
  harnesses: Harness[];
  activeHarnessId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  activate: (harnessId: string) => Promise<void>;
  install: (request: {
    harness_id: string;
    name: string;
    version: string;
    description: string;
    entry_point: string;
    supports_file_tools?: boolean;
    supports_terminal?: boolean;
    supports_git?: boolean;
    supports_cron?: boolean;
  }) => Promise<void>;
  uninstall: (harnessId: string) => Promise<void>;
}

export function useHarness(): UseHarnessReturn {
  const [harnesses, setHarnesses] = useState<Harness[]>([]);
  const [activeHarnessId, setActiveHarnessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listHarnesses();
      setHarnesses(response.harnesses);
      setActiveHarnessId(response.active_harness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load harnesses');
    } finally {
      setLoading(false);
    }
  }, []);

  const activate = useCallback(async (harnessId: string) => {
    try {
      setError(null);
      await activateHarness({ harness_id: harnessId });
      setActiveHarnessId(harnessId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate harness');
      throw err;
    }
  }, []);

  const install = useCallback(async (request: {
    harness_id: string;
    name: string;
    version: string;
    description: string;
    entry_point: string;
    supports_file_tools?: boolean;
    supports_terminal?: boolean;
    supports_git?: boolean;
    supports_cron?: boolean;
  }) => {
    try {
      setError(null);
      await installHarness(request);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install harness');
      throw err;
    }
  }, [refresh]);

  const uninstall = useCallback(async (harnessId: string) => {
    try {
      setError(null);
      await uninstallHarness(harnessId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall harness');
      throw err;
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    harnesses,
    activeHarnessId,
    loading,
    error,
    refresh,
    activate,
    install,
    uninstall,
  };
}
