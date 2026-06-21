// Vitest global setup for the auth-session-security-fix spec.
//
// Establishes a deterministic test SESSION_SECRET in the environment before any
// test module loads. Production reads the signing secret from
// `process.env.SESSION_SECRET`; tests sign payloads with this same secret so the
// "valid session" branch is exercised exactly as production would.
import { TEST_SESSION_SECRET } from "./helpers/session-helper";

process.env.SESSION_SECRET = TEST_SESSION_SECRET;
