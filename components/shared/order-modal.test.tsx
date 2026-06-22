// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { OrderModal } from "@/components/shared/order-modal";

// Component tests for the shared order modal (frontend-ux-improvements task 13.4).
// Validates: Property 1 (no blocking alerts), 2 (errors not silent), 6 (mutation atomicity).

vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));

vi.mock("@/lib/data/repository", () => ({
  insertOrder: vi.fn(),
  updateLead: vi.fn(),
}));

import { insertOrder, updateLead } from "@/lib/data/repository";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (error: string) => ({ ok: false as const, error });

function renderModal(props: Partial<React.ComponentProps<typeof OrderModal>> = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(
    <ToastProvider>
      <OrderModal
        open
        onClose={onClose}
        onSuccess={onSuccess}
        sourceId="l1"
        sourceName="Ali Valiyev"
        sourceType="lead"
        {...props}
      />
      <Toaster />
    </ToastProvider>
  );
  return { onClose, onSuccess };
}

// Select the first product, advance to the price step, and enter a total.
function fillOrder() {
  const productLabel = screen.getByText("AJR Sedan");
  fireEvent.click(productLabel.previousElementSibling as Element);
  fireEvent.click(screen.getByText(/Narx belgilash/));
  fireEvent.change(screen.getByPlaceholderText("Masalan: 450000"), {
    target: { value: "450000" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (updateLead as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok({}));
});

describe("OrderModal", () => {
  it("saves the order, marks the source lead as ordered, closes, and toasts success", async () => {
    (insertOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ id: "o1" }));
    const { onClose, onSuccess } = renderModal();

    fillOrder();
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(insertOrder).toHaveBeenCalledTimes(1));
    // Side effect preserved: the source lead is moved to "Buyurtma berilgan".
    expect(updateLead).toHaveBeenCalledWith("l1", { status: "Buyurtma berilgan" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
    expect(await screen.findByText("Zakaz qo'shildi")).toBeInTheDocument();
  });

  it("does NOT run the lead side effect for client orders", async () => {
    (insertOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok({ id: "o2" }));
    renderModal({ sourceType: "client", sourceId: "c1", sourceName: "Vali" });

    fillOrder();
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(insertOrder).toHaveBeenCalledTimes(1));
    expect(updateLead).not.toHaveBeenCalled();
  });

  it("keeps the modal open and shows an error toast on failure, never window.alert", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    (insertOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Zakazni saqlab bo'lmadi: boom")
    );
    const { onClose } = renderModal();

    fillOrder();
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(insertOrder).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByText("Zakazni saqlab bo'lmadi: boom")).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
