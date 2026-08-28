"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export type SystemStatusState = "checking" | "online" | "offline";

export interface SystemStatusProps {
  status: SystemStatusState;
  /** Round-trip time of the last successful check, in ms — real telemetry, not a placeholder. */
  latencyMs?: number;
  label?: string;
  className?: string;
}

const STATE_META: Record<SystemStatusState, { dot: string; text: string }> = {
  checking: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
  online: { dot: "bg-success", text: "text-success" },
  offline: { dot: "bg-danger", text: "text-danger" },
};

/**
 * Live HUD-style telemetry line: a pulsing status dot, real connection
 * state + latency (caller supplies both from an actual health check — this
 * never fabricates numbers), and a client-only clock. Renders a static
 * placeholder until mounted to avoid an SSR/client clock mismatch.
 */
export function SystemStatus({ status, latencyMs, label = "CORE API", className }: SystemStatusProps) {
  const [time, setTime] = React.useState<string | null>(null);

  React.useEffect(() => {
    const update = () => setTime(new Date().toISOString().slice(11, 19) + " UTC");
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const meta = STATE_META[status];

  return (
    <div className={cn("flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.2em]", meta.text, className)}>
      <span className="relative flex h-2 w-2">
        <span className={cn("absolute inset-0 rounded-full opacity-75", meta.dot, status !== "checking" && "animate-ping")} />
        <span className={cn("relative h-2 w-2 rounded-full", meta.dot)} />
      </span>
      <span>
        {label} {status === "checking" ? "CONNECTING" : status.toUpperCase()}
        {status === "online" && typeof latencyMs === "number" ? ` · ${Math.round(latencyMs)}ms` : ""}
      </span>
      <span className="text-muted-foreground/70">{time ?? "--:--:-- UTC"}</span>
    </div>
  );
}
