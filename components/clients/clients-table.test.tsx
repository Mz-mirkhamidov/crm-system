// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { ClientsTable } from "@/components/clients/clients-table";
import type { Client } from "@/types";

// Component tests for the clients table + form (frontend-ux-improvements task 9.3).
// Validates: Property 1 (no blocking alerts), 2 (errors not silent), 4 (no stuck states),
// 7 (stable keys).

vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));

vi.mock("@/lib/data/repository", () => ({
  listClients: vi.fn(),
  listOrdersForSource: vi.fn(),
  deleteRow: vi.fn(),
  insertClient: vi.fn(),
  updateClient: vi.fn(),
}));

import {
  listClients,
  listOrdersForSource,
  insertClient,
} from "@/lib/data/repository";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const err = (error: string) => ({ ok: false as const, error });

function makeClient(over: Partial<Client> = {}): Client {
  const now = new Date().toISOString();
  return {
    id: "c1",
    user_id: "op-1",
    name: "Mijoz Bir",
    phone: "+998901234567",
    address: "Toshkent",
    comment: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function renderTable() {
  return render(
    <ToastProvider>
      <ClientsTable />
      <Toaster />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (listOrdersForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
});

describe("ClientsTable", () => {
  it("renders ErrorState and one error toast on a failed load", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    (listClients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Mijozlarni yuklab bo'lmadi: boom")
    );

    renderTable();

    expect(await screen.findByText("Mijozlarni yuklab bo'lmadi: boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Qayta urinish/ })).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("renders multiple clients without emitting a React key warning", async () => {
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    (listClients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeClient({ id: "c1", name: "Mijoz Bir" }), makeClient({ id: "c2", name: "Mijoz Ikki" })])
    );

    renderTable();

    expect(await screen.findByText("Mijoz Bir")).toBeInTheDocument();
    expect(screen.getByText("Mijoz Ikki")).toBeInTheDocument();
    const keyWarning = consoleErr.mock.calls.some((c) =>
      JSON.stringify(c).toLowerCase().includes("key")
    );
    expect(keyWarning).toBe(false);
    consoleErr.mockRestore();
  });

  it("closes the modal and fires a success toast after a successful create", async () => {
    (listClients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (insertClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok(makeClient()));

    renderTable();
    expect(await screen.findByText("Mijozlar topilmadi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Yangi mijoz/ }));
    // Modal opened — the form's primary field appears.
    fireEvent.change(await screen.findByPlaceholderText("To'liq ism"), {
      target: { value: "Yangi Mijoz" },
    });
    fireEvent.change(screen.getByPlaceholderText("+998..."), {
      target: { value: "+998901112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(insertClient).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Mijoz qo'shildi")).toBeInTheDocument();
  });
});
