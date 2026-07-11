import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { cn } from "@/lib/utils";

interface NotificationCenterProps {
  onNavigate?: (panel: string) => void;
}

export function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { notifications, unreadCount, markRead, markAllRead, clear } =
    useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(!open)}
        className="oc-floating-icon relative"
      >
        <Bell size={18} className="text-oc-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-oc-accent text-[9px] font-bold text-oc-bg">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={cn(
                "absolute right-0 top-full z-50 mt-2 w-80",
                "rounded-2xl border border-oc-surface-border",
                "bg-oc-surface/90 backdrop-blur-xl shadow-xl",
              )}
            >
              <div className="flex items-center justify-between border-b border-oc-surface-border px-4 py-3">
                <span className="text-sm font-medium text-oc-text-primary">
                  Notifications
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={markAllRead}
                    className="text-oc-text-secondary hover:text-oc-accent"
                    title="Mark all read"
                  >
                    <CheckCheck size={14} />
                  </button>
                  <button
                    onClick={clear}
                    className="text-oc-text-secondary hover:text-red-400"
                    title="Clear all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-sm text-oc-text-secondary">
                    No notifications
                  </p>
                ) : (
                  notifications.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onMarkRead={markRead}
                      onClick={(panel) => {
                        if (panel) onNavigate?.(panel);
                        setOpen(false);
                      }}
                    />
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
