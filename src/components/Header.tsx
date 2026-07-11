import { motion } from "framer-motion";
import { Sun, Moon, Cpu } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Logo } from "./Logo";
import type { Provider } from "@/lib/providers";
import { cn } from "@/lib/utils";

interface HeaderProps {
  providers: Provider[];
  activeId: string | null;
  onSelectProvider: (id: string) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
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

export function Header({
  providers,
  activeId,
  onSelectProvider,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const options = providers.map((p) => ({ value: p.id, label: p.label }));
  const isDark = theme === "dark";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-6">
      <div className="flex items-center gap-2">
        <Logo variant="full" />
      </div>

      <div className="flex items-center gap-3">
        <div className={cn("oc-pill flex items-center gap-2 px-3 py-2", !isDark && "light-theme")}>
          <Cpu size={15} className="text-oc-text-secondary" />
          <Select
            className="w-52"
            options={options}
            value={activeId}
            placeholder="No provider selected"
            emptyLabel="Add a provider in Settings"
            onChange={onSelectProvider}
          />
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.08, y: -2, transition: glassSpring }}
          whileTap={{ scale: 0.9, y: 1, transition: tapSpring }}
          onClick={onToggleTheme}
          className={cn(
            "oc-floating-icon flex h-10 w-10 items-center justify-center",
            !isDark && "light-theme",
          )}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun size={17} className="text-oc-text-secondary" />
          ) : (
            <Moon size={17} className="text-oc-text-secondary" />
          )}
        </motion.button>
      </div>
    </header>
  );
}
