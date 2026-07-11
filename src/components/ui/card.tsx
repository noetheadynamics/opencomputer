import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "oc-glass rounded-2xl text-oc-text-primary",
        className,
      )}
      {...props}
    />
  );
}
