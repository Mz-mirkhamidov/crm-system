// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { FollowUpModal } from "@/components/shared/follow-up-modal";

// Component tests for the shared follow-up modal (frontend-ux-improvements task 13.4).
// Validates: Property 1 (no blocking alerts), 2 (errors not silent), 6 (mutation atomicity).

vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));

vi.mock("@/lib/data/repository", () => ({
  insertFollowUp: vi.fn(),
}));

import { insertFollowUp } from "@/lib/data/repository";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (error: string) => ({ ok: false as const, error });

function renderModal() {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const { container } = render(
    <ToastProvider>
      <FollowUpModal
        open
        onClose={onClose}
        onSuccess={onSuccess}
        sourceId="l1"
        sourceName="Ali Valiyev"
        sourcePhone="+998901234567"
        sourceType="lead"
      />
      <Toaster />
    </ToastProvider>
  );
  return { onClose, onSuccess, container };
}

function setSchedule(container: HTMLElement) {
  const input = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
  fireEvent.change(input, { target: { value: "2030-01-01T10:00" } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FollowUpModal", () => {
  it("saves the follow-up, closes, and toasts success", async () => {
    (insertFollowUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ id: "f1" }));
    const { onClose, onSuccess, container } = renderModal();

    setSchedule(container);
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(insertFollowUp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
    expect(await screen.findByText("Eslatma belgilandi")).toBeInTheDocument();
  });

  it("keeps the modal open and shows an error toast on failure, never window.alert", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    (insertFollowUp as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Follow-upni saqlab bo'lmadi: boom")
    );
    const { onClose, container } = renderModal();

    setSchedule(container);
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(insertFollowUp).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText("Follow-upni saqlab bo'lmadi: boom")).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
