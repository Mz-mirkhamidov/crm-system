import { createClient } from "@/lib/supabase/server";
import type { Operator } from "@/lib/session";

/**
 * Resolve the current request's identity from the Supabase Auth session, then enrich it
 * with the profile row in `operators` (the app's profile table, whose id === auth user id).
 * Returns null when there is no valid session. Server-only.
 */
export async function getServerOperator(): Promise<Operator | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("operators")
    .select("id, name, phone, role")
    .eq("id", user.id)
    .single();

  if (profile) {
    return {
      id: profile.id,
      name: profile.name ?? "",
      phone: profile.phone ?? "",
      role: (profile.role as "admin" | "operator") ?? "operator",
    };
  }

  // Fallback to auth metadata if the profile row is missing for any reason.
  return {
    id: user.id,
    name: (user.user_metadata?.name as string) ?? "",
    phone: (user.user_metadata?.phone as string) ?? "",
    role: (user.app_metadata?.role as "admin" | "operator") ?? "operator",
  };
}
