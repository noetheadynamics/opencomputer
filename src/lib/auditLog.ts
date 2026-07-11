import type { AuditLogEntry, AuditLogFilters } from "@/types/auditLog";
import { PHAOS_BASE } from "./config";

let _log: AuditLogEntry[] = [];

export async function listAuditLogs(
  filters?: AuditLogFilters,
): Promise<AuditLogEntry[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.action) params.set("action", filters.action);
    if (filters?.outcome) params.set("outcome", filters.outcome);
    if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters?.dateTo) params.set("date_to", filters.dateTo);
    const qs = params.toString();
    const res = await fetch(`${PHAOS_BASE}/api/audit/${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error(`${res.status}`);
    _log = await res.json();
    return _log;
  } catch {
    throw new Error('Failed to load audit logs');
  }
}

export function exportAuditLogCsv(entries: AuditLogEntry[]): string {
  const header = "Timestamp,Action,Description,Outcome,Task ID\n";
  const rows = entries
    .map(
      (e) =>
        `"${e.timestamp}","${e.action}","${e.description.replace(/"/g, '""')}","${e.outcome}","${e.taskId ?? ""}"`,
    )
    .join("\n");
  return header + rows;
}
