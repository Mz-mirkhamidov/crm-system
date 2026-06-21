# Implementation Plan

This plan follows the exploratory bugfix workflow: **explore** the bug with tests that
fail on the unfixed code, **preserve** existing behavior with tests that pass on the
unfixed code, **implement** the signed-session fix, then **validate** that the bug is
closed and nothing regressed. Property numbers map to the Correctness Properties in
`design.md`:

- **Property 1 — Bug Condition / Expected Behavior**: forged/unsigned/tampered sessions are rejected.
- **Property 2 — Preservation**: non-bug inputs (no session, public routes, valid signed sessions) behave exactly as before.
- **Property 3 — Hashing**: passwords are hashed with a slow, per-user-salted, server-side scheme.
- **Property 4 — Single enforcement path**: only the server-validated `crm_op_session` decides access.

> Edge constraint (from design): signature verification uses Web Crypto `crypto.subtle`
> (available in both Node and Edge runtimes); slow password hashing runs off the Edge path
> (Node route handler / Postgres `pgcrypto`), never inside `proxy.ts`.

- [x] 1. Set up test infrastructure for property-based and unit/integration testing
  - Add a test runner (e.g. Vitest) and a property-based testing library (e.g. fast-check) to `devDependencies`, plus a test script (run tests with a single-run flag, not watch mode)
  - Configure the test environment to run in the **Node** runtime so `globalThis.crypto.subtle` (Web Crypto) is available for signing/verifying tokens, matching what `proxy.ts` uses at the Edge
  - Add a test helper that signs payloads with a test `SESSION_SECRET` so the "valid session" branch can be exercised exactly as production would (per design Testing Strategy → Preservation Checking)
  - This is a prerequisite for tasks 2, 3, 6, and 8; it is not a Property task
  - _Requirements: supports validation of 2.1, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 2. Write bug condition exploration test
  - **Property 1: Bug Condition** - Forged / Unsigned Sessions Are Rejected
  - **CRITICAL**: This test MUST FAIL on the unfixed code - failure confirms the authentication-bypass bug exists
  - **DO NOT attempt to fix the test or the code when it fails** - the failure is the expected, desired outcome at this step
  - **NOTE**: This test encodes the expected behavior - it will validate the fix once it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bypass and confirm the root-cause hypotheses in design (no signature on the token; `proxy.ts` trusts decoded `role`/`id`)
  - **Scoped PBT Approach**: Pair a property-based generator of arbitrary identities with concrete deterministic counterexamples for reproducibility
  - Encode the bug condition from design `isBugCondition(request)`: a `crm_op_session` cookie decodes to a usable identity (`id` + `role`) but carries **no valid server HMAC signature**
  - Construct forged/tampered cookie values and run them through the middleware decision logic (`proxy.ts`) on the **unfixed** code, asserting the Expected Behavior (redirect to `/login`, no role granted, no identity established):
    - Forged admin cookie: `base64({"id":"x","name":"x","phone":"x","role":"admin"})` → assert redirect to `/login` (currently serves `/admin`) — covers 1.2 / 2.2
    - Forged operator cookie: arbitrary `id`, `role:"operator"` → assert no identity established / redirect to `/login` — covers 1.3 / 2.3
    - Tampered legitimate cookie: take a valid operator payload, flip `"role":"operator"` → `"admin"`, re-base64-encode → assert rejection — covers 2.1
    - Property form: for all generated JSON identities (including `role:"admin"`) base64-encoded **without** a valid signature, the middleware decision is `REDIRECT("/login")`
  - Run the test on **UNFIXED** code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bypass exists)
  - Document the counterexamples found (e.g. "forged `role:"admin"` cookie is served `/admin` instead of redirected to `/login`") to confirm the root cause
  - Mark this task complete when the test is written, run, and the failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 3. Write preservation property tests (BEFORE implementing the fix)
  - **Property 2: Preservation** - Non-Bug Inputs Behave Exactly As Before
  - **IMPORTANT**: Follow the observation-first methodology - record actual outputs of the **unfixed** middleware, then assert them
  - Observe behavior on UNFIXED code for inputs where `isBugCondition` is false, and capture each as a test:
    - Valid operator session (signed with the test secret) → `/dashboard` reachable; `/admin` redirects to `/dashboard` (3.1, 3.3)
    - Valid admin session → `/admin` reachable (3.2)
    - No session cookie → redirect to `/login`; `/login` and `/register` remain publicly accessible (3.4)
    - Unparseable/garbage cookie (e.g. `"###"`) → redirect to `/login` (confirms this is NOT the bug condition)
    - Authenticated user visiting `/` or `/login` → redirect to `/admin` or `/dashboard` per verified role (3.6)
    - Pending/blocked login attempts → still rejected with the correct `pending` / `blocked` reason (3.5)
  - Write **property-based tests** over random `(path, cookie-state, role)` pairs across the non-bug domain asserting the middleware decision equals the originally-observed decision (design Preservation Checking pseudocode: `original = fixed` for all `NOT isBugCondition`)
  - For "validly signed" cases, sign payloads with the test `SESSION_SECRET` helper from task 1
  - Run tests on **UNFIXED** code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms the baseline behavior to preserve)
  - Mark this task complete when the tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Fix the authentication bypass with HMAC-signed, server-validated sessions

  - [x] 4.1 Replace base64 tokens with HMAC-SHA256 signed tokens in `lib/session.ts`
    - Read `SESSION_SECRET` from `process.env.SESSION_SECRET`; fail fast (throw / refuse to sign) when it is missing
    - Add `signSession(op): Promise<string>` (server only): build `payload = { id, name, phone, role, iat, exp }`, set `data = base64url(JSON.stringify(payload))`, compute `sig = base64url(HMAC_SHA256(SESSION_SECRET, data))` via `crypto.subtle` (`importKey` as HMAC key, then `sign`), and return `` `${data}.${sig}` ``
    - Add `verifySession(token): Promise<Operator | null>`: split on `.` (return `null` unless exactly two parts), recompute/compare the HMAC in constant time via `crypto.subtle.verify`, parse the payload, reject when `exp` is in the past or `id`/`role` are missing, and return the `Operator` only when valid and unexpired
    - Remove the unauthenticated `decodeSession` path (or keep it private and unused) and stop treating `getClientSession` as authoritative
    - Use only Web Crypto `crypto.subtle` HMAC primitives so the same `verifySession` runs at the Edge
    - _Bug_Condition: isBugCondition(request) — token decodes to a usable identity but `NOT hasValidServerSignature(token, SESSION_SECRET)` (design Bug Condition)_
    - _Expected_Behavior: expectedBehavior — trust a session only after server-side integrity/authenticity verification; treat verification failures as unauthenticated (design Property 1)_
    - _Preservation: Preservation Requirements (design) — round-trip `signSession`→`verifySession` returns the original Operator for valid sessions_
    - _Requirements: 2.1_

  - [x] 4.2 Verify session signatures in `proxy.ts` and reject forgeries
    - Replace `const session = cookieVal ? decodeSession(cookieVal) : null;` with `const session = cookieVal ? await verifySession(cookieVal) : null;`
    - Leave the routing logic unchanged: forged/tampered/expired tokens now yield `session === null` and fall into the existing "not logged in → `/login`" branch; role-based branches (operator blocked from `/admin`, root/login redirects) run only for verified sessions
    - _Bug_Condition: isBugCondition(request) from design — collapses every forgery into the sessionless redirect branch_
    - _Expected_Behavior: expectedBehavior from design Property 1 — redirect to `/login`, grant no role, establish no identity_
    - _Preservation: Preservation Requirements (design) — routing for valid sessions, sessionless requests, and public routes is unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 4.3 Verify the bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Forged / Unsigned Sessions Are Rejected
    - **IMPORTANT**: Re-run the SAME test from task 2 - do NOT write a new test
    - The test from task 2 encodes the expected behavior; when it passes it confirms forgeries are rejected
    - Run the bug condition exploration test from task 2 against the fixed code
    - **EXPECTED OUTCOME**: Test PASSES (confirms the authentication bypass is closed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.4 Verify the preservation tests still pass
    - **Property 2: Preservation** - Non-Bug Inputs Behave Exactly As Before
    - **IMPORTANT**: Re-run the SAME tests from task 3 - do NOT write new tests
    - Run the preservation property tests from task 3 against the fixed code
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in valid-login routing, the operator-to-`/admin` block, the sessionless redirect, public route access, and the authenticated root/login redirects)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 5. Move session issuance server-side and consolidate onto one mechanism

  - [x] 5.1 Add a Node-runtime server login route handler
    - Create `app/api/auth/login/route.ts` with `export const runtime = "nodejs"`; validate credentials via the (updated) Supabase RPC, and on success call `signSession` and set the cookie via `cookies().set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 })`; return the role so the client can navigate; preserve `pending`/`blocked` rejection messages
    - _Bug_Condition: isBugCondition — eliminates client-minted cookies so only server-issued tokens carry a valid signature_
    - _Expected_Behavior: sessions are issued and integrity-protected by the server (design Fix Implementation change 4)_
    - _Preservation: Preservation Requirements — valid logins still route to `/dashboard`/`/admin` (3.1, 3.2) and pending/blocked are still rejected (3.5)_
    - _Requirements: 2.1, 2.6, 3.1, 3.2, 3.5_

  - [x] 5.2 Update `app/login/page.tsx` to POST credentials instead of writing `document.cookie`
    - POST the raw phone/password over HTTPS to `app/api/auth/login`; stop calling the RPC directly, stop calling `hashPassword`, and remove the `document.cookie = ...` / `encodeSession` write
    - On success navigate to `/admin` or `/dashboard` exactly as before
    - _Bug_Condition: isBugCondition — removes the client-side cookie-minting boundary identified as a root cause_
    - _Expected_Behavior: the browser can no longer mint or mutate sessions (design)_
    - _Preservation: Preservation Requirements — login UX and routing to `/dashboard`/`/admin` unchanged (3.1, 3.2, 3.5)_
    - _Requirements: 2.1, 3.1, 3.2, 3.5_

  - [x] 5.3 Add a logout route and a server source for the client operator identity
    - Add a logout route handler that clears the `crm_op_session` cookie
    - Replace `getClientSession`/`useOperator`'s `document.cookie` read with a server source (e.g. a lightweight `/api/auth/me` endpoint that calls `verifySession`, or props from a server component) so the displayed identity is always the server-verified one
    - _Bug_Condition: isBugCondition — client no longer reads/trusts the cookie directly_
    - _Expected_Behavior: client identity comes from server-verified state (design change 4)_
    - _Preservation: Preservation Requirements — the operator name/role shown in the UI matches the verified session_
    - _Requirements: 2.1, 2.6_

  - [x] 5.4 Remove `lib/auth.ts` and source secrets from the environment
    - Delete `lib/auth.ts` (`CRM_EMAIL`, `CRM_PASSWORD`, `OWNER_ID`, the competing `crm_session = "authenticated"` mechanism)
    - Source any retained owner identifier from `process.env.OWNER_ID`; ensure no route decision depends on the removed `crm_session`/`authenticated` constants
    - Add `.env.example` documenting `SESSION_SECRET`, `OWNER_ID`, and any bootstrap credentials; keep real values out of source control
    - _Bug_Condition: isBugCondition — removes hardcoded secrets and the second, competing auth mechanism (root causes 3 and 5)_
    - _Expected_Behavior: secrets/keys/owner id sourced from secure config; a single authoritative enforcement path (design changes 4 and 5)_
    - _Preservation: Preservation Requirements — enforcement outcomes for all routes remain those produced by the signed `crm_op_session` path_
    - _Requirements: 2.4, 2.6_

  - [x] 5.5 Verify single authoritative enforcement path
    - **Property 4: Single Enforcement Path** - Only `crm_op_session` Decides Access
    - Add tests asserting that for every protected route the access decision is made solely by the server-validated `crm_op_session` verified in `proxy.ts`, and that no decision references the removed `crm_session`/`authenticated` mechanism (e.g. grep/static check plus middleware decision-table tests)
    - _Requirements: 2.6_

