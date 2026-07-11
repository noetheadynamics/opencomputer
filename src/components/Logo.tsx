import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** "icon" = the mark without the wordmark; "full" = mark + "OpenComputer" text */
  variant?: "icon" | "full";
  className?: string;
}

/**
 * Renders the OpenComputer brand mark. Uses the provided logo assets from
 * /public when present, otherwise falls back to the typographic "OC" mark so
 * the UI is never broken before the artwork is dropped in.
 */
export function Logo({ variant = "icon", className }: LogoProps) {
  const iconSrc = "/opencomputer-icon.png";
  const fullSrc = "/opencomputer-logo.png";
  const [broken, setBroken] = React.useState(false);

  if (variant === "full" && !broken) {
    return (
      <img
        src={fullSrc}
        alt="OpenComputer"
        onError={() => setBroken(true)}
        className={cn("h-6 w-auto", className)}
      />
    );
  }

  if (variant === "icon" && !broken) {
    return (
      <img
        src={iconSrc}
        alt="OpenComputer"
        onError={() => setBroken(true)}
        className={cn("h-8 w-8 rounded-xl object-cover", className)}
      />
    );
  }

  // Fallback: typographic mark
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-oc-accent text-[#04140d] font-bold dark:oc-glow-sm",
        variant === "icon" ? "h-8 w-8 text-base" : "h-7 px-2 text-sm",
        className,
      )}
    >
      OC
    </div>
  );
}
