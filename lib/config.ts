// Environment-sourced configuration (Task 5.4).
//
// Replaces the hardcoded constants previously in `lib/auth.ts`. The owner identifier is
// read from the environment instead of being baked into source. Because some legacy
// client components reference it, the public `NEXT_PUBLIC_OWNER_ID` is preferred for
// client usage, falling back to the server-only `OWNER_ID`.
//
// NOTE: The signing secret (`SESSION_SECRET`) is intentionally NOT exported here — it is
// read directly in `lib/session.ts` on the server and must never reach the browser.
export const OWNER_ID: string =
  process.env.NEXT_PUBLIC_OWNER_ID ?? process.env.OWNER_ID ?? "";
