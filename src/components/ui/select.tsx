import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string | null;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  emptyLabel?: string;
}

export function Select({
  options,
  value,
  placeholder = "Select…",
  onChange,
  className,
  emptyLabel,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number; width: number } | null>(null);

  const updatePosition = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, left: r.left, width: r.width });
  }, []);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(t) &&
        menuRef.current &&
        !menuRef.current.contains(t)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="oc-glass-input flex h-9 w-full items-center justify-between gap-2 rounded-xl px-3 text-sm text-oc-text-primary transition-[border-color] duration-150 hover:border-oc-accent focus:border-oc-accent"
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-oc-text-secondary transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width: coords.width,
              }}
              className="oc-glass-3d z-[1000] overflow-hidden rounded-xl p-1"
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs text-oc-text-secondary">
                  {emptyLabel ?? "No options"}
                </div>
              ) : (
                options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-oc-text-primary transition-colors hover:bg-oc-accent/10"
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === value && (
                      <Check size={15} className="text-oc-accent" />
                    )}
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
