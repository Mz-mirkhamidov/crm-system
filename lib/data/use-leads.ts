"use client";

import * as React from "react";
import { useOperator } from "@/lib/useOperator";
import { useToast } from "@/components/ui/use-toast";
import { useEntityList, type EntityListState } from "@/lib/data/use-entity-list";
import { runMutation } from "@/lib/data/run-mutation";
import {
  listLeads,
  listOrders,
  listOrdersForSource,
  deleteRow,
  findDuplicateByPhone,
  type DuplicateMatch,
} from "@/lib/data/repository";
import type { Lead, Order } from "@/types";

export interface UseLeadsResult extends EntityListState<Lead> {
  remove: (id: string) => Promise<void>;
  loadLeadOrders: (leadId: string) => Promise<Order[]>;
  checkDuplicate: (phone: string, excludeId?: string) => Promise<DuplicateMatch | null>;
  /** Count of orders per lead id (for the order-count badge). */
  orderCounts: Record<string, number>;
}

export function useLeads(): UseLeadsResult {
  const list = useEntityList<Lead>(listLeads, { errorMessage: "Lidlarni yuklab bo'lmadi" });
  const operator = useOperator();
  const operatorId = operator?.id ?? "";
  const toast = useToast();

  const [orderCounts, setOrderCounts] = React.useState<Record<string, number>>({});

  // Best-effort order-count badge data: derived from the operator's orders, grouped by
  // the lead they originate from. Reloads whenever the lead list reloads (e.g. after an
  // order is created and the list refetches). Failures are silent — the badge is
  // supplementary and the list's own error path already surfaces load failures.
  const loadOrderCounts = React.useCallback(async () => {
    if (operatorId === "") {
      setOrderCounts({});
      return;
    }
    const result = await listOrders(operatorId);
    if (!result.ok) return;
    const counts: Record<string, number> = {};
    for (const o of result.data) {
      if (o.source_type === "lead") {
        counts[o.source_id] = (counts[o.source_id] ?? 0) + 1;
      }
    }
    setOrderCounts(counts);
  }, [operatorId]);

  React.useEffect(() => {
    loadOrderCounts();
  }, [loadOrderCounts, list.data]);

  async function remove(id: string): Promise<void> {
    await runMutation<void>({
      op: () => deleteRow("leads", id),
      toast,
      successMessage: "Lid o'chirildi",
      apply: () => list.setData((prev) => prev.filter((l) => l.id !== id)),
    });
  }

  async function loadLeadOrders(leadId: string): Promise<Order[]> {
    const result = await listOrdersForSource(operatorId, leadId, "lead");
    if (!result.ok) {
      toast.error(result.error);
      return [];
    }
    return result.data;
  }

  async function checkDuplicate(
    phone: string,
    excludeId?: string
  ): Promise<DuplicateMatch | null> {
    const result = await findDuplicateByPhone(operatorId, phone, excludeId);
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    return result.data;
  }

  return { ...list, remove, loadLeadOrders, checkDuplicate, orderCounts };
}
