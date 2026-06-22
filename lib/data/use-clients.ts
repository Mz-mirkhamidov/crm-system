"use client";

import { useOperator } from "@/lib/useOperator";
import { useToast } from "@/components/ui/use-toast";
import { useEntityList, type EntityListState } from "@/lib/data/use-entity-list";
import { runMutation } from "@/lib/data/run-mutation";
import { listClients, listOrdersForSource, deleteRow } from "@/lib/data/repository";
import type { Client, Order } from "@/types";

export interface UseClientsResult extends EntityListState<Client> {
  remove: (id: string) => Promise<void>;
  loadClientOrders: (clientId: string) => Promise<Order[]>;
}

export function useClients(): UseClientsResult {
  const list = useEntityList<Client>(listClients, {
    errorMessage: "Mijozlarni yuklab bo'lmadi",
  });
  const operator = useOperator();
  const operatorId = operator?.id ?? "";
  const toast = useToast();

  async function remove(id: string): Promise<void> {
    await runMutation<void>({
      op: () => deleteRow("clients", id),
      toast,
      successMessage: "Mijoz o'chirildi",
      apply: () => list.setData((prev) => prev.filter((c) => c.id !== id)),
    });
  }

  async function loadClientOrders(clientId: string): Promise<Order[]> {
    const result = await listOrdersForSource(operatorId, clientId, "client");
    if (!result.ok) {
      toast.error(result.error);
      return [];
    }
    return result.data;
  }

  return { ...list, remove, loadClientOrders };
}
