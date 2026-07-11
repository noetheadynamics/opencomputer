import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "oc-glass-input flex h-10 w-full px-3 py-2 text-sm text-oc-text-primary placeholder:text-oc-text-secondary/60 outline-none",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
