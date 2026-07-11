/**
 * Background Tasks API client.
 */

import type { BackgroundTask, TaskCreateRequest } from '../types/backgroundTasks';
import { PHAOS_BASE } from './config';

export const backgroundTaskApi = {
  create: async (req: TaskCreateRequest): Promise<{ task_id: string }> => {
    const res = await fetch(`${PHAOS_BASE}/api/background-tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Failed to create task: ${res.statusText}`);
    return res.json();
  },

  start: async (taskId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/background-tasks/${taskId}/start`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to start task: ${res.statusText}`);
    return res.json();
  },

  pause: async (taskId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/background-tasks/${taskId}/pause`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to pause task: ${res.statusText}`);
    return res.json();
  },

  resume: async (taskId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/background-tasks/${taskId}/resume`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to resume task: ${res.statusText}`);
    return res.json();
  },

  cancel: async (taskId: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${PHAOS_BASE}/api/background-tasks/${taskId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to cancel task: ${res.statusText}`);
    return res.json();
  },

  getSessionTasks: async (sessionId: string): Promise<{ tasks: BackgroundTask[] }> => {
    const res = await fetch(`${PHAOS_BASE}/api/background-tasks/session/${sessionId}`);
    if (!res.ok) throw new Error(`Failed to get tasks: ${res.statusText}`);
    return res.json();
  },

  getStatus: async (taskId: string): Promise<BackgroundTask> => {
    const res = await fetch(`${PHAOS_BASE}/api/background-tasks/${taskId}/status`);
    if (!res.ok) throw new Error(`Failed to get status: ${res.statusText}`);
    return res.json();
  },
};
