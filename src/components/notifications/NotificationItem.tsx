import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Shield,
  Clock,
} from "lucide-react";
import type { AppNotification, NotificationType } from "@/types/notifications";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onClick?: (panel?: string) => void;
}

const ICON_MAP: Record<NotificationType, typeof CheckCircle> = {
  task_completed: CheckCircle,
  task_failed: XCircle,
  task_abstained: AlertTriangle,
  permission_required: Shield,
  cron_result: Clock,
  info: Info,
};

const COLOR_MAP: Record<NotificationType, string> = {
  task_completed: "text-oc-accent",
  task_failed: "text-red-400",
  task_abstained: "text-yellow-400",
  permission_required: "text-orange-400",
  cron_result: "text-blue-400",
  info: "text-oc-text-secondary",
};

export function NotificationItem({
  notification: n,
  onMarkRead,
  onClick,
}: NotificationItemProps) {
  const Icon = ICON_MAP[n.type];
  const color = COLOR_MAP[n.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: -2 }}
      onClick={() => {
        onMarkRead(n.id);
        onClick?.(n.actionPanel);
      }}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors",
        "hover:bg-oc-surface/50",
        !n.read && "bg-oc-accent/5",
      )}
    >
      <Icon size={16} className={cn("mt-0.5 shrink-0", color)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-oc-text-primary">{n.title}</p>
        <p className="text-xs text-oc-text-secondary line-clamp-2">{n.body}</p>
        <p className="mt-1 text-[10px] text-oc-text-secondary/60">
          {new Date(n.timestamp).toLocaleTimeString()}
        </p>
      </div>
      {!n.read && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-oc-accent" />
      )}
    </motion.div>
  );
}
