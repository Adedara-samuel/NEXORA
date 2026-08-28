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
 * The "NEXORA" text lockup, matching the brand mark: white letters, the X
 * rendered in the primary→accent gradient, a small accent dot standing in
 * for the mark's circuit-node motif after the final A.
 */
export const Wordmark = React.forwardRef<HTMLSpanElement, WordmarkProps>(({ className, size, ...props }, ref) => (
  <span ref={ref} className={cn(wordmarkVariants({ size }), className)} {...props}>
    <span className="text-foreground">NE</span>
    <span className="bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">X</span>
    <span className="text-foreground">ORA</span>
    <span
      aria-hidden
      className="ml-[0.08em] mb-[0.08em] inline-block h-[0.16em] w-[0.16em] self-end rounded-full bg-accent shadow-[0_0_0.4em_hsl(var(--accent)/0.9)]"
    />
  </span>
));
Wordmark.displayName = "Wordmark";
