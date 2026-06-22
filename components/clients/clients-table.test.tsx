// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fc from "fast-check";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { ClientsTable, filterClients } from "@/components/clients/clients-table";
import { getClientStaleness } from "@/lib/utils";
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
  convertLeadToClient: vi.fn(),
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
    tag: null,
    comment: null,
    last_contacted_at: null,
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



// ---- Task 7.3: client-management-enhancements additions ----

describe("ClientsTable — Property 8: clients are not deletable from the UI", () => {
  it("renders no delete control and no destructive confirmation dialog", async () => {
    (listClients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok([makeClient({ id: "c1", name: "Mijoz Bir" }), makeClient({ id: "c2", name: "Mijoz Ikki" })])
    );

    renderTable();

    expect(await screen.findByText("Mijoz Bir")).toBeInTheDocument();
    // No delete affordance: neither the AlertDialog title nor its destructive action exist.
    expect(screen.queryByText("Mijozni o'chirish")).not.toBeInTheDocument();
    expect(screen.queryByText("O'chirish")).not.toBeInTheDocument();
    expect(screen.queryByText(/o'chirmoqchimisiz/i)).not.toBeInTheDocument();
  });
});

describe("Property 9: tag filter soundness", () => {
  it("Feature: client-management-enhancements, Property 9: non-'all' tag filter yields only exact-tag matches", () => {
    const tagArb = fc.constantFrom("Sayt", "Excel", "Estet", "Primoy", "VIP");
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            tag: fc.option(tagArb, { nil: null }),
            name: fc.string(),
            phone: fc.string(),
          }),
          { maxLength: 30 }
        ),
        tagArb,
        (rows, selected) => {
          const clients = rows.map((r, i) =>
            makeClient({ id: `${r.id}-${i}`, name: r.name, phone: r.phone, tag: r.tag })
          );
          const result = filterClients(clients, "", selected);
          // Soundness: every displayed row has exactly the selected tag.
          expect(result.every((c) => c.tag === selected)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("'all' shows every client regardless of tag", () => {
    const clients = [
      makeClient({ id: "c1", tag: "Sayt" }),
      makeClient({ id: "c2", tag: null }),
      makeClient({ id: "c3", tag: "Excel" }),
    ];
    expect(filterClients(clients, "", "all")).toHaveLength(3);
  });
});

describe("ClientsTable — stale banner", () => {
  const dayMs = 86_400_000;

  it("shows the needs-attention banner when at least one client is stale", async () => {
    const staleClient = makeClient({
      id: "c1",
      name: "Eski Mijoz",
      created_at: new Date(Date.now() - 10 * dayMs).toISOString(),
      last_contacted_at: null,
    });
    expect(getClientStaleness(staleClient).stale).toBe(true);
    (listClients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([staleClient]));

    renderTable();

    expect(await screen.findByText("Eski Mijoz")).toBeInTheDocument();
    expect(screen.getByText(/e'tibor talab qiladi/)).toBeInTheDocument();
  });

  it("hides the banner when no client is stale", async () => {
    const freshNow = new Date().toISOString();
    const freshClient = makeClient({
      id: "c1",
      name: "Yangi Mijoz",
      created_at: freshNow,
      last_contacted_at: freshNow,
    });
    expect(getClientStaleness(freshClient).stale).toBe(false);
    (listClients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([freshClient]));

    renderTable();

    expect(await screen.findByText("Yangi Mijoz")).toBeInTheDocument();
    expect(screen.queryByText(/e'tibor talab qiladi/)).not.toBeInTheDocument();
  });
});
