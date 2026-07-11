interface MCPLogsViewProps {
  logs: string[];
}

export function MCPLogsView({ logs }: MCPLogsViewProps) {
  if (!logs.length) {
    return (
      <p className="text-xs text-oc-text-secondary italic">No logs available</p>
    );
  }

  return (
    <div className="max-h-40 overflow-y-auto rounded-md bg-black/30 p-2 font-mono text-xs text-green-400">
      {logs.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}
