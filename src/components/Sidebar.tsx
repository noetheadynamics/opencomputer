import { motion } from "framer-motion";
import { Logo } from "./Logo";
import {
  MessageSquare,
  FolderOpen,
  TerminalSquare,
  GitBranch,
  Settings,
  ListTodo,
  Blocks,
  Clock,
  List,
  Shield,
  Brain,
  Bot,
  Plug,
  Search,
  Bell,
  BarChart3,
  Route,
  Layers,
  Keyboard,
  Loader,
  Wrench,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewKey =
  | "chat"
  | "files"
  | "terminal"
  | "git"
  | "todo"
  | "skills"
  | "cron"
  | "queue"
  | "audit"
  | "memory"
  | "subagents"
  | "mcp"
  | "search"
  | "notifications"
  | "performance"
  | "routing"
  | "merging"
  | "shortcuts"
  | "background"
  | "harness"
  | "prompt"
  | "settings";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "files", label: "Files", icon: FolderOpen },
  { key: "terminal", label: "Terminal", icon: TerminalSquare },
  { key: "git", label: "Git", icon: GitBranch },
  { key: "search", label: "Search", icon: Search },
  { key: "todo", label: "To-Do", icon: ListTodo },
  { key: "skills", label: "Skills", icon: Blocks },
  { key: "cron", label: "Schedule", icon: Clock },
  { key: "queue", label: "Tasks", icon: List },
  { key: "background", label: "Background", icon: Loader },
  { key: "audit", label: "Audit", icon: Shield },
  { key: "memory", label: "Memory", icon: Brain },
  { key: "subagents", label: "Subagents", icon: Bot },
  { key: "mcp", label: "MCP", icon: Plug },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "harness", label: "Harness", icon: Wrench },
  { key: "performance", label: "Performance", icon: BarChart3 },
  { key: "routing", label: "Routing", icon: Route },
  { key: "merging", label: "Merging", icon: Layers },
  { key: "prompt", label: "Prompt", icon: FileText },
  { key: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { key: "settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  active: ViewKey;
  onNavigate: (key: ViewKey) => void;
  isDark: boolean;
}

const glassSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 25,
  mass: 0.5,
};

const tapSpring = {
  type: "spring" as const,
  stiffness: 700,
  damping: 20,
  mass: 0.4,
};

export function Sidebar({ active, onNavigate, isDark }: SidebarProps) {
  return (
    <motion.aside
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="flex h-full w-[84px] shrink-0 flex-col items-center py-6"
    >
      <div className="mb-6">
        <Logo variant="icon" className="h-10 w-10" />
      </div>
      <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <motion.button
              key={item.key}
              type="button"
              title={item.label}
              aria-label={item.label}
              onClick={() => onNavigate(item.key)}
              whileHover={{ scale: 1.08, y: -3, transition: glassSpring }}
              whileTap={{ scale: 0.9, y: 1, transition: tapSpring }}
              className={cn(
                "oc-floating-icon",
                !isDark && "light-theme",
                isActive && "active",
              )}
              style={{ width: 52, height: 52, borderRadius: "50%" }}
            >
              <Icon
                size={20}
                className={cn(
                  isActive ? "text-oc-accent" : "text-oc-text-secondary",
                )}
              />
            </motion.button>
          );
        })}
      </nav>
    </motion.aside>
  );
}

export { NAV_ITEMS };
export type { NavItem };
