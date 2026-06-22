import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  applyFilters,
  getOrderTotal,
  getInitials,
  getLeadAge,
  getRowKey,
  getClientStaleness,
  CLIENT_STALE_DAYS,
  type LeadFilterCriteria,
} from "@/lib/utils";
import type { Lead, Order } from "@/types";

// Unit + property tests for the extracted pure helpers (frontend-ux-improvements
// tasks 6.2, 6.3).

function makeLead(overrides: Partial<Lead> = {}): Lead {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? "lead-1",
    user_id: "op-1",
    name: overrides.name ?? "Ali Valiyev",
    phone: overrides.phone ?? "+998901234567",
    address: overrides.address ?? null,
    tag: overrides.tag ?? null,
    status: overrides.status ?? "Yangi",
    comment: overrides.comment ?? null,
    converted_client_id: overrides.converted_client_id ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const NO_FILTER: LeadFilterCriteria = { search: "", status: "all", tag: "all", age: "all" };

describe("applyFilters", () => {
  it("returns all leads with no active filter", () => {
    const leads = [makeLead({ id: "a" }), makeLead({ id: "b" })];
    expect(applyFilters(leads, NO_FILTER)).toHaveLength(2);
  });

  it("matches search against name and phone (case-insensitive)", () => {
    const leads = [
      makeLead({ id: "a", name: "Bobur", phone: "+998901111111" }),
      makeLead({ id: "b", name: "Salim", phone: "+998902222222" }),
    ];
    expect(applyFilters(leads, { ...NO_FILTER, search: "bobur" }).map((l) => l.id)).toEqual([
      "a",
    ]);
    expect(applyFilters(leads, { ...NO_FILTER, search: "2222222" }).map((l) => l.id)).toEqual(
      ["b"]
    );
  });

  it("filters by exact status and tag", () => {
    const leads = [
      makeLead({ id: "a", status: "Yangi", tag: "Sayt" }),
      makeLead({ id: "b", status: "Kelishildi", tag: "Excel" }),
    ];
    expect(applyFilters(leads, { ...NO_FILTER, status: "Kelishildi" }).map((l) => l.id)).toEqual(
      ["b"]
    );
    expect(applyFilters(leads, { ...NO_FILTER, tag: "Sayt" }).map((l) => l.id)).toEqual(["a"]);
  });

  it("age filter keeps only non-closed leads at least N days old", () => {
    const leads = [
      makeLead({ id: "fresh", created_at: daysAgo(1), status: "Yangi" }),
      makeLead({ id: "old-open", created_at: daysAgo(10), status: "Yangi" }),
      makeLead({ id: "old-closed", created_at: daysAgo(10), status: "Buyurtma berilgan" }),
      makeLead({ id: "old-rejected", created_at: daysAgo(10), status: "Rad etildi" }),
    ];
    expect(applyFilters(leads, { ...NO_FILTER, age: "7" }).map((l) => l.id)).toEqual([
      "old-open",
    ]);
  });
});

describe("getInitials", () => {
  it("takes up to two uppercase initials", () => {
    expect(getInitials("Ali Valiyev")).toBe("AV");
    expect(getInitials("bobur")).toBe("B");
    expect(getInitials("Ali Bek Vali")).toBe("AB");
  });
  it("handles empty and whitespace-only names safely", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });
});

describe("getOrderTotal", () => {
  it("sums prices and coerces to number", () => {
    const orders = [{ price: 100 }, { price: 250 }, { price: "50" }] as unknown as Order[];
    expect(getOrderTotal(orders)).toBe(400);
  });
  it("is zero for an empty list", () => {
    expect(getOrderTotal([])).toBe(0);
  });
});

describe("getLeadAge", () => {
  it("labels today and yesterday", () => {
    expect(getLeadAge(daysAgo(0)).label).toBe("Bugun");
    expect(getLeadAge(daysAgo(1)).label).toBe("Kecha");
  });
  it("buckets older leads with day labels and escalating colors", () => {
    expect(getLeadAge(daysAgo(3)).label).toBe("3k");
    expect(getLeadAge(daysAgo(8)).color).toContain("yellow");
    expect(getLeadAge(daysAgo(20)).color).toContain("red");
  });
});

