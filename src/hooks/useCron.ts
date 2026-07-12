import { useState, useCallback, useEffect } from "react";
import type { CronJob, CronJobCreate } from "@/types/cron";
import * as cronLib from "@/lib/cron";

export function useCron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await cronLib.listCronJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cron jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (req: CronJobCreate) => {
    const job = await cronLib.createCronJob(req);
    setJobs((prev) => [...prev, job]);
    return job;
  }, []);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      await cronLib.updateCronJob(id, { enabled });
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, enabled } : j)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle job");
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await cronLib.deleteCronJob(id);
    if (ok) {
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } else {
      setError("Failed to delete job");
    }
  }, []);

  return { jobs, loading, error, refresh, create, toggle, remove };
}
