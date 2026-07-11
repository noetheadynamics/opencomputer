import { useState, useCallback, useEffect } from "react";
import type { CronJob, CronJobCreate } from "@/types/cron";
import * as cronLib from "@/lib/cron";

export function useCron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await cronLib.listCronJobs();
    setJobs(data);
    setLoading(false);
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
    await cronLib.updateCronJob(id, { enabled });
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, enabled } : j)),
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    await cronLib.deleteCronJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  return { jobs, loading, refresh, create, toggle, remove };
}
