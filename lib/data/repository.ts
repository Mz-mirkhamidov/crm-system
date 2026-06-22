// Typed query builders over the browser Supabase client (frontend-ux-improvements
// design §3, Requirements 3.3, 4.1, 4.4, 5.1, 5.2). This is the SINGLE place the operator
// scoping column is applied to reads, and the SINGLE place Supabase `{ data, error }`
// responses are mapped into `Result<T>`. UI components must never call `supabase.from`
// directly once migrated.

import { createClient } from "@/lib/supabase/client";
import type {
  Lead,
  Client,
  Note,
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
  tag: string | null;
  comment: string | null;
}

export interface NoteInput {
  source_type: SourceType;
  source_id: string;
  body: string;
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

// ---- Notes reads/writes (every read applies .eq(SCOPE_COLUMN, operatorId)) ----

export async function listNotesForSource(
  operatorId: string,
  sourceId: string,
  sourceType: SourceType
): Promise<Result<Note[]>> {
  const supabase = createClient();
  const res = await supabase
    .from("notes")
    .select("*")
    .eq(SCOPE_COLUMN, operatorId)
    .eq("source_id", sourceId)
    .eq("source_type", sourceType)
    .order("created_at", { ascending: false });
  return mapMany<Note>(res, "Eslatmalarni yuklab bo'lmadi");
}

export async function addNote(
  operatorId: string,
  input: NoteInput
): Promise<Result<Note>> {
  const supabase = createClient();
  const res = await supabase
    .from("notes")
    .insert({ [SCOPE_COLUMN]: operatorId, operator_id: operatorId, ...input })
    .select()
    .single();
  return mapSingle<Note>(res, "Eslatmani saqlab bo'lmadi");
}

export async function updateNote(id: string, body: string): Promise<Result<Note>> {
  const supabase = createClient();
  const res = await supabase
    .from("notes")
    .update({ body })
    .eq("id", id)
    .select()
    .single();
  return mapSingle<Note>(res, "Eslatmani yangilab bo'lmadi");
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

/**
 * Touch a client's `last_contacted_at` timestamp. Defaults to now. Best-effort helper
 * used after a note/order/follow-up interaction is recorded for the client.
 */
export async function touchClientLastContacted(
  id: string,
  whenISO?: string
): Promise<Result<Client>> {
  const supabase = createClient();
  const res = await supabase
    .from("clients")
    .update({ last_contacted_at: whenISO ?? new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return mapSingle<Client>(res, "Mijozni yangilab bo'lmadi");
}

/**
 * Convert a lead into a client, operator-scoped (Requirements 3.1–3.5, 3.8).
 *
 * Idempotent: if the lead is already converted (`converted_client_id` set), the existing
 * client is returned without creating a second client or duplicating notes. On client
 * insert failure the error is returned and NO notes re-point / lead update is performed.
 * After a successful insert the lead's notes timeline is re-pointed to the client, then
 * the lead is marked `'Mijozga aylandi'` and linked via `converted_client_id`.
 */
export async function convertLeadToClient(
  operatorId: string,
  lead: Lead
): Promise<Result<Client>> {
  const supabase = createClient();

  // Idempotent guard: already converted → return the existing client, no new inserts.
  if (lead.converted_client_id) {
    const existing = await supabase
      .from("clients")
      .select("*")
      .eq(SCOPE_COLUMN, operatorId)
      .eq("id", lead.converted_client_id)
      .single();
    return mapSingle<Client>(existing, "Mijozni yuklab bo'lmadi");
  }

  // 1. Create the client from the lead's fields, scoped to the operator.
  const insertRes = await supabase
    .from("clients")
    .insert({
      [SCOPE_COLUMN]: operatorId,
      operator_id: operatorId,
      name: lead.name,
      phone: lead.phone,
      address: lead.address,
      tag: lead.tag,
      comment: lead.comment,
      last_contacted_at: new Date().toISOString(),
    })
    .select()
    .single();
  const clientResult = mapSingle<Client>(insertRes, "Mijozni saqlab bo'lmadi");
  // On insert failure: return the error and perform NO notes/lead mutation.
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;

  // 2. Re-point the lead's entire notes timeline to the new client (no copy/loss).
  await supabase
    .from("notes")
    .update({ source_type: "client", source_id: client.id })
    .eq(SCOPE_COLUMN, operatorId)
    .eq("source_type", "lead")
    .eq("source_id", lead.id);

  // 3. Mark the lead converted and link it to the client (kept as historical record).
  await supabase
    .from("leads")
    .update({ status: "Mijozga aylandi", converted_client_id: client.id })
    .eq("id", lead.id);

  return ok(client);
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