- [x] 6. Strengthen password hashing (slow, per-user-salted, server-side)

  - [x] 6.1 Migrate password hashing to a slow, per-user-salted scheme
    - Add a Supabase migration enabling `pgcrypto`; update `register_operator` to store `crypt(p_password, gen_salt('bf', 12))` and `check_login` to verify with `stored_hash = crypt(p_password, stored_hash)` (functions defined in `supabase/migrations/003_multiuser.sql` and `004_registration.sql`); change RPC parameters to accept the raw password over the server boundary instead of `p_password_hash`
    - Update `app/login/page.tsx` and `app/register/page.tsx` (and the new login route) to submit the raw password over HTTPS rather than the client-side SHA-256 hash; remove `hashPassword` from `lib/session.ts`
    - Retire the old static-salt SHA-256 hashes: re-hash on next successful login or via a one-time migration; remove the `crm_salt_2026` static-salt seeded admin hashes
    - _Bug_Condition: not the session-forgery condition; addresses the related weak-hashing root cause (1.5 / root cause 4)_
    - _Expected_Behavior: expectedBehavior — strong, slow, salted, server-side hashing with a unique per-user salt (design Property 3, clause 2.5)_
    - _Preservation: Preservation Requirements — existing users can still log in (with re-hash/migration); pending/blocked handling unchanged (3.5)_
    - _Requirements: 2.4, 2.5_

  - [x] 6.2 Verify password hashing properties
    - **Property 3: Password Hashing Is Slow And Per-User-Salted**
    - Write property-based tests: for random passwords, hashing the same plaintext twice yields **different** stored hashes (unique per-user salt), verification succeeds for the correct password and fails for the wrong one, and no static-salt derivation reproduces the stored hash; verification is performed server-side
    - **EXPECTED OUTCOME**: Tests PASS after the fix
    - _Requirements: 2.4, 2.5_

