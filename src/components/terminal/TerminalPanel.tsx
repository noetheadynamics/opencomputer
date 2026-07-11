import * as React from "react";
import { useTerminal } from "@/hooks/useTerminal";
import { TerminalEmulator } from "./TerminalEmulator";
import { RiskConfirmationDialog } from "./RiskConfirmationDialog";

interface TerminalPanelProps {
  projectRoot: string;
}

export function TerminalPanel({ projectRoot }: TerminalPanelProps) {
  const {
    history,
    execute,
    confirmPending,
    cancelPending,
    currentRisk,
    pendingCommand,
  } = useTerminal(projectRoot);

  const [outputLines, setOutputLines] = React.useState<string[]>([
    "Welcome to OpenComputer Terminal",
    `Working directory: ${projectRoot}`,
    "Type 'help' for available commands.",
    "",
  ]);

  const handleExecute = React.useCallback(
    async (command: string) => {
      // Add prompt line
      setOutputLines((prev) => [...prev, `$ ${command}`]);

      const output = await execute(command);

      if (output.stdout) {
        setOutputLines((prev) => [...prev, output.stdout]);
      }
      if (output.stderr) {
        setOutputLines((prev) => [...prev, `[error] ${output.stderr}`]);
      }
      if (output.exit_code !== 0) {
        setOutputLines((prev) => [...prev, `[exit code ${output.exit_code}]`]);
      }
    },
    [execute],
  );

  const handleConfirm = React.useCallback(async () => {
    setOutputLines((prev) => [...prev, `$ ${pendingCommand}`]);
    const output = await confirmPending();

    if (output.stdout) {
      setOutputLines((prev) => [...prev, output.stdout]);
    }
    if (output.stderr) {
      setOutputLines((prev) => [...prev, `[error] ${output.stderr}`]);
    }
    if (output.exit_code !== 0) {
      setOutputLines((prev) => [...prev, `[exit code ${output.exit_code}]`]);
    }
  }, [confirmPending, pendingCommand]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center px-4 py-2">
        <h2 className="text-sm font-semibold text-oc-text-primary">Terminal</h2>
        <span className="ml-2 text-xs text-oc-text-secondary">
          {history.length} command{history.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <TerminalEmulator onExecute={handleExecute} outputLines={outputLines} />
      </div>
      <RiskConfirmationDialog
        risk={currentRisk}
        command={pendingCommand}
        onConfirm={handleConfirm}
        onCancel={cancelPending}
      />
    </div>
  );
}
