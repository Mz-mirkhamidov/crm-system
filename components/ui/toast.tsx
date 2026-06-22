"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastVariant } from "@/components/ui/use-toast";

// Presentational primitives for the toast system (frontend-ux-improvements design §1).
// These are pure UI: state/scheduling live in `use-toast.tsx`. Colors reuse the existing
// Tailwind token palette (matching `getStatusColor` conventions); no new design tokens.

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "bg-card border-border text-foreground",
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  error: "bg-red-500/10 border-red-500/30 text-red-300",
  warning: "bg-orange-500/10 border-orange-500/30 text-orange-300",
};

const VARIANT_ICON: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
};

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-orange-400",
};

export interface ToastProps {
  variant?: ToastVariant;
  title?: string;
  description?: string;
  open?: boolean;
  onClose?: () => void;
  closeLabel?: string;
}

/**
 * A single toast. Uses `role="status"` so assistive tech announces it; the politeness of
 * the announcement is set on the enclosing viewport's live region.
 */
export function Toast({
  variant = "default",
  title,
  description,
  open = true,
  onClose,
  closeLabel = "Yopish",
}: ToastProps) {
  const Icon = VARIANT_ICON[variant];
  return (
    <div
      role="status"
      data-variant={variant}
      data-state={open ? "open" : "closed"}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all",
        "data-[state=closed]:opacity-0 data-[state=closed]:translate-x-2",
        VARIANT_STYLES[variant]
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", VARIANT_ICON_COLOR[variant])} />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold leading-tight">{title}</p>}
        {description && (
          <p className={cn("text-sm", title ? "mt-0.5 text-muted-foreground" : "")}>
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="-mr-1 -mt-1 flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export interface ToastViewportProps {
  children: React.ReactNode;
  /** Live-region politeness: "assertive" when an error is present, otherwise "polite". */
  politeness?: "polite" | "assertive";
}

/**
 * Fixed-position container that hosts the visible toasts. It is a `role="region"` with an
 * `aria-live` region so screen readers announce messages as they appear.
 */
export function ToastViewport({ children, politeness = "polite" }: ToastViewportProps) {
  return (
    <div
      role="region"
      aria-label="Bildirishnomalar"
      aria-live={politeness}
      aria-relevant="additions text"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {children}
    </div>
  );
}
