// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { PersonDetailModal } from "@/components/shared/detail-modal";
import type { Lead, Order, FollowUp } from "@/types";

// Component tests for the shared detail modal (frontend-ux-improvements task 13.4).
// Validates: typed lists render; Property 2 (errors not silent) / 4 (ErrorState on failure).

vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));

vi.mock("@/lib/data/repository", () => ({
  listOrdersForSource: vi.fn(),
  listFollowUpsForSource: vi.fn(),
  // Needed because the sub-modals imported by detail-modal reference these.
  insertOrder: vi.fn(),
  updateLead: vi.fn(),
  insertFollowUp: vi.fn(),
}));

import { listOrdersForSource, listFollowUpsForSource } from "@/lib/data/repository";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (error: string) => ({ ok: false as const, error });

const now = new Date().toISOString();

const lead: Lead = {
  id: "l1",
  user_id: "op-1",
  name: "Ali Valiyev",
  phone: "+998901234567",
  address: null,
  tag: null,
  status: "Yangi",
  comment: null,
  created_at: now,
  updated_at: now,
};

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: "o1",
    user_id: "op-1",
    source_type: "lead",
    source_id: "l1",
    source_name: "Ali Valiyev",
    product: "AJR Sedan",
    price: 450000,
    order_type: "Hozirgi",
    scheduled_at: null,
    comment: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function makeFollowUp(over: Partial<FollowUp> = {}): FollowUp {
  return {
    id: "f1",
    user_id: "op-1",
    source_type: "lead",
    source_id: "l1",
    source_name: "Ali Valiyev",
    source_phone: "+998901234567",
    scheduled_at: now,
    note: "Narx haqida gaplashish",
    status: "Kutilmoqda",
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function renderModal() {
  render(
    <ToastProvider>
      <PersonDetailModal open onClose={() => {}} person={lead} sourceType="lead" />
      <Toaster />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PersonDetailModal", () => {
  it("renders the typed order and follow-up lists on a successful load", async () => {
    (listOrdersForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeOrder()])
    );
    (listFollowUpsForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeFollowUp()])
    );

    renderModal();

    expect(await screen.findByText("AJR Sedan")).toBeInTheDocument();
    expect(screen.getByText("Narx haqida gaplashish")).toBeInTheDocument();
  });

  it("renders ErrorState and exactly one error toast when a load fails", async () => {
    (listOrdersForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Zakaz tarixini yuklab bo'lmadi: boom")
    );
    (listFollowUpsForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));

    renderModal();

    // Both sub-lists render ErrorState (shared error), but only one toast is fired.
    expect(
      (await screen.findAllByText("Zakaz tarixini yuklab bo'lmadi: boom")).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Qayta urinish/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
