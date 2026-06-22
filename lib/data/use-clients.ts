"use client";

import { useOperator } from "@/lib/useOperator";
import { useToast } from "@/components/ui/use-toast";
import { useEntityList, type EntityListState } from "@/lib/data/use-entity-list";
import { runMutation } from "@/lib/data/run-mutation";
import {
  listClients,
  listOrdersForSource,
  deleteRow,
  convertLeadToClient,
} from "@/lib/data/repository";
import type { Client, Lead, Order } from "@/types";

export interface UseClientsResult extends EntityListState<Client> {
  remove: (id: string) => Promise<void>;
  loadClientOrders: (clientId: string) => Promise<Order[]>;
  convert: (lead: Lead) => Promise<Client | null>;
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

  // Convert a lead into a client (Requirements 3.1, 3.9). Wraps the multi-step
  // repository flow in a single mutation/toast. On success the new client is prepended
  // to the local clients list; the caller is responsible for refetching leads.
  async function convert(lead: Lead): Promise<Client | null> {
    const result = await runMutation<Client>({
      op: () => convertLeadToClient(operatorId, lead),
      toast,
      successMessage: "Lid mijozga aylantirildi",
      apply: (client) =>
        list.setData((prev) =>
          prev.some((c) => c.id === client.id) ? prev : [client, ...prev]
        ),
    });
    return result.ok ? result.data : null;
  }

  return { ...list, remove, loadClientOrders, convert };
}
