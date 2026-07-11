import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, id, className }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-oc-surface-border transition-colors duration-200 ease-oc-spring",
        checked ? "bg-oc-accent dark:oc-glow-sm" : "bg-oc-bezel",
        className,
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow",
          checked ? "ml-auto mr-1" : "ml-1",
        )}
      />
    </button>
  );
}
