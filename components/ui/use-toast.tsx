"use client";

import * as React from "react";

// Toast state, reducer, provider, and the `useToast()` hook for the unified, accessible
// notification system (frontend-ux-improvements design §1). Built as a self-contained
// context + reducer to honor the "no heavy framework" guardrail (Requirement 10.5).

/** Maximum number of toasts visible at once (Requirement 1.7). */
export const MAX_VISIBLE = 4;

/** Default auto-dismiss duration in ms. `0` = sticky (manual close only). */
export const DEFAULT_DURATION = 4000;

/** Delay between a toast being dismissed (open=false) and removal, for exit animations. */
export const REMOVE_DELAY = 200;

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss in ms; 0 = sticky (manual close). Default 4000. */
  duration?: number;
}

export interface ToastRecord
  extends Required<Pick<ToastOptions, "variant" | "duration">> {
  id: string;
  title?: string;
  description?: string;
  open: boolean;
}

export interface ToastApi {
  /** Generic toast; returns the toast id for programmatic dismissal. */
  show: (opts: ToastOptions) => string;
  success: (message: string, opts?: Omit<ToastOptions, "variant">) => string;
  error: (message: string, opts?: Omit<ToastOptions, "variant">) => string;
  warning: (message: string, opts?: Omit<ToastOptions, "variant">) => string;
  /** Dismiss a single toast by id, or all toasts when called with no id. */
  dismiss: (id?: string) => void;
}

// ---- Reducer ----

export interface ToastState {
  toasts: ToastRecord[]; // newest first, capped at MAX_VISIBLE
}

export type ToastAction =
  | { type: "ADD"; toast: ToastRecord }
  | { type: "DISMISS"; id?: string }
  | { type: "REMOVE"; id?: string };

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "ADD": {
      const record: ToastRecord = { ...action.toast, open: true };
      // Newest first, capped at MAX_VISIBLE.
      return { toasts: [record, ...state.toasts].slice(0, MAX_VISIBLE) };
    }
    case "DISMISS": {
      return {
        toasts: state.toasts.map((t) =>
          action.id === undefined || t.id === action.id ? { ...t, open: false } : t
        ),
      };
    }
    case "REMOVE": {
      if (action.id === undefined) return { toasts: [] };
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    }
    default:
      return state;
  }
}

/** Crypto-based unique id. Falls back to a random string if `randomUUID` is absent. */
export function createToastId(): string {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(4);
    c.getRandomValues(buf);
    return Array.from(buf, (n) => n.toString(16)).join("-");
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---- Context ----

interface ToastContextValue {
  toasts: ToastRecord[];
  toast: ToastApi;
  /** Imperatively remove a toast (used by the viewport after the exit animation). */
  remove: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] });

  // Track auto-dismiss + removal timers so we can clear them on manual close/unmount.
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = React.useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const remove = React.useCallback(
    (id: string) => {
      clearTimer(id);
      dispatch({ type: "REMOVE", id });
    },
    [clearTimer]
  );

  const dismiss = React.useCallback(
    (id?: string) => {
      dispatch({ type: "DISMISS", id });
      // Schedule actual removal after the exit-animation delay.
      const setForRemoval = (toastId: string) => {
        clearTimer(toastId);
        const t = setTimeout(() => {
          dispatch({ type: "REMOVE", id: toastId });
          timers.current.delete(toastId);
        }, REMOVE_DELAY);
        timers.current.set(toastId, t);
      };
      if (id === undefined) {
        // Snapshot current ids; schedule removal for each.
        timers.current.forEach((t) => clearTimeout(t));
        timers.current.clear();
        const t = setTimeout(() => dispatch({ type: "REMOVE" }), REMOVE_DELAY);
        // Use a sentinel key for the "remove all" timer.
        timers.current.set("__all__", t);
      } else {
        setForRemoval(id);
      }
    },
    [clearTimer]
  );

  const show = React.useCallback(
    (opts: ToastOptions): string => {
      const id = createToastId();
      const duration = opts.duration ?? DEFAULT_DURATION;
      dispatch({
        type: "ADD",
        toast: {
          id,
          variant: opts.variant ?? "default",
          duration,
          title: opts.title,
          description: opts.description,
          open: true,
        },
      });
      if (duration > 0) {
        const t = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, t);
      }
      return id;
    },
    [dismiss]
  );

  const toast = React.useMemo<ToastApi>(
    () => ({
      show,
      success: (message, opts) => show({ ...opts, description: message, variant: "success" }),
      error: (message, opts) => show({ ...opts, description: message, variant: "error" }),
      warning: (message, opts) => show({ ...opts, description: message, variant: "warning" }),
      dismiss,
    }),
    [show, dismiss]
  );

  // Clear all pending timers on unmount.
  React.useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({ toasts: state.toasts, toast, remove }),
    [state.toasts, toast, remove]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/** Access the toast API. Throws if used outside a `ToastProvider`. */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx.toast;
}

/** Internal hook used by `<Toaster />` to read live toast state. */
export function useToastState(): { toasts: ToastRecord[]; remove: (id: string) => void } {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToastState must be used within a <ToastProvider>");
  }
  return { toasts: ctx.toasts, remove: ctx.remove };
}
