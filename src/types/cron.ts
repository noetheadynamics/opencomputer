export interface CronJob {
  id: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
  lastStatus: "success" | "failure" | null;
  nextRun: string;
  createdAt: string;
}

export interface CronJobCreate {
  description: string;
  schedule: string;
  enabled: boolean;
}
