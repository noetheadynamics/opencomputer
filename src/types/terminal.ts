export type RiskLevel = "low" | "medium" | "high";

export interface CommandOutput {
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
}

export interface HistoryEntry {
  command: string;
  output: string;
  timestamp: number;
}

export interface RiskAssessment {
  level: RiskLevel;
  reason: string;
}

/** Commands denied by default (Critical Rule 3). */
export const NETWORK_COMMANDS = ["curl", "wget", "nc", "telnet", "ssh"];