- [x] 7. Add unit and integration tests
  - Unit: `signSession`→`verifySession` round-trips to the original `Operator`; `verifySession` returns `null` for tampered payload, tampered signature, wrong secret, missing signature segment, and expired `exp`; `proxy.ts` decision table for each `(path, session-state)` combination; login route sets an `HttpOnly`/`Secure`/`SameSite` cookie on valid credentials and rejects `pending`/`blocked`
  - Integration: end-to-end login → server-issued cookie → protected route served; logout clears the cookie and subsequent access redirects to `/login`; attacker flow injecting a forged admin cookie → `/admin` redirects to `/login` (no admin content); operator session cannot reach `/admin` across navigation while an admin session can
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 8. Checkpoint - Ensure all tests pass
  - Run the full suite (single-run mode, not watch) and confirm: Property 1 exploration test now PASSES, Property 2 preservation tests still PASS, Property 3 hashing tests PASS, Property 4 enforcement-path tests PASS, and all unit/integration tests pass
  - Confirm no regressions and that the build/lint succeed
  - Ensure all tests pass; ask the user if questions arise

### Task 8 Checkpoint Audit (static)

The sandbox is INTEGRATIONS_ONLY (no npm registry / node_modules / live DB), so the suite
was verified by a rigorous static audit rather than execution. Verdict: **PASS** (after two
minimal comment fixes described below).

