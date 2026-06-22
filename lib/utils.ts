import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isPast, parseISO } from "date-fns";
import { uz } from "date-fns/locale";
import type { Lead, Order } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd.MM.yyyy HH:mm");
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "dd.MM.yyyy");
}

export function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), "HH:mm");
}

export function isOverdue(dateStr: string): boolean {
  return isPast(parseISO(dateStr));
}

export function isTodayDate(dateStr: string): boolean {
  return isToday(parseISO(dateStr));
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Yangi":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Ko'rib chiqilmoqda":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Kelishildi":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Rad etildi":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "Buyurtma berilgan":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

export function getProductColor(product: string): string {
  switch (product) {
    case "AJR Sedan":
      return "bg-violet-500/20 text-violet-400";
    case "AJR MEN":
      return "bg-blue-500/20 text-blue-400";
    case "AJR Women":
      return "bg-pink-500/20 text-pink-400";
    case "AJR Kids":
      return "bg-orange-500/20 text-orange-400";
    case "Estet":
      return "bg-emerald-500/20 text-emerald-400";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

// 9 xonalik format (MicroSIP uchun: +998901234567 → 901234567)
export function formatPhoneForCall(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}


// ---- Pure render/aggregate helpers (frontend-ux-improvements design §4) ----
//
// Extracted from the inline table logic so they can be reused across the four entity
// tables and unit/property-tested in isolation. All helpers are pure and fully typed.

const MS_PER_DAY = 86_400_000;

/** Lead statuses that take a lead out of the "cold/aging" pipeline. */
const CLOSED_LEAD_STATUSES: ReadonlyArray<Lead["status"]> = [
  "Buyurtma berilgan",
  "Rad etildi",
];

export interface LeadFilterCriteria {
  /** Free-text search over name and phone. Empty string disables the filter. */
  search: string;
  /** Exact status match, or "all" to disable. */
  status: string;
  /** Exact tag match, or "all" to disable. */
  tag: string;
  /** Minimum age in days for the "cold lead" filter, or "all" to disable. */
  age: string;
}

/**
 * Filter leads by search text, status, tag, and age — mirroring the original
 * `LeadsTable` effect exactly (search matches name/phone; the age filter keeps only
 * non-closed leads at least N days old).
 */
export function applyFilters(leads: Lead[], criteria: LeadFilterCriteria): Lead[] {
  let result = leads;

  if (criteria.search) {
    const q = criteria.search.toLowerCase();
    result = result.filter(
      (l) => l.name.toLowerCase().includes(q) || l.phone.toLowerCase().includes(q)
    );
  }

  if (criteria.status !== "all") {
    result = result.filter((l) => l.status === criteria.status);
  }

  if (criteria.tag !== "all") {
    result = result.filter((l) => l.tag === criteria.tag);
  }

  if (criteria.age !== "all") {
    const days = parseInt(criteria.age, 10);
    result = result.filter((l) => {
      const age = Math.floor((Date.now() - new Date(l.created_at).getTime()) / MS_PER_DAY);
      const notClosed = !CLOSED_LEAD_STATUSES.includes(l.status);
      return age >= days && notClosed;
    });
  }

  return result;
}

export interface LeadAge {
  days: number;
  label: string;
  color: string;
}

/** Compute a lead's age bucket (days + display label + Tailwind color classes). */
export function getLeadAge(createdAt: string): LeadAge {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / MS_PER_DAY);
  if (days === 0)
    return { days, label: "Bugun", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  if (days === 1)
    return { days, label: "Kecha", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  if (days <= 4)
    return { days, label: `${days}k`, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
  if (days <= 9)
    return { days, label: `${days}k`, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" };
  return { days, label: `${days}k`, color: "text-red-400 bg-red-500/10 border-red-500/30" };
}

/** Initials (up to two uppercase letters) derived from a person's name. */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Sum of order prices, coercing each price to a number. */
export function getOrderTotal(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + Number(o.price), 0);
}

/** Stable, unique React key for a list row, derived from its id (design Property 7). */
export function getRowKey(row: { id: string }): string {
  return row.id;
}
