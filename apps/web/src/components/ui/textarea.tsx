import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "hub-control min-h-[96px] h-auto py-2",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
