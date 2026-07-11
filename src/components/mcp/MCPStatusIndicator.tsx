const STATUS_STYLES: Record<string, string> = {
  running: "bg-green-500",
  installed: "bg-blue-500",
  stopped: "bg-gray-500",
  not_installed: "bg-gray-400",
  error: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Running",
  installed: "Installed",
  stopped: "Stopped",
  not_installed: "Not Installed",
  error: "Error",
};

interface MCPStatusIndicatorProps {
  status: string;
  showLabel?: boolean;
}

export function MCPStatusIndicator({ status, showLabel = false }: MCPStatusIndicatorProps) {
  const dot = STATUS_STYLES[status] ?? "bg-gray-400";
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} title={label} />
      {showLabel && (
        <span className="text-xs text-oc-text-secondary">{label}</span>
      )}
    </span>
  );
}
