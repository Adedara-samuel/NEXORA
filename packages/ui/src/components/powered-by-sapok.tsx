import * as React from "react";
import { cn } from "../lib/cn";

/**
 * The parent-company credit: every Sapok product (OneGrid, Pay, AI) carries
 * this the same way — small, muted, never competing with the product's own
 * wordmark. Each app serves its own copy of the icon from /sapok-icon.png.
 */
export function PoweredBySapok({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span>Powered by</span>
      <img src="/sapok-icon.png" alt="" className="h-3.5 w-3.5 object-contain" draggable={false} />
      <span className="font-semibold tracking-wide text-foreground">SAPOK</span>
    </div>
  );
}
