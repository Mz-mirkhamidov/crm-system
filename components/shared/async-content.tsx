"use client";

import * as React from "react";
import { Loader2, AlertCircle, RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// The standard async-state rendering convention (frontend-ux-improvements design §2).
// Replaces the ad-hoc `loading ? spinner : empty ? msg : table` ternaries and adds the
// previously-missing error branch, so a failed load can never leave the UI stuck on the
// spinner or silently empty.

export type AsyncBranch = "loading" | "error" | "empty" | "data";

export interface AsyncStateInput {
  loading: boolean;
  error: string | null;
  data: { length: number } | readonly unknown[];
}

/**
 * Pure branch selector with deterministic precedence: loading > error > empty > data
 * (Requirements 2.1, 2.2, 2.7). Exported separately so it can be property-tested without
 * rendering.
 */
export function selectBranch(state: AsyncStateInput): AsyncBranch {
  if (state.loading) return "loading";
  if (state.error !== null) return "error";
  if (state.data.length === 0) return "empty";
  return "data";
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      {Icon && <Icon className="mb-3 h-8 w-8 opacity-20" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="mb-3 h-8 w-8 text-red-400" />
      <p className="text-sm text-red-300">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          className="mt-4 gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
          onClick={onRetry}
        >
          <RotateCw className="h-3.5 w-3.5" /> Qayta urinish
        </Button>
      )}
    </div>
  );
}

export interface AsyncContentProps<T> {
  loading: boolean;
  error: string | null;
  data: T[];
  /** Render when data is non-empty. */
  children: (data: T[]) => React.ReactNode;
  empty?: EmptyStateProps;
  /** Called by ErrorState's retry button. */
  onRetry?: () => void;
  /** Optional custom skeleton; defaults to the centered "Yuklanmoqda..." spinner. */
  loadingFallback?: React.ReactNode;
}

const DefaultLoading = (
  <div className="flex items-center justify-center py-16 text-muted-foreground">
    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yuklanmoqda...
  </div>
);

/**
 * Renders exactly one branch per `selectBranch`. Guarantees deterministic async UI
 * (design Property 3) and that `loading=false` never shows the spinner (Property 4).
 */
export function AsyncContent<T>({
  loading,
  error,
  data,
  children,
  empty,
  onRetry,
  loadingFallback,
}: AsyncContentProps<T>): React.ReactElement {
  const branch = selectBranch({ loading, error, data });
  switch (branch) {
    case "loading":
      return <>{loadingFallback ?? DefaultLoading}</>;
    case "error":
      return <ErrorState message={error as string} onRetry={onRetry} />;
    case "empty":
      return (
        <EmptyState
          icon={empty?.icon}
          title={empty?.title ?? "Ma'lumot topilmadi"}
          description={empty?.description}
          action={empty?.action}
        />
      );
    case "data":
    default:
      return <>{children(data)}</>;
  }
}
