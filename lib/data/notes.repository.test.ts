import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Feature: client-management-enhancements
// Property + unit tests for the notes repository (tasks 3.1, 3.2).
// Validates: Requirements 2.4, 2.5, 8.2, 8.3.
//
// Reuses the chainable-builder stub pattern from repository.test.ts: each method call is
// recorded and the builder resolves (when awaited) to a configurable response.

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
  builder.then = (resolve: (value: typeof holder.response) => unknown) =>
    resolve(holder.response);
  return builder;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => makeBuilder(),
}));

import { SCOPE_COLUMN, listNotesForSource, addNote } from "@/lib/data/repository";
import type { Note } from "@/types";

beforeEach(() => {
  holder.calls = [];
  holder.response = { data: [], error: null };
});

function eqCalls() {
  return holder.calls.filter((c) => c.method === "eq");
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? "note-1",
    user_id: overrides.user_id ?? "op-1",
    source_type: overrides.source_type ?? "client",
    source_id: overrides.source_id ?? "src-1",
    body: overrides.body ?? "body",
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

describe("Feature: client-management-enhancements, Property 12: reads stay operator-scoped", () => {
  it("listNotesForSource always applies eq(SCOPE_COLUMN, operatorId) for arbitrary ids", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.constantFrom("lead", "client"),
        async (operatorId, sourceId, sourceType) => {
          holder.calls = [];
          await listNotesForSource(operatorId, sourceId, sourceType as "lead" | "client");
          const eqs = eqCalls();
          expect(eqs.some((c) => c.args[0] === SCOPE_COLUMN && c.args[1] === operatorId)).toBe(
            true
          );
          expect(eqs.some((c) => c.args[0] === "source_id" && c.args[1] === sourceId)).toBe(
            true
          );
          expect(
            eqs.some((c) => c.args[0] === "source_type" && c.args[1] === sourceType)
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returned notes all carry the queried operator id (mocked scoped response)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.record({ id: fc.uuid(), created_at: fc.date().map((d) => d.toISOString()) })),
        async (operatorId, rows) => {
          holder.response = {
            data: rows.map((r) => makeNote({ ...r, user_id: operatorId })),
            error: null,
          };
          const result = await listNotesForSource(operatorId, "src-1", "client");
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.data.every((n) => n.user_id === operatorId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Feature: client-management-enhancements, Property 1: notes feed reverse-chronological", () => {
  it("requests created_at DESC ordering on every read", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (sourceId) => {
        holder.calls = [];
        await listNotesForSource("op-1", sourceId, "client");
        const orderCall = holder.calls.find((c) => c.method === "order");
        expect(orderCall).toBeDefined();
        expect(orderCall?.args[0]).toBe("created_at");
        expect(orderCall?.args[1]).toEqual({ ascending: false });
      }),
      { numRuns: 100 }
    );
  });

  it("passes through a DESC-ordered response so the timeline stays newest-first", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 10_000_000 }), { minLength: 1 }),
        async (offsets) => {
          // Build notes sorted DESC by created_at (as the DB would return them).
          const base = Date.now();
          const sortedDesc = [...offsets]
            .sort((a, b) => b - a)
            .map((off, i) =>
              makeNote({ id: `n-${i}`, created_at: new Date(base - off).toISOString() })
            );
          holder.response = { data: sortedDesc, error: null };
          const result = await listNotesForSource("op-1", "src-1", "client");
          expect(result.ok).toBe(true);
          if (result.ok) {
            for (let i = 1; i < result.data.length; i++) {
              const prev = new Date(result.data[i - 1].created_at).getTime();
              const cur = new Date(result.data[i].created_at).getTime();
              expect(prev).toBeGreaterThanOrEqual(cur);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("addNote — operator scoping on insert (Requirement 8.2)", () => {
  it("sets both user_id and operator_id to the operator id", async () => {
    holder.response = { data: makeNote(), error: null };
    await addNote("operator-42", { source_type: "client", source_id: "src-1", body: "hi" });
    const insertCall = holder.calls.find((c) => c.method === "insert");
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload[SCOPE_COLUMN]).toBe("operator-42");
    expect(payload.operator_id).toBe("operator-42");
    expect(payload.source_type).toBe("client");
    expect(payload.source_id).toBe("src-1");
    expect(payload.body).toBe("hi");
  });
});
