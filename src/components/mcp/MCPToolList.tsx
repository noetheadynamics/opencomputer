import type { MCPTool } from "@/types/mcp";

interface MCPToolListProps {
  tools: MCPTool[];
}

export function MCPToolList({ tools }: MCPToolListProps) {
  if (!tools.length) {
    return (
      <p className="text-xs text-oc-text-secondary italic">No tools discovered</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tools.map((tool) => (
        <span
          key={tool.name}
          className="rounded-md bg-oc-accent/10 px-2 py-0.5 text-xs text-oc-accent"
          title={tool.description ?? ""}
        >
          {tool.name}
        </span>
      ))}
    </div>
  );
}
