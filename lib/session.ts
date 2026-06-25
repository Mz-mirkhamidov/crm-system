// Identity type shared across the app.
//
// Authentication is now handled by Supabase Auth (see lib/supabase/*, app/api/auth/*).
// The previous custom HMAC-signed cookie scheme has been removed; this module only keeps
// the `Operator` shape that UI components and the `/api/auth/me` endpoint exchange.

export interface Operator {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "operator";
}
