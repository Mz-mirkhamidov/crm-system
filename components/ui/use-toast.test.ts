import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  toastReducer,
  createToastId,
  MAX_VISIBLE,
  type ToastState,
  type ToastAction,
  type ToastRecord,
} from "@/components/ui/use-toast";

// Tests for the toast reducer (frontend-ux-improvements tasks 2.4).
// These are pure-logic tests and run in the default Node environment.

function record(id: string): ToastRecord {
  return { id, variant: "default", duration: 4000, open: true };
}

describe("toastReducer — unit", () => {
  it("ADD prepends newest-first", () => {
    let state: ToastState = { toasts: [] };
    state = toastReducer(state, { type: "ADD", toast: record("a") });
    state = toastReducer(state, { type: "ADD", toast: record("b") });
    expect(state.toasts.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("ADD caps the visible list at MAX_VISIBLE", () => {
    let state: ToastState = { toasts: [] };
    for (let i = 0; i < MAX_VISIBLE + 3; i++) {
      state = toastReducer(state, { type: "ADD", toast: record(`t${i}`) });
    }
    expect(state.toasts.length).toBe(MAX_VISIBLE);
    // Newest survive: the last added id is at the front.
    expect(state.toasts[0].id).toBe(`t${MAX_VISIBLE + 2}`);
  });

  it("DISMISS by id sets only that toast's open=false", () => {
    let state: ToastState = { toasts: [] };
    state = toastReducer(state, { type: "ADD", toast: record("a") });
    state = toastReducer(state, { type: "ADD", toast: record("b") });
    state = toastReducer(state, { type: "DISMISS", id: "a" });
    expect(state.toasts.find((t) => t.id === "a")?.open).toBe(false);
    expect(state.toasts.find((t) => t.id === "b")?.open).toBe(true);
  });

  it("DISMISS without id closes all toasts but keeps them mounted", () => {
    let state: ToastState = { toasts: [] };
    state = toastReducer(state, { type: "ADD", toast: record("a") });
    state = toastReducer(state, { type: "ADD", toast: record("b") });
    state = toastReducer(state, { type: "DISMISS" });
    expect(state.toasts.every((t) => !t.open)).toBe(true);
    expect(state.toasts.length).toBe(2);
  });

  it("REMOVE by id removes that toast", () => {
    let state: ToastState = { toasts: [] };
    state = toastReducer(state, { type: "ADD", toast: record("a") });
    state = toastReducer(state, { type: "ADD", toast: record("b") });
    state = toastReducer(state, { type: "REMOVE", id: "a" });
    expect(state.toasts.map((t) => t.id)).toEqual(["b"]);
  });

  it("REMOVE without id clears everything", () => {
    let state: ToastState = { toasts: [record("a"), record("b")] };
    state = toastReducer(state, { type: "REMOVE" });
    expect(state.toasts).toEqual([]);
  });
});

describe("toastReducer — invariant property", () => {
  it("never exceeds MAX_VISIBLE and ids stay unique for any action sequence", () => {
    // Each ADD uses a fresh crypto id, so collisions should be impossible.
    const addArb = fc
      .constantFrom("default", "success", "error", "warning")
      .map(
        (variant) =>
          ({
            type: "ADD",
            toast: {
              id: createToastId(),
              variant: variant as ToastRecord["variant"],
              duration: 4000,
              open: true,
            },
          }) as ToastAction
      );

    const actionArb: fc.Arbitrary<ToastAction> = fc.oneof(
      addArb,
      fc.constant<ToastAction>({ type: "DISMISS" }),
      fc.constant<ToastAction>({ type: "REMOVE" })
    );

    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 50 }), (actions) => {
        // DISMISS/REMOVE with a concrete id need a target; rewrite some to hit live ids.
        let state: ToastState = { toasts: [] };
        for (const action of actions) {
          if (
            (action.type === "DISMISS" || action.type === "REMOVE") &&
            state.toasts.length > 0
          ) {
            state = toastReducer(state, { ...action, id: state.toasts[0].id });
          } else {
            state = toastReducer(state, action);
          }
          // Invariant 1: visible cap.
          expect(state.toasts.length).toBeLessThanOrEqual(MAX_VISIBLE);
          // Invariant 2: unique ids.
          const ids = state.toasts.map((t) => t.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      })
    );
  });
});
