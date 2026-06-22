// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { OrdersTable } from "@/components/orders/orders-table";
import type { Order } from "@/types";

// Component tests for the orders table (frontend-ux-improvements task 10.2).
// Validates: Property 2 (errors not silent), 4 (no stuck states), 6 (mutation atomicity).

vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));

vi.mock("@/lib/data/repository", () => ({
  listOrders: vi.fn(),
  deleteRow: vi.fn(),
  confirmOrder: vi.fn(),
  getSourceById: vi.fn(),
}));

import { listOrders, deleteRow, confirmOrder } from "@/lib/data/repository";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (error: string) => ({ ok: false as const, error });

function makeOrder(over: Partial<Order> = {}): Order {
  const now = new Date().toISOString();
  return {
    id: "o1",
    user_id: "op-1",
    source_type: "lead",
    source_id: "l1",
    source_name: "Ali Valiyev",
    product: "AJR Sedan",
    price: 100000,
    order_type: "Hozirgi",
    scheduled_at: null,
    comment: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function renderTable() {
  return render(
    <ToastProvider>
      <OrdersTable />
      <Toaster />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrdersTable", () => {
  it("renders ErrorState and one error toast on a failed load", async () => {
    (listOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Zakazlarni yuklab bo'lmadi: boom")
    );

    renderTable();

    expect(await screen.findByText("Zakazlarni yuklab bo'lmadi: boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("confirms an upcoming order and fires a success toast", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const upcoming = makeOrder({ id: "o1", order_type: "Keyinroqi", scheduled_at: future });
    (listOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([upcoming]));
    (confirmOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok(makeOrder({ id: "o1", order_type: "Hozirgi", scheduled_at: null }))
    );

    renderTable();

    // Switch to the "Keyinroqi" tab.
    fireEvent.click(screen.getByRole("button", { name: /Keyinroqi/ }));
    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tasdiqlash/ }));

    await waitFor(() => expect(confirmOrder).toHaveBeenCalledWith("o1"));
    expect(await screen.findByText("Zakaz tasdiqlandi")).toBeInTheDocument();
  });

  it("deletes a confirmed order and fires a success toast", async () => {
    (listOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeOrder({ id: "o1", order_type: "Hozirgi" })])
    );
    (deleteRow as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok(undefined));

    renderTable();

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    // The destructive trigger is the icon-only button (empty text content).
    const trashTrigger = screen
      .getAllByRole("button")
      .find((b) => b.textContent === "");
    expect(trashTrigger).toBeDefined();
    fireEvent.click(trashTrigger as HTMLElement);
    fireEvent.click(await screen.findByRole("button", { name: "O'chirish" }));

    await waitFor(() => expect(deleteRow).toHaveBeenCalledWith("orders", "o1"));
    expect(await screen.findByText("Zakaz o'chirildi")).toBeInTheDocument();
  });
});
