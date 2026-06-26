import { createClient } from "@/lib/supabase/server";
import type { Operator } from "@/lib/session";

/**
 * Resolve the current request's identity from the Supabase Auth session, enriched with the
 * profile row in `operators` (id === auth user id). Returns null when there is no session.
 * Server-only.
 */
export async function getServerOperator(): Promise<Operator | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("operators")
    .select("id, name, phone, role, must_change_password")
    .eq("id", user.id)
    .single();

  if (profile) {
    return {
      id: profile.id,
      name: profile.name ?? "",
      phone: profile.phone ?? "",
      role: (profile.role as "admin" | "operator") ?? "operator",
      mustChangePassword: profile.must_change_password ?? false,
    };
  }

  return {
    id: user.id,
    name: (user.user_metadata?.name as string) ?? "",
    phone: (user.user_metadata?.phone as string) ?? "",
    role: (user.app_metadata?.role as "admin" | "operator") ?? "operator",
    mustChangePassword: false,
  };
}
