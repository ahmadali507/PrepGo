"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ThemedSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/** Option styling for dark dropdown lists (best-effort across browsers). */
export const themedSelectOptionClass =
  "bg-slate-950 text-slate-100";

/**
 * Native select aligned with PrepWise form inputs (slate glass + purple focus).
 */
const ThemedSelect = React.forwardRef<HTMLSelectElement, ThemedSelectProps>(
  ({ className, children, disabled, ...props }, ref) => {
    return (
      <div className="group relative scheme-dark">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            "w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-white/5 py-3 pl-4 pr-11 text-sm font-medium text-white outline-none transition",
            "placeholder:text-gray-500",
            "hover:border-purple-500/35 hover:bg-white/[0.08]",
            "focus:border-purple-400/50 focus:ring-2 focus:ring-purple-500/20",
            "disabled:cursor-not-allowed disabled:opacity-45",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/90 transition group-hover:text-purple-200",
            disabled && "opacity-50"
          )}
          aria-hidden
        />
      </div>
    );
  }
);
ThemedSelect.displayName = "ThemedSelect";

export { ThemedSelect };
