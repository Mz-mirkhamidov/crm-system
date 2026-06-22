// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

// Component tests for the toast system (frontend-ux-improvements task 2.5).
// Validates: Property 1 (no blocking alerts), Property 2 (errors not silent).

function Harness() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.error("Xatolik yuz berdi")}>fire-error</button>
      <button onClick={() => toast.success("Saqlandi")}>fire-success</button>
      <Toaster />
    </div>
  );
}

function renderHarness() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>
  );
}

describe("Toaster + useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("error toast renders role=status, the message, and an assertive live region", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("fire-error"));
    });
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Xatolik yuz berdi")).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Bildirishnomalar" });
    expect(region).toHaveAttribute("aria-live", "assertive");
  });

  it("success toast uses a polite live region", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("fire-success"));
    });
    expect(screen.getByText("Saqlandi")).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Bildirishnomalar" });
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("auto-dismisses after the configured duration", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("fire-success"));
    });
    expect(screen.getByText("Saqlandi")).toBeInTheDocument();
    // Advance past duration (4000ms) + removal delay (200ms).
    act(() => {
      vi.advanceTimersByTime(4300);
    });
    expect(screen.queryByText("Saqlandi")).not.toBeInTheDocument();
  });

  it("manual close removes the toast", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("fire-error"));
    });
    expect(screen.getByText("Xatolik yuz berdi")).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Yopish" }));
    });
    expect(screen.queryByText("Xatolik yuz berdi")).not.toBeInTheDocument();
  });

  it("useToast throws when used outside a ToastProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Harness />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
