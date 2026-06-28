"use client";

import * as React from "react";
import { useOperator } from "@/lib/useOperator";
import { useToast } from "@/components/ui/use-toast";
import { runMutation } from "@/lib/data/run-mutation";
import {
  listNotesForSource,
  addNote as addNoteRepo,
  touchClientLastContacted,
} from "@/lib/data/repository";
import type { Note, SourceType } from "@/types";

// Notes/activity-timeline hook (client-management-enhancements design §B.4). Owns the
// notes list, loading/error state, and the operator-scoped read; mirrors the
// empty-operator guard used by `useEntityList`. All data access flows through the
// repository — no inline `supabase.from(...)`.

export interface UseNotesResult {
  notes: Note[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Returns false on empty/whitespace validation or on repository error. */
  addNote: (body: string, kind?: string) => Promise<boolean>;
}

export function useNotes(sourceId: string, sourceType: SourceType): UseNotesResult {
  const operator = useOperator();
  const operatorId = operator?.id ?? "";
  const toast = useToast();

  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    // Guard: never query with an unresolved (empty) operator id or source id.
    if (operatorId === "" || sourceId === "") return;
    setLoading(true);
    setError(null);
    const result = await listNotesForSource(operatorId, sourceId, sourceType);
    if (result.ok) {
      setNotes(result.data);
      setError(null);
    } else {
      setError(result.error);
      toast.error(result.error);
    }
    setLoading(false);
  }, [operatorId, sourceId, sourceType, toast]);

  // Re-run whenever the operator resolves/changes or the source changes.
  React.useEffect(() => {
    reload();
  }, [reload]);

  const addNote = React.useCallback(
    async (body: string, kind: string = "note"): Promise<boolean> => {
      const trimmed = body.trim();
      // Validation: reject empty/whitespace-only bodies before any repository call.
      if (trimmed === "") return false;

      const result = await runMutation<Note>({
        op: () => addNoteRepo(operatorId, { source_type: sourceType, source_id: sourceId, body: trimmed, kind }),
        toast,
        successMessage: "Eslatma qo'shildi",
        // Prepend optimistically: timeline stays reverse-chronological (newest first).
        apply: (note) => setNotes((prev) => [note, ...prev]),
      });

      if (!result.ok) return false;

      // For clients, refresh last_contacted_at (best-effort; silent on failure).
      if (sourceType === "client") {
        await touchClientLastContacted(sourceId);
      }
      return true;
    },
    [operatorId, sourceId, sourceType, toast]
  );

  return { notes, loading, error, reload, addNote };
}
