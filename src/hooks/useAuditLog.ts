import { useState, useCallback, useEffect } from "react";
import type { AuditLogEntry, AuditLogFilters } from "@/types/auditLog";
import * as auditLib from "@/lib/auditLog";

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await auditLib.listAuditLogs(filters);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateFilters = useCallback((f: AuditLogFilters) => {
    setFilters(f);
  }, []);

  const exportCsv = useCallback(() => {
    return auditLib.exportAuditLogCsv(entries);
  }, [entries]);

  return { entries, loading, error, filters, updateFilters, refresh, exportCsv };
}
