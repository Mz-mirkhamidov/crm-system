"use client";

import { Toast, ToastViewport } from "@/components/ui/toast";
import { useToastState } from "@/components/ui/use-toast";

/**
 * Mounts the toast viewport and renders the live toast queue from context. Mount this
 * once per layout (inside a `ToastProvider`). See `app/(dashboard)/layout.tsx` and
 * `app/admin/layout.tsx`.
 */
export function Toaster() {
  const { toasts, remove } = useToastState();

  // Errors announce assertively; everything else politely (design §1 a11y contract).
  const politeness = toasts.some((t) => t.open && t.variant === "error")
    ? "assertive"
    : "polite";

  return (
    <ToastViewport politeness={politeness}>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          title={t.title}
          description={t.description}
          open={t.open}
          onClose={() => remove(t.id)}
        />
      ))}
    </ToastViewport>
  );
}
