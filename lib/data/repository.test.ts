import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Property 5: Operator-scoping invariant (frontend-ux-improvements task 5.5).
// Every repository read applies .eq(SCOPE_COLUMN, operatorId); the data-access layer
// short-circuits when operatorId === "".
// Validates: Requirements 5.1, 5.2, 5.3.

// A chainable Supabase builder stub that records each method call and resolves to a
// configurable response when awaited.
interface RecordedCall {
  method: string;
  args: unknown[];
}

const holder = vi.hoisted(() => ({
  calls: [] as RecordedCall[],
  response: { data: [] as unknown, error: null as { message: string } | null },
}));

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const methods = [
    "from",
    "select",
    "eq",
    "neq",
    "order",
    "limit",
    "insert",
    "update",
    "delete",
    "single",
  ];
  for (const m of methods) {
    builder[m] = (...args: unknown[]) => {
      holder.calls.push({ method: m, args });
      return builder;
    };
  }
  // Make the builder awaitable (thenable) resolving to the configured response.
  builder.then = (resolve: (value: typeof holder.response) => unknown) =>
    resolve(holder.response);
  return builder;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => makeBuilder(),
}));

import {
  SCOPE_COLUMN,
  listLeads,
  listClients,
  listOrders,
  listFollowUps,
  listOrdersForSource,
} from "@/lib/data/repository";
import { shouldQuery } from "@/lib/data/use-entity-list";

beforeEach(() => {
  holder.calls = [];
  holder.response = { data: [], error: null };
});

function eqCalls() {
  return holder.calls.filter((c) => c.method === "eq");
}

describe("Property 5 — every read scopes by SCOPE_COLUMN with the operator id", () => {
  it("SCOPE_COLUMN is the single shared constant 'user_id'", () => {
    expect(SCOPE_COLUMN).toBe("user_id");
  });

  it("list reads include eq(SCOPE_COLUMN, id) for arbitrary operator ids", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (id) => {
        const readers = [listLeads, listClients, listOrders, listFollowUps];
        for (const read of readers) {
          holder.calls = [];
          await read(id);
          const scoped = eqCalls().some(
            (c) => c.args[0] === SCOPE_COLUMN && c.args[1] === id
          );
          expect(scoped).toBe(true);
        }
      })
    );
  });

  it("listOrdersForSource scopes by operator and filters source", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.constantFrom("lead", "client"),
        async (id, sourceId, sourceType) => {
          holder.calls = [];
          await listOrdersForSource(id, sourceId, sourceType as "lead" | "client");
          const eqs = eqCalls();
          expect(eqs.some((c) => c.args[0] === SCOPE_COLUMN && c.args[1] === id)).toBe(
            true
          );
          expect(eqs.some((c) => c.args[0] === "source_id" && c.args[1] === sourceId)).toBe(
            true
          );
          expect(
            eqs.some((c) => c.args[0] === "source_type" && c.args[1] === sourceType)
          ).toBe(true);
        }
      )
    );
  });

  it("maps a Supabase error into a failed Result (Requirement 3.3)", async () => {
    holder.response = { data: null, error: { message: "boom" } };
    const result = await listLeads("op-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("boom");
  });
});

describe("Property 5 — empty operator id short-circuits the data layer", () => {
  it("shouldQuery is false only for the empty string", () => {
    expect(shouldQuery("")).toBe(false);
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        expect(shouldQuery(id)).toBe(true);
      })
    );
  });
});
