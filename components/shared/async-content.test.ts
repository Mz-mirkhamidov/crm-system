import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { selectBranch } from "@/components/shared/async-content";

// Property tests for the async branch selector (frontend-ux-improvements task 4.2).
// Validates: Requirements 2.1, 2.2, 2.7 (Property 3 single-branch, Property 4 no-stuck).

describe("selectBranch — Property 3 (deterministic single branch)", () => {
  it("returns exactly the branch dictated by precedence loading > error > empty > data", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.string(), { nil: null }),
        fc.array(fc.anything()),
        (loading, error, data) => {
          const branch = selectBranch({ loading, error, data });
          if (loading) return branch === "loading";
          if (error !== null) return branch === "error";
          if (data.length === 0) return branch === "empty";
          return branch === "data";
        }
      )
    );
  });
});

describe("selectBranch — Property 4 (no stuck loading state)", () => {
  it("never returns 'loading' once loading is false", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: null }),
        fc.array(fc.anything()),
        (error, data) => {
          expect(selectBranch({ loading: false, error, data })).not.toBe("loading");
        }
      )
    );
  });
});

describe("selectBranch — unit", () => {
  it("loading wins over error and data", () => {
    expect(selectBranch({ loading: true, error: "x", data: [1] })).toBe("loading");
  });
  it("error wins over empty/data when not loading", () => {
    expect(selectBranch({ loading: false, error: "boom", data: [] })).toBe("error");
    expect(selectBranch({ loading: false, error: "boom", data: [1] })).toBe("error");
  });
  it("empty when no error and empty data", () => {
    expect(selectBranch({ loading: false, error: null, data: [] })).toBe("empty");
  });
  it("data when no error and non-empty data", () => {
    expect(selectBranch({ loading: false, error: null, data: [1] })).toBe("data");
  });
});
