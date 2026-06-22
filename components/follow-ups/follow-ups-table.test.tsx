// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { FollowUpsTable } from "@/components/follow-ups/follow-ups-table";
import type { FollowUp } from "@/types";

// Component tests for the follow-ups table (frontend-ux-improvements task 11.2).
// Validates: Property 2 (errors not silent), 4 (no stuck states),
// 5 (no query while operator unresolved), 6 (mutation atomicity).

vi.mock("@/lib/useOperator", () => ({
  useOperator: vi.fn(() => ({ id: "op-1", name: "Test", username: "test" })),
}));

vi.mock("@/lib/data/repository", () => ({
  listFollowUps: vi.fn(),
  deleteRow: vi.fn(),
  markFollowUpDone: vi.fn(),
}));

import { useOperator } from "@/lib/useOperator";
import { listFollowUps, markFollowUpDone } from "@/lib/data/repository";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (error: string) => ({ ok: false as const, error });

function makeFollowUp(over: Partial<FollowUp> = {}): FollowUp {
  const now = new Date().toISOString();
  return {
    id: "f1",
    user_id: "op-1",
    source_type: "lead",
    source_id: "l1",
    source_name: "Ali Valiyev",
    source_phone: "+998901234567",
    scheduled_at: now,
    note: "Qo'ng'iroq qilish",
    status: "Kutilmoqda",
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function renderTable() {
  return render(
    <ToastProvider>
      <FollowUpsTable />
      <Toaster />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (useOperator as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    id: "op-1",
    name: "Test",
    username: "test",
  });
});

describe("FollowUpsTable", () => {
  it("does not query while the operator id is unresolved (empty)", async () => {
    (useOperator as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (listFollowUps as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));

    renderTable();

    // Allow effects to flush; the guard must prevent any query.
    await waitFor(() => {
      expect(listFollowUps).not.toHaveBeenCalled();
    });
    // The view stays in the loading branch (never stuck on an empty unscoped result).
    expect(screen.getByText(/Yuklanmoqda/)).toBeInTheDocument();
  });

  it("renders ErrorState and one error toast on a failed load", async () => {
    (listFollowUps as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Follow-uplarni yuklab bo'lmadi: boom")
    );

    renderTable();

    expect(await screen.findByText("Follow-uplarni yuklab bo'lmadi: boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("marks a follow-up done and fires a success toast", async () => {
    (listFollowUps as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeFollowUp({ id: "f1", status: "Kutilmoqda" })])
    );
    (markFollowUpDone as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok(makeFollowUp({ id: "f1", status: "Bajarildi" }))
    );

    renderTable();

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bajarildi/ }));

    await waitFor(() => expect(markFollowUpDone).toHaveBeenCalledWith("f1"));
    expect(await screen.findByText("Follow-up bajarildi")).toBeInTheDocument();
  });
});
