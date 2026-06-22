"use client";

import * as React from "react";
import { useOperator } from "@/lib/useOperator";
import { useToast } from "@/components/ui/use-toast";
import type { Result } from "@/lib/data/result";

// Generic list-loading hook shared by every entity hook (frontend-ux-improvements
// design §3, Requirements 3.1, 4.5, 5.3, 5.4, 5.5). Owns loading/error state, operator
// scoping, the empty-operator guard, and the single error toast on load failure.

/**
 * Whether a query may run for the given operator id. An empty id means the operator has
 * not resolved yet, so no query is issued (Requirement 5.3). Exported for unit testing.
 */
export const shouldQuery = (operatorId: string): boolean => operatorId !== "";

export interface EntityListState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

export interface UseEntityListOptions {
  /** User-facing message shown via toast.error on load failure. */
  errorMessage?: string;
}

/**
 * @param loader  A STABLE module-level loader (e.g. `listLeads`). Passing an inline
 *                closure will retrigger the load effect on every render.
 */
export function useEntityList<T>(
  loader: (operatorId: string) => Promise<Result<T[]>>,
  options?: UseEntityListOptions
): EntityListState<T> {
  const operator = useOperator();
  const operatorId = operator?.id ?? "";
  const toast = useToast();

  const [data, setData] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const errorMessage = options?.errorMessage;

  const load = React.useCallback(async () => {
    // Guard: never query with an unresolved (empty) operator id.
    if (!shouldQuery(operatorId)) return;
    setLoading(true);
    setError(null);
    const result = await loader(operatorId);
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
      toast.error(errorMessage ?? result.error);
    }
    setLoading(false);
  }, [operatorId, loader, toast, errorMessage]);

  // Re-run whenever the operator resolves/changes.
  React.useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}
