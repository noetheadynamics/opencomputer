export interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
  lastStatus: "success" | "failure" | null;
  nextRun: string;
  createdAt: string;
}

export interface CronJobCreate {
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
}
