import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "hub-control py-2",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";
