"use client";

import { useToast } from "@/components/ui/use-toast";
import { useEntityList, type EntityListState } from "@/lib/data/use-entity-list";
import { runMutation } from "@/lib/data/run-mutation";
import { listFollowUps, deleteRow, markFollowUpDone } from "@/lib/data/repository";
import type { FollowUp } from "@/types";

export interface UseFollowUpsResult extends EntityListState<FollowUp> {
  remove: (id: string) => Promise<void>;
  markDone: (id: string) => Promise<void>;
}

export function useFollowUps(): UseFollowUpsResult {
  const list = useEntityList<FollowUp>(listFollowUps, {
    errorMessage: "Follow-uplarni yuklab bo'lmadi",
  });
  const toast = useToast();

  async function remove(id: string): Promise<void> {
    await runMutation<void>({
      op: () => deleteRow("follow_ups", id),
      toast,
      successMessage: "Follow-up o'chirildi",
      apply: () => list.setData((prev) => prev.filter((f) => f.id !== id)),
    });
  }

  async function markDone(id: string): Promise<void> {
    await runMutation<FollowUp>({
      op: () => markFollowUpDone(id),
      toast,
      successMessage: "Follow-up bajarildi",
      apply: (updated) =>
        list.setData((prev) => prev.map((f) => (f.id === id ? updated : f))),
    });
  }

  return { ...list, remove, markDone };
}