describe("getRowKey — Property 7 (stable unique keys)", () => {
  it("yields all-distinct keys for arbitrary arrays of rows with unique ids", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.uuid(), { minLength: 1 }), (ids) => {
        const rows = ids.map((id) => ({ id }));
        const keys = rows.map(getRowKey);
        expect(new Set(keys).size).toBe(rows.length);
      })
    );
  });

  it("returns the row id", () => {
    expect(getRowKey({ id: "abc" })).toBe("abc");
  });
});


// =============================================================================
// Feature: client-management-enhancements (tasks 5.1, 5.3, 5.2)
// =============================================================================

const MS_PER_DAY = 86_400_000;

describe("Feature: client-management-enhancements, Property 7: client staleness threshold", () => {
  it("stale is true iff whole days since effective last-contact >= CLIENT_STALE_DAYS", () => {
    const now = Date.parse("2024-06-01T00:00:00.000Z");
    fc.assert(
      fc.property(
        // elapsed ms since last contact: negative = future, positive = past.
        fc.integer({ min: -10 * MS_PER_DAY, max: 60 * MS_PER_DAY }),
        (elapsedMs) => {
          const lastContacted = new Date(now - elapsedMs).toISOString();
          const result = getClientStaleness(
            { last_contacted_at: lastContacted, created_at: lastContacted },
            now
          );
          const expectedDays = Math.max(0, Math.floor(elapsedMs / MS_PER_DAY));
          expect(result.days).toBe(expectedDays);
          expect(result.stale).toBe(expectedDays >= CLIENT_STALE_DAYS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("falls back to created_at when last_contacted_at is null", () => {
    const now = Date.parse("2024-06-01T00:00:00.000Z");
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 * MS_PER_DAY }), (elapsedMs) => {
        const created = new Date(now - elapsedMs).toISOString();
        const viaNull = getClientStaleness(
          { last_contacted_at: null, created_at: created },
          now
        );
        const viaLastContacted = getClientStaleness(
          { last_contacted_at: created, created_at: "1970-01-01T00:00:00.000Z" },
          now
        );
        expect(viaNull).toEqual(viaLastContacted);
      }),
      { numRuns: 100 }
    );
  });

  it("clamps future timestamps to 0 days (never negative, never stale)", () => {
    const now = Date.parse("2024-06-01T00:00:00.000Z");
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 * MS_PER_DAY }), (futureMs) => {
        const future = new Date(now + futureMs).toISOString();
        const result = getClientStaleness(
          { last_contacted_at: future, created_at: future },
          now
        );
        expect(result.days).toBe(0);
        expect(result.stale).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("boundary: exactly 7 whole days is stale, 6 days is not", () => {
    const now = Date.parse("2024-06-01T00:00:00.000Z");
    const sevenDays = new Date(now - 7 * MS_PER_DAY).toISOString();
    const sixDays = new Date(now - 6 * MS_PER_DAY).toISOString();
    expect(
      getClientStaleness({ last_contacted_at: sevenDays, created_at: sevenDays }, now).stale
    ).toBe(true);
    expect(
      getClientStaleness({ last_contacted_at: sixDays, created_at: sixDays }, now).stale
    ).toBe(false);
  });
});

describe("Feature: client-management-enhancements, Property 6: converted leads leave the active pipeline", () => {
  const ALL_STATUSES: Lead["status"][] = [
    "Yangi",
    "Ko'rib chiqilmoqda",
    "Kelishildi",
    "Rad etildi",
    "Buyurtma berilgan",
    "Mijozga aylandi",
  ];
  const CLOSED: Lead["status"][] = ["Buyurtma berilgan", "Rad etildi", "Mijozga aylandi"];

  it("the age/cold filter excludes converted (and other closed) leads", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...ALL_STATUSES), { minLength: 1, maxLength: 30 }),
        (statuses) => {
          const leads = statuses.map((status, i) =>
            makeLead({ id: `l${i}`, status, created_at: daysAgo(30) })
          );
          const filtered = applyFilters(leads, { ...NO_FILTER, age: "7" });
          // No converted lead survives the cold/age filter.
          expect(filtered.some((l) => l.status === "Mijozga aylandi")).toBe(false);
          // More generally, no closed-status lead survives.
          expect(filtered.every((l) => !CLOSED.includes(l.status))).toBe(true);
          // Open leads at least N days old DO survive.
          const openCount = leads.filter((l) => !CLOSED.includes(l.status)).length;
          expect(filtered.length).toBe(openCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
