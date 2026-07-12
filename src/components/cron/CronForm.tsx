import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { CronJobCreate } from "@/types/cron";

interface CronFormProps {
  onSubmit: (req: CronJobCreate) => void;
  onCancel: () => void;
}

const tapSpring = { type: "spring" as const, stiffness: 700, damping: 20 };

export function CronForm({ onSubmit, onCancel }: CronFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("0 * * * *");
  const [enabled, setEnabled] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), schedule, enabled });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <div>
        <label className="mb-1 block text-xs text-oc-text-secondary">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task name"
          className="oc-glass-input w-full"
          autoFocus
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-oc-text-secondary">
          Description
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What should this task do?"
          className="oc-glass-input w-full"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-oc-text-secondary">
          Schedule (cron expression)
        </label>
        <input
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="0 * * * *"
          className="oc-glass-input w-full font-mono text-sm"
        />
        <p className="mt-1 text-[10px] text-oc-text-secondary">
          Examples: <code>0 * * * *</code> (hourly),{" "}
          <code>0 9 * * 1-5</code> (weekdays 9am),{" "}
          <code>0 0 * * *</code> (daily midnight)
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-oc-accent"
        />
        <span className="text-sm text-oc-text-primary">Enabled</span>
      </div>
      <div className="flex gap-2 pt-2">
        <motion.button
          type="submit"
          whileTap={{ scale: 0.95, transition: tapSpring }}
          className="oc-glass-btn-primary flex items-center gap-1 px-4 py-2 text-sm"
        >
          <Plus size={14} />
          Create
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95, transition: tapSpring }}
          onClick={onCancel}
          className="oc-glass-btn px-4 py-2 text-sm"
        >
          Cancel
        </motion.button>
      </div>
    </form>
  );
}
