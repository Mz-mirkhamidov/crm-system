// Typed query builders over the browser Supabase client (frontend-ux-improvements
// design §3, Requirements 3.3, 4.1, 4.4, 5.1, 5.2). This is the SINGLE place the operator
// scoping column is applied to reads, and the SINGLE place Supabase `{ data, error }`
// responses are mapped into `Result<T>`. UI components must never call `supabase.from`
// directly once migrated.

import { createClient } from "@/lib/supabase/client";
import type {
  Lead,
  Client,
  Order,
  FollowUp,
  LeadStatus,
  OrderType,
  SourceType,
} from "@/types";
import { type Result, ok, err } from "@/lib/data/result";

/** Single source of truth for the operator-scoping column applied to every read. */
export const SCOPE_COLUMN = "user_id" as const;

/** Sentinel used to mean "no exclusion" in duplicate checks, mirroring the legacy code. */
const NO_EXCLUDE_ID = "00000000-0000-0000-0000-000000000000";

export type EntityTable = "leads" | "clients" | "orders" | "follow_ups";

// ---- Input shapes (domain fields only; scope columns are added by the repository) ----

export interface LeadInput {
  name: string;
  phone: string;
  address: string | null;
  tag: string | null;
  status: LeadStatus;
  comment: string | null;
}

export interface ClientInput {
  name: string;
  phone: string;
  address: string | null;
  comment: string | null;
}

export interface OrderInput {
  source_type: SourceType;
  source_id: string;
  source_name: string;
  /** Stored as a human-readable product summary string, e.g. "AJR Sedan (2 ta)". */
  product: string;
  price: number;
  quantity: number;
  order_type: OrderType;
  comment: string | null;
  scheduled_at: string | null;
}

export interface FollowUpInput {
  source_type: SourceType;
  source_id: string;
  source_name: string;
  source_phone: string;
  scheduled_at: string;
  note: string | null;
}

export type DuplicateMatch = { name: string; type: "lid" | "mijoz" };

// ---- Response mapping helpers ----

interface SupabaseLike {
  data: unknown;
  error: { message: string } | null;
}

function mapMany<T>(res: SupabaseLike, context: string): Result<T[]> {
  if (res.error) return err(`${context}: ${res.error.message}`);
  return ok((res.data as T[] | null) ?? []);
}

function mapSingle<T>(res: SupabaseLike, context: string): Result<T> {
  if (res.error) return err(`${context}: ${res.error.message}`);
  if (res.data == null) return err(`${context}: ma'lumot topilmadi`);
  return ok(res.data as T);
}

function mapVoid(res: SupabaseLike, context: string): Result<void> {
  if (res.error) return err(`${context}: ${res.error.message}`);
  return ok(undefined);
}

// ---- Reads (every read applies .eq(SCOPE_COLUMN, operatorId)) ----

export async function listLeads(operatorId: string): Promise<Result<Lead[]>> {
  const supabase = createClient();
  const res = await supabase
    .from("leads")
    .select("*")
    .eq(SCOPE_COLUMN, operatorId)
    .order("created_at", { ascending: false });
  return mapMany<Lead>(res, "Lidlarni yuklab bo'lmadi");
}

export async function listClients(operatorId: string): Promise<Result<Client[]>> {
  const supabase = createClient();
  const res = await supabase
    .from("clients")
    .select("*")
    .eq(SCOPE_COLUMN, operatorId)
    .order("created_at", { ascending: false });
  return mapMany<Client>(res, "Mijozlarni yuklab bo'lmadi");
}

export async function listOrders(operatorId: string): Promise<Result<Order[]>> {
  const supabase = createClient();
  const res = await supabase
    .from("orders")
    .select("*")
    .eq(SCOPE_COLUMN, operatorId)
    .order("created_at", { ascending: false });
  return mapMany<Order>(res, "Zakazlarni yuklab bo'lmadi");
}

export async function listFollowUps(operatorId: string): Promise<Result<FollowUp[]>> {
  const supabase = createClient();
  const res = await supabase
    .from("follow_ups")
    .select("*")
    .eq(SCOPE_COLUMN, operatorId)
    .order("scheduled_at", { ascending: true });
  return mapMany<FollowUp>(res, "Follow-uplarni yuklab bo'lmadi");
}

export async function listOrdersForSource(
  operatorId: string,
  sourceId: string,
  sourceType: SourceType
): Promise<Result<Order[]>> {
  const supabase = createClient();
  const res = await supabase
    .from("orders")
    .select("*")
    .eq(SCOPE_COLUMN, operatorId)
    .eq("source_id", sourceId)
    .eq("source_type", sourceType)
    .order("created_at", { ascending: false });
  return mapMany<Order>(res, "Zakaz tarixini yuklab bo'lmadi");
}

export async function listFollowUpsForSource(
  operatorId: string,
  sourceId: string,
  sourceType: SourceType
): Promise<Result<FollowUp[]>> {
  const supabase = createClient();
  const res = await supabase
    .from("follow_ups")
    .select("*")
    .eq(SCOPE_COLUMN, operatorId)
    .eq("source_id", sourceId)
    .eq("source_type", sourceType)
    .order("scheduled_at", { ascending: false });
  return mapMany<FollowUp>(res, "Eslatmalar tarixini yuklab bo'lmadi");
}

