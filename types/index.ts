export type LeadStatus =
  | "Yangi"
  | "Ko'rib chiqilmoqda"
  | "Kelishildi"
  | "Rad etildi"
  | "Buyurtma berilgan"
  | "Mijozga aylandi";

export type OrderType = "Hozirgi" | "Keyinroqi";
export type SourceType = "lead" | "client";
export type FollowUpStatus = "Kutilmoqda" | "Bajarildi";
export type ProductType =
  | "AJR Sedan"
  | "AJR MEN"
  | "AJR Women"
  | "AJR Kids"
  | "Estet";

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address: string | null;
  tag: string | null;
  status: LeadStatus;
  comment: string | null;
  converted_client_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address: string | null;
  tag: string | null;
  comment: string | null; // legacy, kept for backward-compat
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  source_type: SourceType;
  source_id: string;
  body: string;
  /** 'note' (default) or 'status' (auto-logged status change). */
  kind?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  source_type: SourceType;
  source_id: string;
  source_name: string;
  product: ProductType;
  price: number;
  order_type: OrderType;
  scheduled_at: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  user_id: string;
  source_type: SourceType;
  source_id: string;
  source_name: string;
  source_phone: string;
  scheduled_at: string;
  note: string | null;
  status: FollowUpStatus;
  created_at: string;
  updated_at: string;
}

export const PRODUCTS: ProductType[] = [
  "AJR Sedan",
  "AJR MEN",
  "AJR Women",
  "AJR Kids",
  "Estet",
];

export const DEFAULT_TAGS = ["Sayt", "Excel", "Estet", "Primoy"];

export const LEAD_STATUSES: LeadStatus[] = [
  "Yangi",
  "Ko'rib chiqilmoqda",
  "Kelishildi",
  "Rad etildi",
  "Buyurtma berilgan",
];
