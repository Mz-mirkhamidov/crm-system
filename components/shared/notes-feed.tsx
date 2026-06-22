"use client";

import { useState } from "react";
import { useNotes } from "@/lib/data/use-notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AsyncContent } from "@/components/shared/async-content";
import { Loader2, MessageSquare, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { SourceType } from "@/types";

// Shared, presentational notes/activity timeline (client-management-enhancements task 7.1,
// design §B.5). All data access flows through `useNotes` → repository (Requirement 8.1);
// no inline `supabase.from(...)`. The hook already toasts on add/read failures, so this
// component stays purely presentational.
//
// Layout: an add-note input ABOVE a reverse-chronological feed (newest first, Req 2.4),
// wrapped in `AsyncContent` for the loading/error/empty branches with a retry that calls
// `reload` (Req 2.9). The input clears only on a successful submit (Req 2.8).

interface NotesFeedProps {
  sourceId: string;
  sourceType: SourceType;
}

export function NotesFeed({ sourceId, sourceType }: NotesFeedProps) {
  const { notes, loading, error, reload, addNote } = useNotes(sourceId, sourceType);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedEmpty = body.trim() === "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || trimmedEmpty) return;
    setSubmitting(true);
    const success = await addNote(body);
    setSubmitting(false);
    // Clear the input only on a successful submit (Req 2.8); on failure keep the text so
    // the operator can retry without retyping.
    if (success) setBody("");
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Eslatma yozish..."
          disabled={submitting}
          className="min-h-[60px]"
          aria-label="Eslatma"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" className="gap-1.5" disabled={submitting || trimmedEmpty}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Qo'shish
          </Button>
        </div>
      </form>

      <AsyncContent
        loading={loading}
        error={error}
        data={notes}
        onRetry={reload}
        empty={{ icon: MessageSquare, title: "Eslatmalar yo'q" }}
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((note) => (
              <div key={note.id} className="bg-secondary/50 border border-border rounded-lg px-4 py-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.body}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{formatDate(note.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </AsyncContent>
    </div>
  );
}
