import { isTauri } from "./storage";
import {
  NETWORK_COMMANDS,
  type RiskAssessment,
  type CommandOutput,
  type HistoryEntry,
} from "@/types/terminal";

/* ------------------------------------------------------------------ */
/* Risk classification (Critical Rule 3: network commands blocked)     */
/* ------------------------------------------------------------------ */

export function classifyRisk(command: string): RiskAssessment {
  const trimmed = command.trim();
  const firstWord = trimmed.split(/\s+/)[0] ?? "";
  const base = firstWord.split("/").pop() ?? "";

  if (NETWORK_COMMANDS.includes(base)) {
    return {
      level: "high",
      reason: `Network command "${base}" is blocked by default.`,
    };
  }

  const highPatterns = [
    /\brm\s+-rf\b/,
    /\bsudo\b/,
    /\bchmod\s+777\b/,
    /\bmkfs\b/,
    /\bdd\b/,
    /\bformat\b/,
    /\bkill\s+-9\b/,
    /\bshutdown\b/,
    /\breboot\b/,
    />\s*\/dev\/sd/,
  ];
  for (const p of highPatterns) {
    if (p.test(trimmed)) {
      return { level: "high", reason: `Dangerous pattern detected: ${p.source}` };
    }
  }

  const mediumPatterns = [
    /\brm\b/,
    /\bmv\b/,
    /\bchmod\b/,
    /\bchown\b/,
    /\bkill\b/,
    /\bpkill\b/,
    /\bsu\b/,
  ];
  for (const p of mediumPatterns) {
    if (p.test(trimmed)) {
      return { level: "medium", reason: `Moderate risk command: ${p.source}` };
    }
  }

  return { level: "low", reason: "Standard command" };
}

export function requiresConfirmation(risk: RiskAssessment): boolean {
  return risk.level === "high";
}

/* ------------------------------------------------------------------ */
/* Browser mock (runs commands locally in-browser for testing)         */
/* ------------------------------------------------------------------ */

const mockHistory: HistoryEntry[] = [];

function mockExecute(command: string, _projectRoot: string): CommandOutput {
  const parts = command.trim().split(/\s+/);
  const bin = parts[0] ?? "";
  const args = parts.slice(1);

  // Echo mock
  if (bin === "echo") {
    const stdout = args.join(" ");
    const entry: HistoryEntry = { command, output: stdout, timestamp: Date.now() };
    mockHistory.push(entry);
    return { stdout, stderr: "", exit_code: 0, timed_out: false };
  }

  // Pwd mock
  if (bin === "pwd") {
    const stdout = _projectRoot;
    const entry: HistoryEntry = { command, output: stdout, timestamp: Date.now() };
    mockHistory.push(entry);
    return { stdout, stderr: "", exit_code: 0, timed_out: false };
  }

  // Ls mock
  if (bin === "ls") {
    const stdout = "README.md\npackage.json\nsrc/\ndocs/\n";
    const entry: HistoryEntry = { command, output: stdout, timestamp: Date.now() };
    mockHistory.push(entry);
    return { stdout, stderr: "", exit_code: 0, timed_out: false };
  }

  // Cat mock
  if (bin === "cat") {
    const file = args[0] ?? "";
    if (file === "README.md") {
      const stdout = "# OpenComputer\n\nWelcome to your project.\n";
      const entry: HistoryEntry = { command, output: stdout, timestamp: Date.now() };
      mockHistory.push(entry);
      return { stdout, stderr: "", exit_code: 0, timed_out: false };
    }
    const stdout = `Mock content for ${file}\n`;
    const entry: HistoryEntry = { command, output: stdout, timestamp: Date.now() };
    mockHistory.push(entry);
    return { stdout, stderr: "", exit_code: 0, timed_out: false };
  }

  // Date mock
  if (bin === "date") {
    const stdout = new Date().toString();
    const entry: HistoryEntry = { command, output: stdout, timestamp: Date.now() };
    mockHistory.push(entry);
    return { stdout, stderr: "", exit_code: 0, timed_out: false };
  }

  // Whoami mock
  if (bin === "whoami") {
    const stdout = "opencomputer-user";
    const entry: HistoryEntry = { command, output: stdout, timestamp: Date.now() };
    mockHistory.push(entry);
    return { stdout, stderr: "", exit_code: 0, timed_out: false };
  }

  // Unknown command
  const stderr = `Command not found in browser mock: ${bin}`;
  const entry: HistoryEntry = { command, output: stderr, timestamp: Date.now() };
  mockHistory.push(entry);
  return { stdout: "", stderr, exit_code: 127, timed_out: false };
}

export function getMockHistory(): HistoryEntry[] {
  return mockHistory;
}

/* ------------------------------------------------------------------ */
/* Tauri invoke wrapper                                               */
/* ------------------------------------------------------------------ */

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export async function executeCommand(
  command: string,
  projectRoot: string,
): Promise<CommandOutput> {
  if (isTauri()) {
    try {
      return await tauriInvoke<CommandOutput>("execute_command", {
        command,
        projectRoot,
      });
    } catch (e) {
      return {
        stdout: "",
        stderr: String(e),
        exit_code: 1,
        timed_out: false,
      };
    }
  }

  return mockExecute(command, projectRoot);
}

export function getHistory(): HistoryEntry[] {
  if (isTauri()) {
    return mockHistory; // Tauri history managed server-side
  }
  return mockHistory;
}
