"use client";

import { useOperator } from "@/lib/useOperator";
import { useToast } from "@/components/ui/use-toast";
import { useEntityList, type EntityListState } from "@/lib/data/use-entity-list";
import { runMutation } from "@/lib/data/run-mutation";
import {
  listOrders,
  deleteRow,
  confirmOrder,
  getSourceById,
} from "@/lib/data/repository";
import type { Order, Lead, Client } from "@/types";

export interface UseOrdersResult extends EntityListState<Order> {
  remove: (id: string) => Promise<void>;
  /** Confirm a "Keyinroqi" order, moving it to "Hozirgi". */
  confirm: (id: string) => Promise<void>;
  /** Load the lead/client behind an order, for the detail modal. */
  loadSource: (order: Order) => Promise<Lead | Client | null>;
}

export function useOrders(): UseOrdersResult {
  const list = useEntityList<Order>(listOrders, {
    errorMessage: "Zakazlarni yuklab bo'lmadi",
  });
  const operator = useOperator();
  const operatorId = operator?.id ?? "";
  const toast = useToast();

  async function remove(id: string): Promise<void> {
    await runMutation<void>({
      op: () => deleteRow("orders", id),
      toast,
      successMessage: "Zakaz o'chirildi",
      apply: () => list.setData((prev) => prev.filter((o) => o.id !== id)),
    });
  }

  async function confirm(id: string): Promise<void> {
    await runMutation<Order>({
      op: () => confirmOrder(id),
      toast,
      successMessage: "Zakaz tasdiqlandi",
      apply: (order) =>
        list.setData((prev) => prev.map((o) => (o.id === id ? order : o))),
    });
  }

  async function loadSource(order: Order): Promise<Lead | Client | null> {
    const result = await getSourceById(operatorId, order.source_type, order.source_id);
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    return result.data;
  }

  return { ...list, remove, confirm, loadSource };
}
