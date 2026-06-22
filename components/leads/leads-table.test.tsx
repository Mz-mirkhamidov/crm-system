// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { LeadsTable } from "@/components/leads/leads-table";
import type { Lead } from "@/types";

// Component tests for the leads table + form (frontend-ux-improvements task 8.3).
// Validates: Property 1 (no blocking alerts), 2 (errors not silent), 4 (no stuck states),
// 6 (mutation atomicity), 7 (stable keys).

vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));

vi.mock("@/lib/data/repository", () => ({
  listLeads: vi.fn(),
  listOrders: vi.fn(),
  listOrdersForSource: vi.fn(),
  deleteRow: vi.fn(),
  findDuplicateByPhone: vi.fn(),
  insertLead: vi.fn(),
  updateLead: vi.fn(),
  // useClients (convert action) data access.
  listClients: vi.fn(),
  convertLeadToClient: vi.fn(),
}));

import {
  listLeads,
  listOrders,
  listOrdersForSource,
  findDuplicateByPhone,
  insertLead,
  listClients,
  convertLeadToClient,
} from "@/lib/data/repository";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (error: string) => ({ ok: false as const, error });

function makeLead(over: Partial<Lead> = {}): Lead {
  const now = new Date().toISOString();
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

function renderTable() {
  return render(
    <ToastProvider>
      <LeadsTable />
      <Toaster />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (listOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
  (listOrdersForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
  (findDuplicateByPhone as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok(null));
  (listClients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
});

describe("LeadsTable", () => {
  it("renders ErrorState and exactly one error toast on a failed load, never window.alert", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    (listLeads as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Lidlarni yuklab bo'lmadi: boom")
    );

    renderTable();

    // ErrorState shows the full message + retry control.
    expect(await screen.findByText("Lidlarni yuklab bo'lmadi: boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
    // Exactly one error toast (role=status) was raised.
    expect(screen.getAllByRole("status")).toHaveLength(1);
    // No blocking browser alert was ever used.
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("renders multiple leads without emitting a React key warning", async () => {
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    (listLeads as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeLead({ id: "l1", name: "Ali Valiyev" }), makeLead({ id: "l2", name: "Vali Aliyev" })])
    );

    renderTable();

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    expect(screen.getByText("Vali Aliyev")).toBeInTheDocument();
    const keyWarning = consoleErr.mock.calls.some((c) =>
      JSON.stringify(c).toLowerCase().includes("key")
    );
    expect(keyWarning).toBe(false);
    consoleErr.mockRestore();
  });

  it("closes the modal and fires a success toast after a successful create", async () => {
    (listLeads as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (insertLead as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok(makeLead()));

    renderTable();

    // Empty state first.
    expect(await screen.findByText("Lidlar topilmadi")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Yangi lid"));
    expect(await screen.findByText("Yangi lid qo'shish")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("To'liq ism"), {
      target: { value: "Yangi Lid" },
    });
    fireEvent.change(screen.getByPlaceholderText("+998901234567"), {
      target: { value: "+998901112233" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(insertLead).toHaveBeenCalledTimes(1));
    // Modal closed.
    await waitFor(() =>
      expect(screen.queryByText("Yangi lid qo'shish")).not.toBeInTheDocument()
    );
    // Success toast shown.
    expect(await screen.findByText("Lid qo'shildi")).toBeInTheDocument();
  });

  it("keeps the modal open and shows an error toast when create fails", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    (listLeads as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (insertLead as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Lidni saqlab bo'lmadi: boom")
    );

    renderTable();
    await screen.findByText("Lidlar topilmadi");

    fireEvent.click(screen.getByText("Yangi lid"));
    await screen.findByText("Yangi lid qo'shish");
    fireEvent.change(screen.getByPlaceholderText("To'liq ism"), { target: { value: "X" } });
    fireEvent.change(screen.getByPlaceholderText("+998901234567"), {
      target: { value: "+998900000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(insertLead).toHaveBeenCalledTimes(1));
    // Modal stays open.
    expect(screen.getByText("Yangi lid qo'shish")).toBeInTheDocument();
    // Error toast shown, never an alert.
    expect(await screen.findByText("Lidni saqlab bo'lmadi: boom")).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});



// ---- Task 8.4: client-management-enhancements convert action ----

function makeClient(id: string) {
  const ts = new Date().toISOString();
  return {
    id,
    user_id: "op-1",
    name: "Mijoz",
    phone: "+998901234567",
    address: null,
    tag: null,
    comment: null,
    last_contacted_at: ts,
    created_at: ts,
    updated_at: ts,
  };
}

describe("LeadsTable — convert action", () => {
  it("disables the convert action once the lead is converted", async () => {
    (listLeads as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeLead({ id: "l1", name: "Ali Valiyev", converted_client_id: "c1", status: "Mijozga aylandi" })])
    );

    renderTable();

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    expect(screen.getByTitle("Mijozga aylantirish")).toBeDisabled();
  });

  it("converts a lead and refetches both leads and clients on success", async () => {
    (listLeads as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeLead({ id: "l1", name: "Ali Valiyev" })])
    );
    (convertLeadToClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok(makeClient("c1")));

    renderTable();

    expect(await screen.findByText("Ali Valiyev")).toBeInTheDocument();
    const leadsCallsBefore = (listLeads as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    const clientsCallsBefore = (listClients as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    fireEvent.click(screen.getByTitle("Mijozga aylantirish"));

    await waitFor(() => expect(convertLeadToClient).toHaveBeenCalledTimes(1));
    // Both lists refetched after a successful conversion (Req 3.9).
    await waitFor(() =>
      expect((listLeads as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(leadsCallsBefore)
    );
    await waitFor(() =>
      expect((listClients as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(clientsCallsBefore)
    );
  });
});
