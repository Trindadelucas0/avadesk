"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-modal-title"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "hub-dialog relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl p-5 pb-8 animate-fade-in sm:rounded-2xl sm:pb-5",
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="hub-modal-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
