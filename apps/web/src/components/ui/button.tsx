"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[color,background-color,filter,transform] duration-fast hub-focus disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-[var(--text-primary)] text-[var(--bg-base)] hover:bg-white",
        secondary:
          "bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)]",
        outline:
          "border border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]",
        ghost: "hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        accent:
          "border-0 bg-[linear-gradient(180deg,#8aa4ff_0%,var(--accent)_100%)] text-white shadow-[0_8px_20px_rgba(107,140,255,0.28)] hover:brightness-110",
        danger: "bg-[rgba(240,113,120,0.12)] text-[var(--danger)] hover:bg-[rgba(240,113,120,0.2)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";
