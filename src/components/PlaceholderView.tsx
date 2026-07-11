import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";

export function PlaceholderView({ view }: { view: string }) {
  const meta = {
    icon: FolderOpen,
    title: view.charAt(0).toUpperCase() + view.slice(1),
    desc: `${view} panel`,
  };
  const Icon = meta.icon;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-oc-accent/10 text-oc-accent dark:oc-glow-sm"
      >
        <Icon size={28} />
      </motion.div>
      <div>
        <h2 className="text-lg font-semibold text-oc-text-primary">
          {meta.title}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-oc-text-secondary">
          {meta.desc}
        </p>
      </div>
    </div>
  );
}
