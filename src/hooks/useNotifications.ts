import { useState, useCallback, useEffect } from "react";
import type { AppNotification, NotificationType } from "@/types/notifications";
import * as notifLib from "@/lib/notifications";

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(
    notifLib.getNotifications,
  );
  const [unreadCount, setUnreadCount] = useState(notifLib.getUnreadCount);

  useEffect(() => {
    return notifLib.onNotificationsChange(() => {
      setNotifications(notifLib.getNotifications());
      setUnreadCount(notifLib.getUnreadCount());
    });
  }, []);

  const add = useCallback(
    (type: NotificationType, title: string, body: string, opts?: { actionPanel?: string; taskId?: string }) => {
      return notifLib.addNotification(type, title, body, opts);
    },
    [],
  );

  const markRead = useCallback((id: string) => {
    notifLib.markRead(id);
  }, []);

  const markAllRead = useCallback(() => {
    notifLib.markAllRead();
  }, []);

  const clear = useCallback(() => {
    notifLib.clearNotifications();
  }, []);

  return { notifications, unreadCount, add, markRead, markAllRead, clear };
}
