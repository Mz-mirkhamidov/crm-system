import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Feature: client-management-enhancements
// Property + unit tests for convertLeadToClient (tasks 3.4, 3.5).
// Validates: Requirements 3.1, 3.2, 3.5, 3.8.
//
// These tests use a STATEFUL in-memory fake of the Supabase client so the multi-step
// conversion (insert client -> re-point notes -> update lead) can be exercised against a
// real-ish data store, letting us assert the timeline re-point count and idempotency.

interface Row {
  [key: string]: unknown;
}

interface FakeStore {
  clients: Row[];
  notes: Row[];
  leads: Row[];
  forceInsertError: boolean;
  idSeq: number;
}

const store = vi.hoisted(
  () =>
    ({
      clients: [] as Row[],
      notes: [] as Row[],
      leads: [] as Row[],
      forceInsertError: false,
      idSeq: 0,
    }) as FakeStore
);

interface QueryState {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload: Row | undefined;
  eqs: [string, unknown][];
  single: boolean;
}

function matches(row: Row, eqs: [string, unknown][]): boolean {
  return eqs.every(([col, val]) => row[col] === val);
}

function execute(state: QueryState): { data: unknown; error: { message: string } | null } {
  const table = state.table as keyof Pick<FakeStore, "clients" | "notes" | "leads">;
  if (state.op === "insert") {
    if (table === "clients" && store.forceInsertError) {
      return { data: null, error: { message: "insert failed" } };
    }
    const row: Row = { id: `gen-${++store.idSeq}`, ...(state.payload ?? {}) };
    store[table].push(row);
    return { data: state.single ? row : [row], error: null };
  }
  if (state.op === "update") {
    const targets = store[table].filter((r) => matches(r, state.eqs));
    for (const r of targets) Object.assign(r, state.payload ?? {});
    return { data: state.single ? (targets[0] ?? null) : targets, error: null };
  }
  if (state.op === "delete") {
    store[table] = store[table].filter((r) => !matches(r, state.eqs));
    return { data: null, error: null };
  }
  // select
  const found = store[table].filter((r) => matches(r, state.eqs));
  return { data: state.single ? (found[0] ?? null) : found, error: null };
}

function makeQuery(table: string) {
  const state: QueryState = { table, op: "select", payload: undefined, eqs: [], single: false };
  const q: Record<string, unknown> = {
    select: () => q,
    insert: (payload: Row) => {
      state.op = "insert";
      state.payload = payload;
      return q;
    },
    update: (payload: Row) => {
      state.op = "update";
      state.payload = payload;
      return q;
    },
    delete: () => {
      state.op = "delete";
      return q;
    },
    eq: (col: string, val: unknown) => {
      state.eqs.push([col, val]);
      return q;
    },
    neq: () => q,
    order: () => q,
    limit: () => q,
    single: () => {
      state.single = true;
      return q;
    },
    then: (resolve: (v: ReturnType<typeof execute>) => unknown) => resolve(execute(state)),
  };
  return q;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: (table: string) => makeQuery(table) }),
}));

import { convertLeadToClient } from "@/lib/data/repository";
import type { Lead } from "@/types";

beforeEach(() => {
  store.clients = [];
  store.notes = [];
  store.leads = [];
  store.forceInsertError = false;
  store.idSeq = 0;
});

const OP = "op-1";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? "lead-1",
    user_id: OP,
    name: overrides.name ?? "Ali",
    phone: overrides.phone ?? "+998901112233",
    address: overrides.address ?? "Tashkent",
    tag: overrides.tag ?? "Sayt",
    status: overrides.status ?? "Yangi",
    comment: overrides.comment ?? "note",
    converted_client_id: overrides.converted_client_id ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    ...overrides,
  };
}

