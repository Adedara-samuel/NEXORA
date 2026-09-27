import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const wordmarkVariants = cva("inline-flex items-baseline font-display font-black uppercase tracking-wider", {
  variants: {
    size: {
      sm: "text-lg",
      md: "text-2xl",
      lg: "text-4xl",
      xl: "text-6xl",
    },
  },
  defaultVariants: { size: "md" },
});

export interface WordmarkProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof wordmarkVariants> {}

/**
 * The "OneGrid" text lockup, matching the brand mark: "One" in the
 * foreground colour, "Grid" in the primary→accent gradient — mirrors the
 * two-tone treatment in the actual logo artwork (white "One", gradient
 * "Grid").
 */
export const Wordmark = React.forwardRef<HTMLSpanElement, WordmarkProps>(({ className, size, ...props }, ref) => (
  <span ref={ref} className={cn(wordmarkVariants({ size }), className)} {...props}>
    <span className="text-foreground">One</span>
    <span className="bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">Grid</span>
  </span>
));
Wordmark.displayName = "Wordmark";
