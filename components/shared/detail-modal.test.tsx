// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fc from "fast-check";
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  PersonDetailModal,
  getOrderStats,
  buildClientUpdatePayload,
} from "@/components/shared/detail-modal";
import { getOrderTotal } from "@/lib/utils";
import type { Lead, Client, Note, Order, FollowUp } from "@/types";

// Component tests for the shared detail modal (frontend-ux-improvements task 13.4 +
// client-management-enhancements task 8.2).
// Validates: typed lists render; Property 2 (errors not silent) / 4 (ErrorState on failure);
// Property 10 (order stats consistency); Property 11 (quick-edit persists).

vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));

vi.mock("@/lib/data/repository", () => ({
  listOrdersForSource: vi.fn(),
  listFollowUpsForSource: vi.fn(),
  // NotesFeed → useNotes data access.
  listNotesForSource: vi.fn(),
  addNote: vi.fn(),
  touchClientLastContacted: vi.fn(),
  // Quick-edit persistence.
  updateClient: vi.fn(),
  // Needed because the sub-modals imported by detail-modal reference these.
  insertOrder: vi.fn(),
  updateLead: vi.fn(),
  insertFollowUp: vi.fn(),
}));

import {
  listOrdersForSource,
  listFollowUpsForSource,
  listNotesForSource,
  addNote,
  touchClientLastContacted,
  updateClient,
} from "@/lib/data/repository";

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
  converted_client_id: null,
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

const okClient = (over: Partial<Client> = {}): Client => ({
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
});

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: "n1",
    user_id: "op-1",
    source_type: "client",
    source_id: "c1",
    body: "Yangi eslatma",
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function renderClientModal(client: Client, onRefresh?: () => void) {
  render(
    <ToastProvider>
      <PersonDetailModal open onClose={() => {}} person={client} sourceType="client" onRefresh={onRefresh} />
      <Toaster />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (listNotesForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
  (touchClientLastContacted as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok(okClient()));
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



// ---- Task 8.2: client-management-enhancements additions ----

describe("Property 10: order stats consistency", () => {
  it("Feature: client-management-enhancements, Property 10: total/count/last-date are consistent", () => {
    const dateArb = fc
      .date({ min: new Date("2000-01-01T00:00:00Z"), max: new Date("2100-01-01T00:00:00Z") })
      .map((d) => d.toISOString());
    fc.assert(
      fc.property(
        fc.array(fc.record({ price: fc.integer({ min: 0, max: 10_000_000 }), created_at: dateArb }), {
          maxLength: 40,
        }),
        (rows) => {
          const orders = rows.map((r, i) => makeOrder({ id: `o-${i}`, price: r.price, created_at: r.created_at }));
          const stats = getOrderStats(orders);

          expect(stats.count).toBe(orders.length);
          expect(stats.total).toBe(getOrderTotal(orders));

          const expectedLast = orders.reduce<string | null>(
            (max, o) => (max === null || o.created_at > max ? o.created_at : max),
            null
          );
          expect(stats.lastOrderDate).toBe(expectedLast);
          if (orders.length === 0) expect(stats.lastOrderDate).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 11: quick-edit payload reflects submitted values", () => {
  it("Feature: client-management-enhancements, Property 11: buildClientUpdatePayload carries submitted values", () => {
    const tagArb = fc.constantFrom("Sayt", "Excel", "Estet", "Primoy", "none");
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        tagArb,
        (name, phone, address, tag) => {
          const payload = buildClientUpdatePayload({ name, phone, address, tag });
          expect(payload.name).toBe(name);
          expect(payload.phone).toBe(phone);
          expect(payload.address).toBe(address === "" ? null : address);
          expect(payload.tag).toBe(tag === "none" ? null : tag);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("PersonDetailModal — notes feed", () => {
  it("clears the add-note input and shows the new note after a successful submit", async () => {
    (listOrdersForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (listFollowUpsForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (addNote as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok(makeNote({ body: "Telefon qildim" })));

    renderClientModal(okClient());

    const input = (await screen.findByLabelText("Eslatma")) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Telefon qildim" } });
    fireEvent.click(screen.getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(addNote).toHaveBeenCalledTimes(1));
    // Feed updated with the new note...
    expect(await screen.findByText("Telefon qildim")).toBeInTheDocument();
    // ...and the input cleared on success.
    await waitFor(() => expect(input.value).toBe(""));
  });
});

describe("PersonDetailModal — quick-edit", () => {
  it("persists submitted values via updateClient, keeps the modal open, and refreshes", async () => {
    (listOrdersForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (listFollowUpsForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (updateClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      ok(okClient({ name: "Yangilangan Ism" }))
    );
    const onRefresh = vi.fn();

    renderClientModal(okClient(), onRefresh);

    // Enter edit mode.
    fireEvent.click(await screen.findByTitle("Tahrirlash"));
    const nameInput = screen.getByPlaceholderText("To'liq ism") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Yangilangan Ism" } });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    expect(updateClient).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ name: "Yangilangan Ism" })
    );
    // Parent refresh fired and the modal remains open (title still present, reflecting the edit).
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Yangilangan Ism")).toBeInTheDocument();
  });

  it("retains entered values and shows exactly one error toast when the save fails", async () => {
    (listOrdersForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (listFollowUpsForSource as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ok([]));
    (updateClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      err("Mijozni yangilab bo'lmadi: boom")
    );

    renderClientModal(okClient());

    fireEvent.click(await screen.findByTitle("Tahrirlash"));
    const nameInput = screen.getByPlaceholderText("To'liq ism") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Saqlanmaydi" } });
    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    // Error toast surfaced (exactly one), and entered values retained.
    expect(await screen.findByText("Mijozni yangilab bo'lmadi: boom")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect((screen.getByPlaceholderText("To'liq ism") as HTMLInputElement).value).toBe("Saqlanmaydi");
  });
});