describe("Feature: client-management-enhancements, Property 4: conversion re-points the full timeline", () => {
  it("client ends with exactly the lead's N notes; lead retains none", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 0, max: 10 }), async (n, unrelated) => {
        store.clients = [];
        store.notes = [];
        store.leads = [];
        store.idSeq = 0;
        const lead = makeLead({ id: "lead-x" });
        store.leads.push({ ...lead });
        for (let i = 0; i < n; i++) {
          store.notes.push({
            id: `note-${i}`,
            user_id: OP,
            source_type: "lead",
            source_id: lead.id,
            body: `b${i}`,
          });
        }
        // Unrelated notes (other source / other operator) must remain untouched.
        for (let i = 0; i < unrelated; i++) {
          store.notes.push({
            id: `other-${i}`,
            user_id: i % 2 === 0 ? "op-2" : OP,
            source_type: "lead",
            source_id: "different-lead",
            body: "x",
          });
        }

        const result = await convertLeadToClient(OP, lead);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const clientId = result.data.id;

        const onClient = store.notes.filter(
          (nt) => nt.source_type === "client" && nt.source_id === clientId
        );
        const stillOnLead = store.notes.filter(
          (nt) => nt.source_type === "lead" && nt.source_id === lead.id
        );
        expect(onClient.length).toBe(n);
        expect(stillOnLead.length).toBe(0);
        // No notes lost or duplicated overall.
        expect(store.notes.length).toBe(n + unrelated);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: client-management-enhancements, Property 5: conversion is idempotent", () => {
  it("an already-converted lead creates no second client and duplicates no notes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 20 }), async (n) => {
        store.clients = [];
        store.notes = [];
        store.leads = [];
        store.idSeq = 0;
        // Pre-existing converted client + its re-pointed notes.
        const existingClientId = "client-existing";
        store.clients.push({ id: existingClientId, user_id: OP, name: "Ali" });
        for (let i = 0; i < n; i++) {
          store.notes.push({
            id: `note-${i}`,
            user_id: OP,
            source_type: "client",
            source_id: existingClientId,
            body: `b${i}`,
          });
        }
        const lead = makeLead({ id: "lead-c", converted_client_id: existingClientId });

        const clientsBefore = store.clients.length;
        const notesBefore = store.notes.length;
        const result = await convertLeadToClient(OP, lead);

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.data.id).toBe(existingClientId);
        expect(store.clients.length).toBe(clientsBefore); // no second client
        expect(store.notes.length).toBe(notesBefore); // no duplicated notes
      }),
      { numRuns: 100 }
    );
  });
});

describe("convertLeadToClient — unit: insert failure + field mapping", () => {
  it("client insert failure performs no notes re-point or lead update (Req 3.8)", async () => {
    const lead = makeLead({ id: "lead-fail" });
    store.leads.push({ ...lead, status: "Yangi", converted_client_id: null });
    store.notes.push({
      id: "note-1",
      user_id: OP,
      source_type: "lead",
      source_id: lead.id,
      body: "keep",
    });
    store.forceInsertError = true;

    const result = await convertLeadToClient(OP, lead);
    expect(result.ok).toBe(false);
    // Notes untouched.
    expect(store.notes[0].source_type).toBe("lead");
    expect(store.notes[0].source_id).toBe(lead.id);
    // Lead untouched.
    const leadRow = store.leads.find((l) => l.id === lead.id)!;
    expect(leadRow.status).toBe("Yangi");
    expect(leadRow.converted_client_id).toBeNull();
    // No client created.
    expect(store.clients.length).toBe(0);
  });

  it("maps lead fields onto the created client and sets scope + last_contacted_at (Req 3.1, 3.4)", async () => {
    const lead = makeLead({
      id: "lead-map",
      name: "Vali",
      phone: "+998900000000",
      address: "Samarqand",
      comment: "vip",
      tag: "Excel",
    });
    store.leads.push({ ...lead });

    const result = await convertLeadToClient(OP, lead);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = store.clients.find((c) => c.id === result.data.id)!;
    expect(created.name).toBe("Vali");
    expect(created.phone).toBe("+998900000000");
    expect(created.address).toBe("Samarqand");
    expect(created.comment).toBe("vip");
    expect(created.tag).toBe("Excel");
    expect(created.user_id).toBe(OP);
    expect(created.operator_id).toBe(OP);
    expect(typeof created.last_contacted_at).toBe("string");

    // Lead marked converted + linked.
    const leadRow = store.leads.find((l) => l.id === lead.id)!;
    expect(leadRow.status).toBe("Mijozga aylandi");
    expect(leadRow.converted_client_id).toBe(result.data.id);
  });
});
