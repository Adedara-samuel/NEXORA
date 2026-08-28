"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { Logo } from "./logo";
import { Wordmark } from "./wordmark";

export interface SplashScreenProps {
  /** Path to the NEXORA mark, e.g. "/nexora-logo.png". */
  logoSrc: string;
  /** Becomes true once the app has finished its initial boot work (session check, config fetch, ...). */
  ready: boolean;
  /** Minimum time the splash stays up, so it never just flashes on a fast connection. */
  minDurationMs?: number;
  children: React.ReactNode;
}

const BOOT_PHRASES = [
  "Establishing secure connection",
  "Verifying session",
  "Loading workspace",
  "Preparing your dashboard",
];

/**
 * Branded boot splash: the mark sits inside a slowly-rotating circuit ring,
 * the wordmark and tagline stagger in beneath it, and a cycling status line
 * plus scanning progress bar carry the "still working" read for the whole
 * (deliberately unhurried) minimum duration. Fades out only once `ready` is
 * true AND `minDurationMs` has elapsed AND its own exit transition has
 * finished — so it never leaves a ghosted cross-fade over the app below.
 */
export function SplashScreen({ logoSrc, ready, minDurationMs = 2400, children }: SplashScreenProps) {
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);
  const [phraseIndex, setPhraseIndex] = React.useState(0);
  const [mounted, setMounted] = React.useState(true);
  const [exiting, setExiting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), minDurationMs);
    return () => clearTimeout(timer);
  }, [minDurationMs]);

  React.useEffect(() => {
    const interval = setInterval(() => setPhraseIndex((i) => (i + 1) % BOOT_PHRASES.length), 850);
    return () => clearInterval(interval);
  }, []);

  const canHide = ready && minTimeElapsed;

  React.useEffect(() => {
    if (!canHide) return;
    setExiting(true);
    const timer = setTimeout(() => setMounted(false), 600);
    return () => clearTimeout(timer);
  }, [canHide]);

  return (
    <>
      {/* Content underneath is only interactive/visible-to-AT once the splash has fully left. */}
      <div aria-hidden={mounted} className={mounted ? "invisible" : undefined}>
        {children}
      </div>

      {mounted && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-background transition-opacity duration-500 ease-out-expo",
            exiting ? "pointer-events-none opacity-0" : "opacity-100",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.16),transparent_60%)]" />
          <div className="pointer-events-none absolute -inset-1/4 animate-drift bg-[radial-gradient(circle_at_30%_30%,hsl(var(--accent)/0.08),transparent_45%)]" />

          <div className="relative flex flex-col items-center gap-5">
            <div className="relative flex h-28 w-28 items-center justify-center animate-fade-in-up [animation-delay:0ms]">
              <span
                aria-hidden
                className="absolute inset-0 animate-spin-slow rounded-full opacity-70"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0%, hsl(var(--accent)) 8%, transparent 22%, transparent 78%, hsl(var(--primary)) 92%, transparent 100%)",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
                }}
              />
              <span
                aria-hidden
                className="absolute inset-3 animate-spin-slow rounded-full opacity-40 [animation-direction:reverse] [animation-duration:9s]"
                style={{
                  background:
                    "conic-gradient(from 90deg, transparent 0%, hsl(var(--primary)) 4%, transparent 14%, transparent 86%, hsl(var(--accent)) 96%, transparent 100%)",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))",
                }}
              />
              <Logo src={logoSrc} glow className="h-16 w-16 object-contain" />
            </div>

            <div className="flex flex-col items-center gap-1.5 animate-fade-in-up [animation-delay:150ms]">
              <Wordmark size="lg" />
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-muted-foreground">
                The <span className="text-accent">Intelligent</span> Enterprise Operating System
              </p>
            </div>

            <div className="mt-2 flex flex-col items-center gap-2 animate-fade-in-up [animation-delay:300ms]">
              <div className="relative h-[3px] w-56 overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-y-0 w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
              </div>
              <p className="h-4 text-[0.65rem] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                {BOOT_PHRASES[phraseIndex]}…
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
