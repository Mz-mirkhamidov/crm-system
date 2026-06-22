// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import fc from "fast-check";

// Feature: client-management-enhancements
// Property + unit tests for useNotes (tasks 4.1, 4.2).
// Validates: Requirements 2.2, 2.3, 2.7.

const toastSpy = {
  show: vi.fn(() => "id"),
  success: vi.fn(() => "id"),
  error: vi.fn(() => "id"),
  warning: vi.fn(() => "id"),
  dismiss: vi.fn(),
};

vi.mock("@/components/ui/use-toast", () => ({ useToast: () => toastSpy }));
vi.mock("@/lib/useOperator", () => ({
  useOperator: () => ({ id: "op-1", name: "Test", username: "test" }),
}));
vi.mock("@/lib/data/repository", () => ({
  listNotesForSource: vi.fn(),
  addNote: vi.fn(),
  touchClientLastContacted: vi.fn(),
}));

import { useNotes } from "@/lib/data/use-notes";
import {
  listNotesForSource,
  addNote,
  touchClientLastContacted,
} from "@/lib/data/repository";
import type { Note } from "@/types";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const asMock = (f: unknown) => f as unknown as ReturnType<typeof vi.fn>;

function makeNote(over: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: over.id ?? "note-1",
    user_id: "op-1",
    source_type: over.source_type ?? "client",
    source_id: over.source_id ?? "src-1",
    body: over.body ?? "body",
    created_at: over.created_at ?? now,
    updated_at: over.updated_at ?? now,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  asMock(listNotesForSource).mockResolvedValue(ok([] as Note[]));
  asMock(addNote).mockResolvedValue(ok(makeNote()));
  asMock(touchClientLastContacted).mockResolvedValue(ok({}));
});

const whitespaceArb = fc
  .array(fc.constantFrom(" ", "\t", "\n", "\r", "\f"), { maxLength: 20 })
  .map((a) => a.join(""));

describe("Feature: client-management-enhancements, Property 2: empty/whitespace notes rejected", () => {
  it("addNote returns false, triggers no insert, and leaves the list unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(whitespaceArb, async (ws) => {
        asMock(listNotesForSource).mockResolvedValue(ok([] as Note[]));
        asMock(addNote).mockClear();

        const { result, unmount } = renderHook(() => useNotes("src-1", "client"));
        await waitFor(() => expect(result.current.loading).toBe(false));

        let ret: boolean | undefined;
        await act(async () => {
          ret = await result.current.addNote(ws);
        });

        expect(ret).toBe(false);
        expect(addNote).not.toHaveBeenCalled();
        expect(result.current.notes).toHaveLength(0);
        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: client-management-enhancements, Property 3: adding a note grows the timeline by one", () => {
  it("a successful add yields length+1 and prepends the new note", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            created_at: fc.date({ min: new Date(0) }).map((d) => d.toISOString()),
          }),
          { maxLength: 10 }
        ),
        fc.string({ minLength: 1 }).map((s) => "x" + s),
        async (existing, body) => {
          const existingNotes = existing.map((e) => makeNote(e));
          asMock(listNotesForSource).mockResolvedValue(ok(existingNotes));
          const newNote = makeNote({ id: "new-id", body: body.trim() });
          asMock(addNote).mockResolvedValue(ok(newNote));

          const { result, unmount } = renderHook(() => useNotes("src-1", "client"));
          await waitFor(() => expect(result.current.loading).toBe(false));
          const before = result.current.notes.length;

          let ret: boolean | undefined;
          await act(async () => {
            ret = await result.current.addNote(body);
          });

          expect(ret).toBe(true);
          expect(result.current.notes.length).toBe(before + 1);
          expect(result.current.notes[0].id).toBe(newNote.id);
          expect(result.current.notes.some((n) => n.id === newNote.id)).toBe(true);
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("useNotes — unit: single toast + touchClientLastContacted scoping (Req 2.7)", () => {
  it("shows exactly one success toast and touches last_contacted for clients", async () => {
    asMock(addNote).mockResolvedValue(ok(makeNote({ source_type: "client" })));

    const { result, unmount } = renderHook(() => useNotes("src-1", "client"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addNote("hello");
    });

    expect(toastSpy.success).toHaveBeenCalledTimes(1);
    expect(toastSpy.error).not.toHaveBeenCalled();
    expect(touchClientLastContacted).toHaveBeenCalledTimes(1);
    expect(touchClientLastContacted).toHaveBeenCalledWith("src-1");
    unmount();
  });

  it("does NOT touch last_contacted for leads", async () => {
    asMock(addNote).mockResolvedValue(ok(makeNote({ source_type: "lead", source_id: "lead-1" })));

    const { result, unmount } = renderHook(() => useNotes("lead-1", "lead"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addNote("hello");
    });

    expect(toastSpy.success).toHaveBeenCalledTimes(1);
    expect(touchClientLastContacted).not.toHaveBeenCalled();
    unmount();
  });
});
