// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Users } from "lucide-react";
import { AsyncContent } from "@/components/shared/async-content";

// Component tests for AsyncContent (frontend-ux-improvements task 4.3).
// Validates: Property 3 (single branch), Property 4 (no stuck states).

function renderAsync(props: Partial<React.ComponentProps<typeof AsyncContent<number>>>) {
  return render(
    <AsyncContent<number>
      loading={false}
      error={null}
      data={[]}
      empty={{ icon: Users, title: "Lidlar topilmadi" }}
      {...props}
    >
      {(rows) => <div data-testid="rows">rows:{rows.length}</div>}
    </AsyncContent>
  );
}

describe("AsyncContent", () => {
  it("renders the loading spinner while loading", () => {
    renderAsync({ loading: true });
    expect(screen.getByText(/Yuklanmoqda/)).toBeInTheDocument();
    expect(screen.queryByTestId("rows")).not.toBeInTheDocument();
  });

  it("renders ErrorState with a working retry button", () => {
    const onRetry = vi.fn();
    renderAsync({ error: "Yuklab bo'lmadi", onRetry });
    expect(screen.getByText("Yuklab bo'lmadi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Qayta urinish/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders EmptyState when data is empty and there is no error", () => {
    renderAsync({ data: [] });
    expect(screen.getByText("Lidlar topilmadi")).toBeInTheDocument();
    expect(screen.queryByTestId("rows")).not.toBeInTheDocument();
  });

  it("renders children when data is present", () => {
    renderAsync({ data: [1, 2, 3] });
    expect(screen.getByTestId("rows")).toHaveTextContent("rows:3");
  });

  it("loading takes precedence over error and data (single branch)", () => {
    renderAsync({ loading: true, error: "x", data: [1, 2] });
    expect(screen.getByText(/Yuklanmoqda/)).toBeInTheDocument();
    expect(screen.queryByText("x")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rows")).not.toBeInTheDocument();
  });
});