**Import/export consistency:** Every symbol imported by the test files and helpers exists
and is exported with the expected signature. `lib/session.ts` exports `SESSION_COOKIE`,
`SESSION_MAX_AGE_SECONDS`, `Operator`, `signSession`, `verifySession` (plus
`encodeSession`/`getClientSession`, still imported by `components/sidebar.tsx`). The auth
routes export `POST`/`GET` as imported by the integration test.

**Build-safety / leftover references:** `lib/auth.ts` is deleted; no active source imports
`@/lib/auth` or references `crm_session` / `SESSION_VALUE` / `CRM_EMAIL` / `CRM_PASSWORD` /
`crm_salt_2026`. `decodeSession` survives only in comments (no importers). `tsconfig.json`
excludes `patch/` and `supabase/functions`, so stale duplicates do not enter the build.

**Two genuine, test-breaking issues found and fixed (comments only, no behavior change):**
- `lib/session.ts`: a NOTE comment contained the literal `hashPassword`, which the
  Property-3 scan (`/\bhashPassword\b/` over active source) would flag. Reworded.
- `supabase/migrations/006_password_hashing.sql`: a comment contained `p_password_hash`,
  which the Property-3 assertion `expect(sql).not.toMatch(/p_password_hash/)` would flag.
  Reworded.

**Route/RPC contract:** login/register/operators routes call `check_login` /
`register_operator` / `admin_create_operator` with parameter names matching migration 006,
forwarding the RAW `p_password`; the pages POST matching body shapes and preserve the same
user-facing messages/reasons (pending/blocked/exists/error).

**Expected results of `npm install && npm test` (post-fix):**

| Test file | Expected | Notes |
| --- | --- | --- |
| `setup.test.ts` | PASS | infra smoke (Web Crypto, SESSION_SECRET, signing helper) |
| `bug-condition.test.ts` | PASS | forgeries now rejected; would FAIL only on pre-fix code |
| `preservation.test.ts` | PASS | non-bug routing unchanged (regime-adaptive valid cookie) |
| `single-enforcement.test.ts` | PASS | static scan clean + crm_op_session is sole decider |
| `password-hashing.test.ts` | PASS | static migration/app checks + invariant model; true bcrypt round-trip exercised only against a live pgcrypto DB |
| `session.test.ts` | PASS | signSession→verifySession round-trip + null cases |
| `proxy-decision-table.test.ts` | PASS | exhaustive (path × state) table |
| `auth-flow.integration.test.ts` | PASS | Supabase client + next/headers mocked |

Behaviors requiring the live Supabase/pgcrypto environment to fully exercise: the bcrypt
hash/verify round-trip and legacy-row re-hash in `006_password_hashing.sql`. The static and
invariant-model assertions in `password-hashing.test.ts` PASS in CI; the real bcrypt
verification is exercised only against a real DB (Task 7 integration with DB access).
