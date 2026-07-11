import type { CronJob, CronJobCreate } from "@/types/cron";
import { PHAOS_BASE } from "./config";

let _jobs: CronJob[] = [];

export async function listCronJobs(): Promise<CronJob[]> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/cron/`);
    if (!res.ok) throw new Error(`${res.status}`);
    _jobs = await res.json();
    return _jobs;
  } catch {
    throw new Error('Failed to load cron jobs');
  }
}

export async function createCronJob(req: CronJobCreate): Promise<CronJob> {
  const job: CronJob = {
    id: `cron-${Date.now()}`,
    ...req,
    lastRun: null,
    lastStatus: null,
    nextRun: new Date(Date.now() + 3600000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  _jobs.push(job);
  return job;
}

export async function updateCronJob(
  id: string,
  updates: Partial<CronJob>,
): Promise<CronJob | null> {
  const job = _jobs.find((j) => j.id === id);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

export async function deleteCronJob(id: string): Promise<boolean> {
  const len = _jobs.length;
  _jobs = _jobs.filter((j) => j.id !== id);
  return _jobs.length < len;
}
