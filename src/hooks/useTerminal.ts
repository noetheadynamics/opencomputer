import * as React from "react";
import {
  classifyRisk,
  requiresConfirmation,
  executeCommand,
  getHistory,
} from "@/lib/terminal";
import type { RiskAssessment, CommandOutput, HistoryEntry } from "@/types/terminal";

interface TerminalState {
  history: HistoryEntry[];
  currentRisk: RiskAssessment | null;
  pendingCommand: string | null;
}

interface UseTerminalReturn {
  history: HistoryEntry[];
  execute: (command: string) => Promise<CommandOutput>;
  confirmPending: () => Promise<CommandOutput>;
  cancelPending: () => void;
  currentRisk: RiskAssessment | null;
  pendingCommand: string | null;
}

export function useTerminal(projectRoot: string): UseTerminalReturn {
  const [state, setState] = React.useState<TerminalState>({
    history: [],
    currentRisk: null,
    pendingCommand: null,
  });

  const execute = React.useCallback(
    async (command: string): Promise<CommandOutput> => {
      const trimmed = command.trim();
      if (!trimmed) {
        return { stdout: "", stderr: "", exit_code: 0, timed_out: false };
      }

      const risk = classifyRisk(trimmed);

      if (requiresConfirmation(risk)) {
        setState((prev) => ({
          ...prev,
          currentRisk: risk,
          pendingCommand: trimmed,
        }));
        // Return empty — actual execution happens in confirmPending
        return { stdout: "", stderr: "", exit_code: 0, timed_out: false };
      }

      const output = await executeCommand(trimmed, projectRoot);
      const history = await getHistory();

      setState((prev) => ({
        ...prev,
        history,
      }));

      return output;
    },
    [projectRoot],
  );

  const confirmPending = React.useCallback(async (): Promise<CommandOutput> => {
    const pending = state.pendingCommand;
    if (!pending) {
      return { stdout: "", stderr: "", exit_code: 0, timed_out: false };
    }

    const output = await executeCommand(pending, projectRoot);
    const history = await getHistory();

    setState((prev) => ({
      ...prev,
      history,
      currentRisk: null,
      pendingCommand: null,
    }));

    return output;
  }, [state.pendingCommand, projectRoot]);

  const cancelPending = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentRisk: null,
      pendingCommand: null,
    }));
  }, []);

  // Load history on mount
  React.useEffect(() => {
    getHistory().then((history) => {
      setState((prev) => ({ ...prev, history }));
    });
  }, []);

  return {
    history: state.history,
    execute,
    confirmPending,
    cancelPending,
    currentRisk: state.currentRisk,
    pendingCommand: state.pendingCommand,
  };
}