export async function getSourceById(
  operatorId: string,
  sourceType: SourceType,
  id: string
): Promise<Result<Lead | Client>> {
  const supabase = createClient();
  const table = sourceType === "lead" ? "leads" : "clients";
  const res = await supabase
    .from(table)
    .select("*")
    .eq(SCOPE_COLUMN, operatorId)
    .eq("id", id)
    .single();
  return mapSingle<Lead | Client>(res, "Ma'lumotni yuklab bo'lmadi");
}

// ---- Lead writes ----

export async function insertLead(
  operatorId: string,
  input: LeadInput
): Promise<Result<Lead>> {
  const supabase = createClient();
  const res = await supabase
    .from("leads")
    .insert({ [SCOPE_COLUMN]: operatorId, ...input })
    .select()
    .single();
  return mapSingle<Lead>(res, "Lidni saqlab bo'lmadi");
}

export async function updateLead(
  id: string,
  input: Partial<LeadInput>
): Promise<Result<Lead>> {
  const supabase = createClient();
  const res = await supabase
    .from("leads")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return mapSingle<Lead>(res, "Lidni yangilab bo'lmadi");
}

// ---- Client writes ----

export async function insertClient(
  operatorId: string,
  input: ClientInput
): Promise<Result<Client>> {
  const supabase = createClient();
  const res = await supabase
    .from("clients")
    .insert({ [SCOPE_COLUMN]: operatorId, operator_id: operatorId, ...input })
    .select()
    .single();
  return mapSingle<Client>(res, "Mijozni saqlab bo'lmadi");
}

export async function updateClient(
  id: string,
  input: Partial<ClientInput>
): Promise<Result<Client>> {
  const supabase = createClient();
  const res = await supabase
    .from("clients")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return mapSingle<Client>(res, "Mijozni yangilab bo'lmadi");
}

// ---- Order writes ----

export async function insertOrder(
  operatorId: string,
  input: OrderInput
): Promise<Result<Order>> {
  const supabase = createClient();
  const res = await supabase
    .from("orders")
    .insert({ [SCOPE_COLUMN]: operatorId, operator_id: operatorId, ...input })
    .select()
    .single();
  return mapSingle<Order>(res, "Zakazni saqlab bo'lmadi");
}

export async function confirmOrder(id: string): Promise<Result<Order>> {
  const supabase = createClient();
  const res = await supabase
    .from("orders")
    .update({ order_type: "Hozirgi", scheduled_at: null })
    .eq("id", id)
    .select()
    .single();
  return mapSingle<Order>(res, "Zakazni tasdiqlab bo'lmadi");
}

// ---- Follow-up writes ----

export async function insertFollowUp(
  operatorId: string,
  input: FollowUpInput
): Promise<Result<FollowUp>> {
  const supabase = createClient();
  const res = await supabase
    .from("follow_ups")
    .insert({
      [SCOPE_COLUMN]: operatorId,
      ...input,
      status: "Kutilmoqda",
    })
    .select()
    .single();
  return mapSingle<FollowUp>(res, "Follow-upni saqlab bo'lmadi");
}

export async function markFollowUpDone(id: string): Promise<Result<FollowUp>> {
  const supabase = createClient();
  const res = await supabase
    .from("follow_ups")
    .update({ status: "Bajarildi" })
    .eq("id", id)
    .select()
    .single();
  return mapSingle<FollowUp>(res, "Follow-upni belgilab bo'lmadi");
}

// ---- Generic delete ----

export async function deleteRow(table: EntityTable, id: string): Promise<Result<void>> {
  const supabase = createClient();
  const res = await supabase.from(table).delete().eq("id", id);
  return mapVoid(res, "O'chirib bo'lmadi");
}

// ---- Duplicate detection (scoped to the operator) ----

export async function findDuplicateByPhone(
  operatorId: string,
  phone: string,
  excludeId?: string
): Promise<Result<DuplicateMatch | null>> {
  const supabase = createClient();

  const leadRes = await supabase
    .from("leads")
    .select("name")
    .eq("phone", phone)
    .eq(SCOPE_COLUMN, operatorId)
    .neq("id", excludeId ?? NO_EXCLUDE_ID)
    .limit(1);
  if (leadRes.error) return err(`Dublikatni tekshirib bo'lmadi: ${leadRes.error.message}`);
  const leads = (leadRes.data as { name: string }[] | null) ?? [];
  if (leads.length > 0) return ok({ name: leads[0].name, type: "lid" });

  const clientRes = await supabase
    .from("clients")
    .select("name")
    .eq("phone", phone)
    .eq(SCOPE_COLUMN, operatorId)
    .limit(1);
  if (clientRes.error)
    return err(`Dublikatni tekshirib bo'lmadi: ${clientRes.error.message}`);
  const clients = (clientRes.data as { name: string }[] | null) ?? [];
  if (clients.length > 0) return ok({ name: clients[0].name, type: "mijoz" });

  return ok(null);
}
