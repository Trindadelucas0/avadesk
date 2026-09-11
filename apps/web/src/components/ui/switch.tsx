"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  checked,
  onCheckedChange,
  id,
  disabled,
}: {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] transition-colors hub-focus disabled:opacity-50",
        checked && "bg-[var(--accent)] border-[var(--accent)]",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-[var(--text-muted)] shadow transition-transform",
          checked && "translate-x-4 bg-white"
        )}
      />
    </button>
  );
}
