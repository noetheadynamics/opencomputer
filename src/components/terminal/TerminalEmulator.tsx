import * as React from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface TerminalEmulatorProps {
  onExecute: (command: string) => void;
  outputLines: string[];
}

export function TerminalEmulator({ onExecute, outputLines }: TerminalEmulatorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const termInstance = React.useRef<Terminal | null>(null);
  const fitAddon = React.useRef<FitAddon | null>(null);
  const commandBuffer = React.useRef("");
  const [ready, setReady] = React.useState(false);

  // Initialize xterm
  React.useEffect(() => {
    if (!containerRef.current || termInstance.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      theme: {
        background: "#050605",
        foreground: "#E8EDED",
        cursor: "#34D399",
        cursorAccent: "#050605",
        selectionBackground: "rgba(52, 211, 153, 0.2)",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);

    term.open(containerRef.current);
    fit.fit();

    termInstance.current = term;
    fitAddon.current = fit;

    // Welcome message
    term.writeln("\x1b[1;36m  OpenComputer Terminal\x1b[0m");
    term.writeln("\x1b[90m  Type commands below. History: ↑↓\x1b[0m");
    term.writeln("");
    term.write("\x1b[1;32m❯\x1b[0m ");

    // Handle input
    term.onData((data) => {
      if (data === "\r") {
        // Enter
        const cmd = commandBuffer.current.trim();
        term.writeln("");
        if (cmd) {
          onExecute(cmd);
        }
        commandBuffer.current = "";
        term.write("\x1b[1;32m❯\x1b[0m ");
      } else if (data === "\x7f") {
        // Backspace
        if (commandBuffer.current.length > 0) {
          commandBuffer.current = commandBuffer.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (data === "\x1b[A") {
        // Arrow up — skip for now (could add history)
      } else if (data === "\x1b[B") {
        // Arrow down — skip for now
      } else if (data >= " ") {
        // Printable character
        commandBuffer.current += data;
        term.write(data);
      }
    });

    setReady(true);

    // Handle resize
    const observer = new ResizeObserver(() => {
      fitAddon.current?.fit();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      termInstance.current = null;
    };
  }, []);

  // Write output lines to terminal
  React.useEffect(() => {
    const term = termInstance.current;
    if (!term || !ready) return;

    // Write new lines (skip the ones already written)
    const lastLines = outputLines.slice(-50);
    for (const line of lastLines) {
      if (line.startsWith("$ ")) {
        // Command echo — already shown via input
        continue;
      }
      if (line.startsWith("[error] ")) {
        term.writeln(`\x1b[31m${line}\x1b[0m`);
      } else if (line.startsWith("[exit code ")) {
        term.writeln(`\x1b[33m${line}\x1b[0m`);
      } else {
        term.writeln(line);
      }
    }
  }, [outputLines, ready]);

  return (
    <div className="h-full w-full bg-oc-bg p-1">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
