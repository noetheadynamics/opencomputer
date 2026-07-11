import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, CheckSquare, Square } from "lucide-react";
import { useToDo } from "@/hooks/useToDo";
import { cn } from "@/lib/utils";

export function ToDoPanel() {
  const { items, add, toggle, remove, clear } = useToDo();
  const [input, setInput] = useState("");

  function handleAdd() {
    const text = input.trim();
    if (!text) return;
    add(text);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-oc-text-primary">To-Do List</h2>
        <span className="text-xs text-oc-text-secondary">
          {items.filter((i) => i.checked).length}/{items.length} done
        </span>
      </div>

      {/* Add item */}
      <div className="mb-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a task..."
          className="oc-glass-input flex-1"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAdd}
          className="oc-glass-btn-primary flex items-center gap-1 px-3"
        >
          <Plus size={16} />
          Add
        </motion.button>
      </div>

      {/* Items */}
      <div className="flex-1 space-y-1 overflow-y-auto">
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-oc-text-secondary">
            No items yet. Add one above.
          </p>
        )}
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2",
              "bg-oc-surface/50 hover:bg-oc-surface/80 transition-colors",
            )}
          >
            <button
              onClick={() => toggle(item.id)}
              className="shrink-0"
            >
              {item.checked ? (
                <CheckSquare size={18} className="text-oc-accent" />
              ) : (
                <Square size={18} className="text-oc-text-secondary" />
              )}
            </button>
            <span
              className={cn(
                "flex-1 text-sm",
                item.checked
                  ? "text-oc-text-secondary line-through"
                  : "text-oc-text-primary",
              )}
            >
              {item.text}
            </span>
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={() => remove(item.id)}
              className="shrink-0 text-oc-text-secondary hover:text-red-400"
            >
              <Trash2 size={14} />
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Clear */}
      {items.length > 0 && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={clear}
          className="oc-glass-btn mt-3 w-full text-sm"
        >
          Clear All
        </motion.button>
      )}
    </div>
  );
}
