// Identity type shared across the app.
//
// Authentication is handled by Supabase Auth (see lib/supabase/*, app/api/auth/*).
// The `Operator` shape is exchanged by UI components and the `/api/auth/me` endpoint.

export interface Operator {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "operator";
  /** True when the user must set a new password before using the app (e.g. migrated users). */
  mustChangePassword?: boolean;
}
