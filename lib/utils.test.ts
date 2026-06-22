import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  applyFilters,
  getOrderTotal,
  getInitials,
  getLeadAge,
  getRowKey,
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
