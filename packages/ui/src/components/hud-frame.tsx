import * as React from "react";
import { cn } from "../lib/cn";

const CORNER_BASE = "absolute h-4 w-4 border-accent/70";

/**
 * Wraps children in a HUD/targeting-reticle frame — four corner brackets
 * plus a slow scan-line sweep — instead of a plain rounded card. This is
 * NEXORA's signature "instrument panel" treatment, echoing the mark's
 * circuit-node motif; use it for moments that should read as
 * technological, not just administrative (login, splash-adjacent surfaces).
 */
export const HudFrame = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative", className)} {...props}>
      <span aria-hidden className={cn(CORNER_BASE, "left-0 top-0 border-l-2 border-t-2")} />
      <span aria-hidden className={cn(CORNER_BASE, "right-0 top-0 border-r-2 border-t-2")} />
      <span aria-hidden className={cn(CORNER_BASE, "bottom-0 left-0 border-b-2 border-l-2")} />
      <span aria-hidden className={cn(CORNER_BASE, "bottom-0 right-0 border-b-2 border-r-2")} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 left-0 right-0 h-px animate-scan-sweep bg-gradient-to-r from-transparent via-accent/80 to-transparent"
      />
      <div className="relative">{children}</div>
    </div>
  ),
);
HudFrame.displayName = "HudFrame";
