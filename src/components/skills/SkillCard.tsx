import { motion } from "framer-motion";
import { Trash2, Power, PowerOff } from "lucide-react";
import type { Skill } from "@/types/skills";
import { cn } from "@/lib/utils";

interface SkillCardProps {
  skill: Skill;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

export function SkillCard({ skill, onToggle, onDelete }: SkillCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "rounded-2xl border border-oc-surface-border bg-oc-surface/60 p-4",
        "backdrop-blur-md transition-colors hover:bg-oc-surface/80",
        !skill.enabled && "opacity-60",
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <h3 className="text-sm font-medium text-oc-text-primary">
          {skill.name}
        </h3>
        <div className="flex gap-1">
          <motion.button
            whileTap={{ scale: 0.8, transition: tapSpring }}
            onClick={() => onToggle(skill.id, !skill.enabled)}
            className="rounded-lg p-1 text-oc-text-secondary hover:text-oc-accent"
            title={skill.enabled ? "Disable" : "Enable"}
          >
            {skill.enabled ? <Power size={14} /> : <PowerOff size={14} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.8, transition: tapSpring }}
            onClick={() => onDelete(skill.id)}
            className="rounded-lg p-1 text-oc-text-secondary hover:text-red-400"
            title="Delete"
          >
            <Trash2 size={14} />
          </motion.button>
        </div>
      </div>
      <p className="mb-2 text-xs text-oc-text-secondary line-clamp-2">
        {skill.description}
      </p>
      <div className="flex items-center gap-3 text-xs text-oc-text-secondary">
        <span
          className={cn(
            "rounded-full px-2 py-0.5",
            skill.score >= 60
              ? "bg-oc-accent/20 text-oc-accent"
              : "bg-red-500/20 text-red-400",
          )}
        >
          Score: {skill.score}
        </span>
        <span>Used: {skill.usageCount}x</span>
      </div>
      {skill.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {skill.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-oc-bg/50 px-2 py-0.5 text-[10px] text-oc-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
