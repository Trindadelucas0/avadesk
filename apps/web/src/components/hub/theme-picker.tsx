"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { DEFAULT_THEME, THEME_LABEL, type Theme } from "@/lib/theme";

/** Cores fixas: cada miniatura mostra a própria paleta, não a ativa. */
const PREVIEW: Record<Theme, { canvas: string; card: string; border: string; text: string }> = {
  light: { canvas: "#f5f7fa", card: "#ffffff", border: "rgba(15,23,42,0.12)", text: "#cbd5e1" },
  dark: { canvas: "#070b14", card: "#0c121c", border: "rgba(107,140,255,0.32)", text: "#1e293b" },
};

const PROGRESS: Record<Theme, string> = {
  light: "#0f7a5a",
  dark: "#3ddc97",
};

const OPTIONS: Theme[] = ["light", "dark"];

export function ThemePicker({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)} role="group" aria-label="Tema da interface">
      {OPTIONS.map((option) => {
        const selected = theme === option;
        const preview = PREVIEW[option];
        return (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            aria-pressed={selected}
            className={cn(
              "rounded-xl border p-2.5 text-left transition-colors duration-fast hub-focus",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                : "border-[var(--border)] hover:bg-[var(--bg-subtle)]"
            )}
          >
            <span
              className="block overflow-hidden rounded-lg border p-2"
              style={{ background: preview.canvas, borderColor: preview.border }}
              aria-hidden
            >
              <span
                className="flex items-center gap-2 rounded-md border p-2"
                style={{ background: preview.card, borderColor: preview.border }}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border-[3px]"
                  style={{ borderColor: PROGRESS[option] }}
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block h-1.5 w-full rounded-full" style={{ background: preview.text }} />
                  <span className="block h-1.5 w-2/3 rounded-full" style={{ background: preview.text }} />
                </span>
              </span>
            </span>
            <span className="mt-2 flex items-center gap-1.5 text-sm">
              {selected ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden />
              ) : null}
              <span className={cn("font-medium", selected && "text-[var(--accent)]")}>
                {THEME_LABEL[option]}
              </span>
              {option === DEFAULT_THEME ? (
                <span className="text-xs text-[var(--text-muted)]">(padrão)</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
