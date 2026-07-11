import { useState, useCallback, useEffect } from "react";
import type { TaskQueueItem } from "@/types/taskQueue";
import * as queueLib from "@/lib/taskQueue";

export function useTaskQueue() {
  const [tasks, setTasks] = useState<TaskQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<TaskQueueItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await queueLib.listTaskQueue();
    setTasks(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const selectTask = useCallback(async (id: string) => {
    setSelectedId(id);
    const detail = await queueLib.getTaskDetail(id);
    setSelectedDetail(detail);
  }, []);

  const deselectTask = useCallback(() => {
    setSelectedId(null);
    setSelectedDetail(null);
  }, []);

  const cancelTask = useCallback(async (id: string) => {
    const ok = await queueLib.cancelTask(id);
    if (ok) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: "cancelled" as const } : t,
        ),
      );
    }
    return ok;
  }, []);

  return {
    tasks,
    loading,
    selectedId,
    selectedDetail,
    refresh,
    selectTask,
    deselectTask,
    cancelTask,
  };
}
