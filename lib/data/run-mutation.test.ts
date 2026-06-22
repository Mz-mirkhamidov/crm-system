import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { runMutation } from "@/lib/data/run-mutation";
import type { Result } from "@/lib/data/result";
import type { ToastApi } from "@/components/ui/use-toast";

// Property 6: Mutation atomicity in UI + Property 2: Errors are never silent
// (frontend-ux-improvements task 5.6). Validates: Requirements 6.2, 6.3, 3.2.

function makeToastSpy(): ToastApi {
  return {
    show: vi.fn(() => "id"),
    success: vi.fn(() => "id"),
    error: vi.fn(() => "id"),
    warning: vi.fn(() => "id"),
    dismiss: vi.fn(),
  };
}

describe("runMutation — Property 6 (atomicity) + Property 2 (errors not silent)", () => {
  it("success ⇒ exactly one state delta + exactly one success toast (no error toast)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer()), async (initial) => {
        const toast = makeToastSpy();
        let applied = 0;
        const result = await runMutation<number>({
          op: async (): Promise<Result<number>> => ({ ok: true, data: 1 }),
          toast,
          successMessage: "done",
          apply: () => {
            applied += 1;
          },
        });
        expect(result.ok).toBe(true);
        expect(applied).toBe(1); // single delta
        expect(toast.success).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledTimes(0);
        // keep `initial` referenced so the generator is exercised
        expect(Array.isArray(initial)).toBe(true);
      })
    );
  });

  it("failure ⇒ state unchanged + exactly one error toast (no success toast)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (message) => {
        const toast = makeToastSpy();
        let applied = 0;
        const result = await runMutation<number>({
          op: async (): Promise<Result<number>> => ({ ok: false, error: message }),
          toast,
          successMessage: "done",
          apply: () => {
            applied += 1;
          },
        });
        expect(result.ok).toBe(false);
        expect(applied).toBe(0); // state unchanged
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledTimes(0);
      })
    );
  });

  it("models remove over a list: success removes one row, failure leaves it intact", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.uuid(), { minLength: 1 }),
        fc.boolean(),
        async (ids, succeeds) => {
          const toast = makeToastSpy();
          const target = ids[0];
          let state = ids.map((id) => ({ id }));
          await runMutation<void>({
            op: async (): Promise<Result<void>> =>
              succeeds ? { ok: true, data: undefined } : { ok: false, error: "nope" },
            toast,
            successMessage: "o'chirildi",
            apply: () => {
              state = state.filter((r) => r.id !== target);
            },
          });
          if (succeeds) {
            expect(state.find((r) => r.id === target)).toBeUndefined();
            expect(state.length).toBe(ids.length - 1);
            expect(toast.success).toHaveBeenCalledTimes(1);
          } else {
            expect(state.length).toBe(ids.length); // unchanged
            expect(toast.error).toHaveBeenCalledTimes(1);
          }
        }
      )
    );
  });
});
