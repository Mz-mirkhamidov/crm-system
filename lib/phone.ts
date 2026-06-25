// Phone-number normalization + the synthetic-email mapping used by the auth layer.
//
// The app authenticates users by PHONE + password, but under the hood Supabase Auth
// stores each user as an email/password account. We never show this email to the user;
// it is a deterministic, collision-free function of the normalized phone number so that
// the same phone always maps to the same Supabase account. This lets us use Supabase's
// battle-tested email/password auth without needing an SMS provider.
//
// IMPORTANT: `normalizePhone` here MUST stay in sync with the SQL used in migration
// 009 (the existing operators were backfilled with emails computed the same way):
//   digits = phone with all non-digits removed
//   if digits has length 9 -> prepend "998"  (Uzbek national number -> full E.164 digits)
//   email  = "u" + digits + "@sellora.app"

/** Domain used for the internal synthetic email. Never shown to users. */
export const AUTH_EMAIL_DOMAIN = "sellora.app";

/** Strip a phone string to digits and canonicalize Uzbek national numbers to full form. */
export function normalizePhone(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 9) return `998${digits}`;
  return digits;
}

/** Deterministic, hidden Supabase login email derived from a phone number. */
export function phoneToEmail(phone: string): string {
  return `u${normalizePhone(phone)}@${AUTH_EMAIL_DOMAIN}`;
}

/** Pretty-print a normalized Uzbek number as +998 90 123 45 67 for display. */
export function formatPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length === 12 && d.startsWith("998")) {
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  }
  return phone;
}

/** Basic validity check for an Uzbek phone number (12 digits, 998 prefix). */
export function isValidPhone(input: string): boolean {
  const d = normalizePhone(input);
  return d.length === 12 && d.startsWith("998");
}
