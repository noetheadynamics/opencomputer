import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";

interface NotificationCenterProps {
  onNavigate?: (panel: string) => void;
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { notifications, unreadCount, markRead, markAllRead, clear } =
    useNotifications();

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-oc-accent" />
          <h2 className="text-lg font-semibold text-oc-text-primary">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-oc-accent text-[10px] font-bold text-oc-bg">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={markAllRead}
            className="rounded-lg p-1.5 text-oc-text-secondary hover:text-oc-accent"
            title="Mark all read"
          >
            <CheckCheck size={16} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={clear}
            className="rounded-lg p-1.5 text-oc-text-secondary hover:text-red-400"
            title="Clear all"
          >
            <Trash2 size={16} />
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            No notifications
          </p>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={markRead}
                onClick={(panel) => {
                  if (panel) onNavigate?.(panel);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
