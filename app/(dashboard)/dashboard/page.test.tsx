// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import type { Lead, Order, FollowUp } from "@/types";

// Component tests for the dashboard page/widgets (frontend-ux-improvements task 14.2).
// Validates: Property 2 (errors not silent) / 4 (ErrorState on failure); loaded data renders.

vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));

vi.mock("@/lib/data/repository", () => ({
  listLeads: vi.fn(),
  listOrders: vi.fn(),
  listFollowUps: vi.fn(),
  listOrdersForSource: vi.fn(),
  deleteRow: vi.fn(),
  confirmOrder: vi.fn(),
  getSourceById: vi.fn(),
  markFollowUpDone: vi.fn(),
  findDuplicateByPhone: vi.fn(),
}));

import { listLeads, listOrders, listFollowUps } from "@/lib/data/repository";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (error: string) => ({ ok: false as const, error });

const now = new Date().toISOString();

function makeLead(over: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    user_id: "op-1",
    name: "Ali Valiyev",
    phone: "+998901234567",
    address: null,
    tag: null,
    status: "Yangi",
    comment: null,
    converted_client_id: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function renderPage() {
  render(
    <ToastProvider>
      <DashboardPage />
      <Toaster />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (listOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([] as Order[]));
  (listFollowUps as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([] as FollowUp[]));
});

describe("DashboardPage", () => {
  it("renders ErrorState and exactly one error toast on a failed load", async () => {
    (listLeads as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Lidlarni yuklab bo'lmadi: boom")
    );

    renderPage();

    expect(await screen.findByText("Lidlarni yuklab bo'lmadi: boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("renders the dashboard widgets once data loads", async () => {
    (listLeads as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([makeLead()]));

    renderPage();

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Bugungi yangi lidlar")).toBeInTheDocument();
    expect(screen.getByText("Umumiy zakazlar")).toBeInTheDocument();
  });
});
