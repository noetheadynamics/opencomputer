import type { AppNotification, NotificationType } from "@/types/notifications";
import { PHAOS_BASE } from "./config";

let _notifications: AppNotification[] = [];
let _listeners: Array<() => void> = [];

export function getNotifications(): AppNotification[] {
  return [..._notifications].sort((a, b) => b.timestamp - a.timestamp);
}

export function getUnreadCount(): number {
  return _notifications.filter((n) => !n.read).length;
}

export function addNotification(
  type: NotificationType,
  title: string,
  body: string,
  opts?: { actionPanel?: string; taskId?: string },
): AppNotification {
  const n: AppNotification = {
    id: crypto.randomUUID().slice(0, 8),
    type,
    title,
    body,
    read: false,
    timestamp: Date.now(),
    ...opts,
  };
  _notifications.unshift(n);
  _notify();

  fetch(`${PHAOS_BASE}/api/notifications/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, message: body, type }),
  }).catch(() => {});

  return n;
}

export function markRead(id: string): void {
  const n = _notifications.find((x) => x.id === id);
  if (n) n.read = true;
  _notify();

  fetch(`${PHAOS_BASE}/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
}

export function markAllRead(): void {
  _notifications.forEach((n) => (n.read = true));
  _notify();

  fetch(`${PHAOS_BASE}/api/notifications/read-all`, { method: "PATCH" }).catch(() => {});
}

export function clearNotifications(): void {
  _notifications = [];
  _notify();
  fetch(`${PHAOS_BASE}/api/notifications/`, { method: "DELETE" }).catch(() => {});
}

export async function loadNotifications(): Promise<void> {
  try {
    const res = await fetch(`${PHAOS_BASE}/api/notifications/`);
    if (!res.ok) return;
    const data = await res.json();
    _notifications = data.map((n: Record<string, unknown>) => ({
      id: n.id as string,
      type: (n.type as NotificationType) ?? "info",
      title: n.title as string,
      body: n.message as string,
      read: n.read as boolean,
      timestamp: n.createdAt ? new Date(n.createdAt as string).getTime() || Date.now() : Date.now(),
    }));
    _notify();
  } catch {}
}

export function onNotificationsChange(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}

function _notify() {
  for (const l of _listeners) {
    try { l(); } catch { /* swallow */ }
  }
}
