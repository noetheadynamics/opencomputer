import * as React from "react";

interface TerminalEmulatorProps {
  onExecute: (command: string) => void;
  outputLines: string[];
}

export function TerminalEmulator({ onExecute, outputLines }: TerminalEmulatorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = React.useState("");
  const [commandHistory, setCommandHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);

  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [outputLines]);

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      onExecute(inputValue.trim());
      setCommandHistory((prev) => [...prev, inputValue.trim()]);
      setHistoryIndex(-1);
      setInputValue("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInputValue("");
        } else {
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[newIndex]);
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className="flex h-full flex-col overflow-auto bg-oc-bg p-4 font-mono text-sm"
    >
      {outputLines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap text-oc-text-primary">
          {line}
        </div>
      ))}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-oc-accent">$</span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-oc-text-primary outline-none placeholder-oc-text-secondary/50"
          placeholder="Type a command..."
          autoFocus
        />
      </div>
    </div>
  );
}
