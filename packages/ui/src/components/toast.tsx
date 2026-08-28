"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../lib/cn";

export type ToastVariant = "info" | "success" | "error" | "warning";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms before auto-dismiss; 0 disables auto-dismiss. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastInput, "description">> {
  id: string;
  description?: string;
  leaving: boolean;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const VARIANT_META: Record<ToastVariant, { icon: React.ElementType; ring: string; iconColor: string; bar: string }> = {
  info: { icon: Info, ring: "before:bg-primary", iconColor: "text-primary", bar: "bg-primary" },
  success: { icon: CheckCircle2, ring: "before:bg-success", iconColor: "text-success", bar: "bg-success" },
  error: { icon: XCircle, ring: "before:bg-danger", iconColor: "text-danger", bar: "bg-danger" },
  warning: { icon: AlertTriangle, ring: "before:bg-amber-400", iconColor: "text-amber-400", bar: "bg-amber-400" },
};

/**
 * NEXORA's toast: a dark glass card with a glowing left rail in the
 * variant's colour, a status LED that pulses like the brand mark's circuit
 * nodes, and a shrinking underline instead of a generic corner timer.
 * Wrap the app root in <ToastProvider> and call useToast().toast(...).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 250);
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const record: ToastRecord = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "info",
        duration: input.duration ?? 5000,
        leaving: false,
      };
      setToasts((prev) => [...prev, record]);
      if (record.duration > 0) {
        setTimeout(() => dismiss(id), record.duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
            role="region"
            aria-label="Notifications"
          >
            {toasts.map((t) => (
              <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastRecord; onClose: () => void }) {
  const meta = VARIANT_META[toast.variant];
  const Icon = meta.icon;

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface/95 shadow-2xl shadow-black/40 backdrop-blur",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        meta.ring,
        toast.leaving ? "animate-toast-out" : "animate-toast-in",
      )}
    >
      <div className="flex gap-3 py-3 pl-4 pr-3">
        <span className={cn("relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center", meta.iconColor)}>
          <Icon className="h-4 w-4" />
          <span className={cn("absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse-glow rounded-full", meta.bar)} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold leading-snug text-foreground">{toast.title}</p>
          {toast.description && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{toast.description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {toast.duration > 0 && !toast.leaving && (
        <div className="h-[2px] w-full bg-border/60">
          <div
            className={cn("h-full origin-left animate-shrink-x", meta.bar)}
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used within a <ToastProvider>");
  return ctx;
}
