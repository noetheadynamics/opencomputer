import type { CronJob, CronJobCreate } from "@/types/cron";
import { PHAOS_BASE } from "./config";

export async function listCronJobs(): Promise<CronJob[]> {
  const res = await fetch(`${PHAOS_BASE}/api/cron/`);
  if (!res.ok) throw new Error(`Failed to load cron jobs: ${res.status}`);
  return res.json();
}

export async function createCronJob(req: CronJobCreate): Promise<CronJob> {
  const res = await fetch(`${PHAOS_BASE}/api/cron/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to create cron job: ${res.status}`);
  return res.json();
}

export async function updateCronJob(
  id: string,
  updates: Partial<CronJob>,
): Promise<CronJob> {
  const res = await fetch(`${PHAOS_BASE}/api/cron/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update cron job: ${res.status}`);
  return res.json();
}

export async function deleteCronJob(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/cron/${id}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}
