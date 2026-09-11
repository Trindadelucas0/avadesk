"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function CenterNotice({
  open,
  onClose,
  title,
  children,
  autoCloseMs,
  closeOnOverlay = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  /** Login-only: optional short auto-dismiss. User-created access must omit this. */
  autoCloseMs?: number;
  closeOnOverlay?: boolean;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const focusables = () => {
      const root = panelRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !autoCloseMs) return;
    const t = window.setTimeout(() => onCloseRef.current(), autoCloseMs);
    return () => window.clearTimeout(t);
  }, [open, autoCloseMs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={closeOnOverlay ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="center-notice-title"
        tabIndex={-1}
        className="hub-dialog relative z-10 w-full max-w-md rounded-2xl p-6 animate-fade-in"
      >
        <h2 id="center-notice-title" className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {children ? <div className="mt-3 text-sm text-[var(--text-secondary)]">{children}</div> : null}
        <div className="mt-6 flex justify-end">
          <Button ref={closeRef} type="button" variant="accent" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
