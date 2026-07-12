import type { TaskQueueItem, TaskQueueStatus } from "@/types/taskQueue";
import { PHAOS_BASE } from "./config";

let _tasks: TaskQueueItem[] = [];

export async function listTaskQueue(): Promise<TaskQueueItem[]> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/tasks/`);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    _tasks = data.map((t: Record<string, unknown>) => ({
      id: t.id as string,
      prompt: t.prompt as string,
      status: t.status as TaskQueueStatus,
      category: (t.category as number) ?? null,
      iterations: (t.iterations as number) ?? 0,
      toolCallsMade: (t.tool_calls_made as number) ?? 0,
      startTime: new Date(t.created_at as string).getTime(),
      endTime: t.updated_at ? new Date(t.updated_at as string).getTime() : undefined,
      result: (t.result as string) ?? undefined,
      error: (t.error as string) ?? undefined,
      steps: [],
    })) as TaskQueueItem[];
    return _tasks;
  } catch (e) {
    throw new Error(`Failed to load task queue: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function getTaskDetail(taskId: string): Promise<TaskQueueItem | null> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/tasks/${taskId}`);
    if (!res.ok) throw new Error(`${res.status}`);
    const t = await res.json();
    return {
      id: t.id,
      prompt: t.prompt,
      status: t.status,
      category: t.category,
      iterations: t.iterations,
      toolCallsMade: t.tool_calls_made,
      startTime: new Date(t.created_at).getTime(),
      endTime: t.updated_at ? new Date(t.updated_at).getTime() : undefined,
      result: t.result ?? undefined,
      error: t.error ?? undefined,
      steps: [],
    };
  } catch {
    return null;
  }
}

export async function cancelTask(taskId: string): Promise<boolean> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
