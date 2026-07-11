import type { AppNotification, NotificationType } from "@/types/notifications";

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
  return n;
}

export function markRead(id: string): void {
  const n = _notifications.find((x) => x.id === id);
  if (n) n.read = true;
  _notify();
}

export function markAllRead(): void {
  _notifications.forEach((n) => (n.read = true));
  _notify();
}

export function clearNotifications(): void {
  _notifications = [];
  _notify();
}

export function onNotificationsChange(fn: () => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}

function _notify() {
  _listeners.forEach((l) => l());
}
