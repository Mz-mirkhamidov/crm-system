# Auth Session Security Fix — Bugfix Design

## Overview

Sellora Plus CRM currently authenticates users with a `crm_op_session` cookie whose
value is the **base64 encoding of the operator object** (`{ id, name, phone, role }`).
The cookie is neither signed nor encrypted, it is written **client-side** from the
browser (`document.cookie = ...` in `app/login/page.tsx`), and the Edge middleware
(`proxy.ts`) trusts the decoded `role` and `id` verbatim. Any visitor can hand-craft a
cookie claiming `role: "admin"` (or any operator `id`) and obtain unauthenticated,
privileged access — an **authentication bypass / privilege escalation** defect.

The fix makes session state **tamper-proof and server-validated** instead of trusting
client-supplied bytes. The strategy is:

1. **Sign sessions server-side.** Replace the plain base64 token with an HMAC-SHA256
   signed token (`payload.signature`) created with a server-held secret. The middleware
   verifies the signature before trusting any field. Forged or tampered tokens fail
   verification and are treated as *unauthenticated*.
2. **Issue sessions from the server**, not the browser. A server route handler validates
   credentials, signs the token, and sets an `HttpOnly`, `Secure`, `SameSite` cookie. The
   browser can no longer mint or silently mutate sessions.
3. **Remove hardcoded secrets.** The signing secret, login credentials, and the owner
   identifier move to environment configuration. The legacy `lib/auth.ts` mechanism is
   deleted.
4. **Strengthen password hashing.** Replace the fast, single-static-salt client-side
   SHA-256 with a slow, per-user-salted server-side scheme (bcrypt/scrypt/Argon2 via
   Supabase `pgcrypto`).
5. **Consolidate onto one authoritative path.** All route protection flows through the
   single signed `crm_op_session` mechanism verified in `proxy.ts`; the competing
   `crm_session = "authenticated"` mechanism is removed.

**Edge runtime constraint (Next.js 16 App Router):** `proxy.ts` runs in the Edge
runtime, which exposes the **Web Crypto API** (`crypto.subtle`) — sufficient for
HMAC-SHA256 signing/verification — but does **not** support Node-only native modules
such as `bcrypt`/`argon2`. Therefore signature verification happens in the Edge
middleware, while slow password hashing happens off the Edge path (in a Node-runtime
route handler or in Postgres via `pgcrypto`), never inside the middleware.

## Glossary

- **Bug_Condition (C)**: A request presents a `crm_op_session` cookie that was **not**
  issued and integrity-protected by the server (no valid server signature), yet the
  system trusts its decoded `role`/`id` as an authenticated identity.
- **Property (P)**: The desired behavior — a session is trusted **only** after its
  integrity and authenticity are verified server-side; sessions that fail verification
  are treated as unauthenticated.
- **Preservation**: Legitimate login/routing/enforcement behavior (clauses 3.1–3.6) that
  must remain unchanged: valid logins still route to `/dashboard` or `/admin`, operators
  are still blocked from `/admin`, sessionless requests still redirect to `/login`, etc.
- **Signed session token**: A string of the form `base64url(payload).base64url(signature)`
  where `signature = HMAC-SHA256(SESSION_SECRET, base64url(payload))` and `payload`
  carries `{ id, name, phone, role, iat, exp }`.
- **SESSION_SECRET**: A high-entropy secret held only on the server (environment variable),
  used to sign and verify session tokens. Never shipped to the browser.
- **`decodeSession` (current)**: The function in `lib/session.ts` that base64-decodes the
  cookie into an `Operator` with **no** integrity check — the core defect.
- **`verifySession` (new)**: The replacement that parses the token, recomputes the HMAC,
  compares it in constant time, checks expiry, and returns an `Operator` **only** when the
  signature is valid.
- **`proxy.ts`**: The Edge middleware that guards every non-asset route.
- **Operator**: `{ id, name, phone, role: "admin" | "operator" }` — the authenticated
  identity carried by the session.

## Bug Details

### Bug Condition

The bug manifests when a request presents a `crm_op_session` cookie whose base64 payload
decodes to JSON containing an `id` and `role`, and the system trusts that decoded
identity **without** verifying any server-issued cryptographic signature. The
`decodeSession` function performs only base64 decoding and a presence check on `id`/`role`,
so a hand-crafted (forged or tampered) cookie is indistinguishable from a legitimate one,
and `proxy.ts` routes the request based on the attacker-controlled `role`.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request carrying cookie crm_op_session = token (string) or absent
  OUTPUT: boolean

  token := request.cookies[SESSION_COOKIE]
  IF token IS NULL THEN
    RETURN false                      // no session: not the bug, handled by login redirect
  END IF

  decoded := tryParseBase64Json(token)
  IF decoded IS NULL
     OR decoded.id IS NULL
     OR decoded.role IS NULL THEN
    RETURN false                      // unparseable: not the bug, treated as no session
  END IF

  // The bug: the token carries a usable identity but was NOT produced by the server,
  // i.e. it has no valid HMAC signature over SESSION_SECRET — yet the system trusts it.
  RETURN NOT hasValidServerSignature(token, SESSION_SECRET)
         AND systemTrustsIdentity(decoded.role, decoded.id)
END FUNCTION
```

### Examples

- **Admin forgery (1.2):** Attacker sets
  `crm_op_session = base64({"id":"x","name":"x","phone":"x","role":"admin"})`.
  *Expected:* rejected → redirect to `/login`. *Actual (buggy):* served `/admin` pages.
- **Operator impersonation (1.3):** Attacker sets a cookie with an arbitrary
  `id` and `role:"operator"`. *Expected:* rejected, no identity established.
  *Actual (buggy):* request is treated as that operator.
- **Tampered legitimate session:** A real operator copies their cookie, flips
  `"role":"operator"` to `"role":"admin"`, re-base64-encodes it.
  *Expected:* signature mismatch → rejected. *Actual (buggy):* admin access granted.
- **Edge case — empty/garbage cookie:** `crm_op_session = "not-base64!!"`.
  *Expected (both before and after fix):* treated as no/invalid session → redirect to
  `/login`. This is **not** the bug condition (no usable identity is decoded).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors (must continue to hold after the fix):**
- A valid operator login still issues a session and routes to `/dashboard` (3.1).
- A valid admin login still issues a session and routes to `/admin` (3.2).
- A legitimately authenticated operator is still blocked from `/admin` and redirected to
  `/dashboard` (3.3).
- A request with no session (or an invalid one) is still redirected to `/login`, while
  `/login` and `/register` remain publicly accessible (3.4).
- A login for a `pending` or `blocked` account is still rejected with the appropriate
  message (3.5).
- An authenticated user visiting `/` or `/login` is still redirected to `/admin` or
  `/dashboard` per their (now verified) role (3.6).

**Scope:**
All inputs that do **not** involve an unverified-but-trusted session are completely
unaffected by this fix. Specifically:
- Requests for static assets / `_next` paths.
- Requests with no session cookie at all.
- Requests bearing a **validly signed** session (legitimate logins).
- The public `/login` and `/register` routes.

> The concrete *correct* behavior for the bug condition is defined in
> **Correctness Properties → Property 1**. This section enumerates what must **not** change.

## Hypothesized Root Cause

Based on the bug description and source review, the contributing causes are:

1. **No integrity protection on the session token.** `lib/session.ts` `encodeSession`/
   `decodeSession` use plain base64 of the operator JSON. There is no signature or
   encryption, so the payload is fully attacker-forgeable, and `proxy.ts` trusts
   `session.role`/`session.id` directly.

2. **Client-side session issuance.** `app/login/page.tsx` writes the cookie with
   `document.cookie = ...` in the browser. Because the browser mints the cookie, there is
   no server boundary at which integrity could be enforced, and the cookie cannot be
   `HttpOnly`.

3. **Hardcoded secrets and identity.** `lib/auth.ts` hardcodes `CRM_EMAIL`,
   `CRM_PASSWORD`, and a fixed `OWNER_ID`, and defines a second `crm_session =
   "authenticated"` constant — secrets in source plus a competing mechanism.

4. **Weak password hashing.** `hashPassword` in `lib/session.ts` runs **client-side**
   SHA-256 with a single static global salt (`"crm_salt_2026"`) and no per-user salt —
   fast and precomputation-friendly, and computed in an untrusted location.

5. **Two competing enforcement mechanisms.** `crm_op_session` (used by `proxy.ts`) and the
   `crm_session`/`authenticated` constants in `lib/auth.ts` coexist, producing
   inconsistent expectations about what "authenticated" means.

## Correctness Properties

Property 1: Bug Condition — Forged / unsigned sessions are rejected

_For any_ request where the bug condition holds (a `crm_op_session` token decodes to a
usable identity but carries no valid server HMAC signature — `isBugCondition` returns
true), the fixed system SHALL treat the request as **unauthenticated**: it SHALL NOT trust
the decoded `role` or `id`, SHALL NOT serve protected or admin content, and SHALL redirect
the request to `/login`. This holds for forged admin cookies, forged operator cookies, and
tampered copies of otherwise-valid cookies.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Non-bug inputs behave exactly as before

_For any_ request where the bug condition does NOT hold (no session, an unparseable
cookie, the public `/login`/`/register` routes, or a **validly signed** session), the
fixed system SHALL produce the same routing and enforcement outcome as the original
system — preserving valid-login routing to `/dashboard`/`/admin`, the operator-to-`/admin`
block, the sessionless redirect to `/login`, public access to `/login` and `/register`,
the `pending`/`blocked` login rejections, and the authenticated-root/login redirects.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Property 3: Password hashing is slow and per-user-salted

_For any_ two users (or one user hashing the same password twice), the stored password
hash SHALL be produced by a slow, salted scheme with a **unique per-user salt** such that
identical plaintext passwords yield **different** stored hashes, and verification SHALL be
performed server-side. No password hash SHALL be derivable from a single static
application-wide salt.

**Validates: Requirements 2.4 (secret sourcing for hashing), 2.5**

Property 4: Single authoritative enforcement path

_For any_ protected route, access control SHALL be decided by exactly one mechanism — the
server-validated `crm_op_session` verified in `proxy.ts`. _For any_ route, no decision
SHALL depend on the removed `crm_session`/`authenticated` mechanism.

**Validates: Requirements 2.6**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, the following targeted changes are made.

#### 1. `lib/session.ts` — replace base64 with HMAC-signed tokens (Edge-compatible)

- **Add `SESSION_SECRET` access** from `process.env.SESSION_SECRET`; fail fast (throw at
  startup / refuse to sign) if it is missing.
- **Add `signSession(op): Promise<string>`** (server only):
  - Build `payload = { id, name, phone, role, iat: now, exp: now + maxAge }`.
  - `data = base64url(JSON.stringify(payload))`.
  - `sig = base64url(HMAC_SHA256(SESSION_SECRET, data))` via `crypto.subtle`
    (`importKey` of the secret as an HMAC key, then `sign`).
  - Return `` `${data}.${sig}` ``.
- **Add `verifySession(token): Promise<Operator | null>`** (Edge-safe via `crypto.subtle`):
  - Split on `.`; if not exactly two parts, return `null`.
  - Recompute the HMAC over `data` and compare against the provided signature using a
    **constant-time** comparison (`crypto.subtle.verify`, which is timing-safe).
  - Parse the payload; reject if `exp` is in the past or `id`/`role` are missing.
  - Return the `Operator` **only** when the signature is valid and unexpired; otherwise
    `null`.
- **Replace `encodeSession`/`decodeSession`** call sites with `signSession`/`verifySession`.
  Remove the unauthenticated `decodeSession` path entirely (or keep it private and unused).
- **Remove client trust:** `getClientSession` must no longer be treated as authoritative.
  Since the cookie becomes `HttpOnly`, the client cannot read it; client components obtain
  the operator from a server source instead (see change 4).
- **Remove the weak `hashPassword`** from client usage (see change 3).

> All cryptography here uses the Web Crypto `crypto.subtle` HMAC primitives, which are
> available in **both** the Node and Edge runtimes, so the same `verifySession` runs inside
> `proxy.ts`.

#### 2. `proxy.ts` — verify signatures, reject forgeries

- Replace `const session = cookieVal ? decodeSession(cookieVal) : null;` with
  `const session = cookieVal ? await verifySession(cookieVal) : null;`.
- Behavior is otherwise unchanged: when `session` is `null` (now including **all** forged,
  tampered, or expired tokens), the existing "not logged in → `/login`" branch handles the
  redirect. The role-based branches (`operator` blocked from `/admin`, root/login
  redirects) run only for verified sessions.
- This single change converts every forgery into a "no valid session" outcome without
  altering the routing logic for legitimate sessions.

#### 3. Password hashing — slow, per-user-salted, server-side

- **Remove client-side `hashPassword`.** `app/login/page.tsx` and `app/register/page.tsx`
  stop hashing in the browser and instead submit the **raw password over HTTPS** to a
  server endpoint (change 4). Input over TLS is the standard, safe pattern; the secret never
  needs to leave the server-validated boundary.
- **Hash/verify on the server with a slow, salted scheme.** Recommended: Supabase Postgres
  `pgcrypto` —
  - `register_operator` stores `crypt(p_password, gen_salt('bf', 12))` (bcrypt embeds a
    unique per-user salt and a tunable cost).
  - `check_login` verifies with `stored_hash = crypt(p_password, stored_hash)`.
  - Alternatively, hash with `bcrypt`/`argon2` inside a **Node-runtime** route handler
    (`export const runtime = "nodejs"`), never in Edge middleware.
- Migrate existing rows on next successful login (re-hash) or via a one-time migration; the
  old SHA-256 hashes are retired.

#### 4. Server-issued sessions + consolidation

- **Add a server login route handler** (`app/api/auth/login/route.ts`, `runtime = "nodejs"`):
  validates credentials via the (updated) Supabase RPC, and on success calls
  `signSession` and sets the cookie via `cookies().set(SESSION_COOKIE, token, { httpOnly:
  true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 })`. Returns the role so
  the client can navigate.
- **`app/login/page.tsx`** posts credentials to that route instead of calling the RPC
  directly and setting `document.cookie`. On success it navigates to `/admin` or
  `/dashboard` exactly as before (preserves 3.1, 3.2, 3.5).
- **Add a logout route** that clears the cookie.
- **Client operator access:** replace `getClientSession`/`useOperator`'s `document.cookie`
  read with data provided by the server (e.g., a lightweight `/api/auth/me` endpoint that
  calls `verifySession`, or props passed down from a server component). The displayed
  identity is now always the server-verified one.
- **Remove `lib/auth.ts`** (`CRM_EMAIL`, `CRM_PASSWORD`, `OWNER_ID`, `crm_session`,
  `"authenticated"`). Any still-needed owner identifier is read from
  `process.env` (e.g. `OWNER_ID`). This eliminates the competing mechanism and the
  hardcoded secrets (2.4, 2.6).

#### 5. Environment configuration (2.4)

- Add required variables: `SESSION_SECRET` (signing key), and any retained `OWNER_ID` /
  bootstrap credentials — all sourced from the environment / secret storage, documented in
  `.env.example`, and absent from source control.

## Testing Strategy

### Validation Approach

Two phases: first surface counterexamples that demonstrate the bug on the **unfixed** code,
then verify the fix both **closes the bug** (fix checking) and **preserves** existing
behavior (preservation checking).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the authentication bypass BEFORE
implementing the fix, and confirm or refute the root-cause hypotheses. If refuted, we
re-hypothesize.

**Test Plan**: Construct forged/tampered `crm_op_session` cookie values and run them
through the middleware decision logic (`proxy.ts`) on the **unfixed** code, asserting the
*desired* outcome (rejection / redirect to `/login`). These assertions are expected to
**fail** on unfixed code, demonstrating the bug.

**Test Cases**:
1. **Forged admin cookie**: `base64({role:"admin", id:"x", ...})` → assert redirect to
   `/login` (will fail on unfixed code; currently serves `/admin`).
2. **Forged operator cookie**: arbitrary `id`, `role:"operator"` → assert no identity
   established / redirect (will fail on unfixed code).
3. **Tampered legitimate cookie**: take a valid operator payload, flip `role` to `admin`,
   re-encode → assert rejection (will fail on unfixed code).
4. **Edge case — unparseable cookie**: `"###"` → assert redirect to `/login` (this already
   passes on unfixed code; confirms it is *not* part of the bug condition).

**Expected Counterexamples**:
- A cookie the server never issued is accepted as a valid identity.
- Possible causes: no signature/encryption on the token (confirmed in `decodeSession`),
  client-side cookie minting, trust of decoded `role` in `proxy.ts`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces
the expected behavior (rejection as unauthenticated).

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  outcome := middlewareDecision_fixed(request)
  ASSERT outcome = REDIRECT("/login")
  ASSERT NOT grantsRole(outcome, "admin")
  ASSERT NOT establishesIdentity(outcome)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code
produces the same result as the original code.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT middlewareDecision_original(request) = middlewareDecision_fixed(request)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking
because it generates many inputs across the domain (paths × cookie states × roles),
catches edge cases manual tests miss, and gives strong confidence that routing is unchanged
for all non-bug inputs. For validly-signed sessions in the property runner, the test
harness signs payloads with a test `SESSION_SECRET` so the "valid session" branch is
exercised exactly as production would.

**Test Plan**: Observe the original behavior on unfixed code for non-bug inputs (no
session, public routes, valid sessions), then encode those expectations as property and
example tests that must continue to hold after the fix.

**Test Cases**:
1. **Valid operator routing**: signed operator session → `/dashboard` reachable, `/admin`
   redirects to `/dashboard` (3.1, 3.3).
2. **Valid admin routing**: signed admin session → `/admin` reachable (3.2).
3. **Sessionless redirect & public routes**: no cookie → `/login`; `/login` and
   `/register` remain accessible (3.4).
4. **Pending/blocked login**: login attempts for `pending`/`blocked` accounts still
   rejected with the correct message (3.5).
5. **Authenticated root/login redirect**: signed session visiting `/` or `/login`
   redirects per verified role (3.6).

### Unit Tests

- `signSession` then `verifySession` round-trips to the original `Operator`.
- `verifySession` returns `null` for: tampered payload, tampered signature, wrong secret,
  missing signature segment, and expired `exp`.
- `proxy.ts` decision table for each (path, session-state) combination.
- Login route sets an `HttpOnly`/`Secure`/`SameSite` cookie on valid credentials and
  rejects `pending`/`blocked`.
- Password hashing: same plaintext hashed twice yields different stored hashes (per-user
  salt); verification succeeds for the correct password and fails for the wrong one.

### Property-Based Tests

- **Forgery rejection (Property 1)**: generate arbitrary JSON identities (including
  `role:"admin"`), base64-encode them **without** a valid signature → `verifySession`
  returns `null` and the middleware redirects to `/login`.
- **Preservation (Property 2)**: generate random (path, cookie-state) pairs over the
  non-bug domain and assert the fixed middleware decision equals the original decision.
- **Hashing (Property 3)**: generate random passwords; assert hashes are unique per call
  (salted) and verify correctly; assert no static-salt derivation reproduces the hash.

### Integration Tests

- End-to-end login → cookie issued by the server → protected route served; logout clears
  the cookie and subsequent access redirects to `/login`.
- Attacker flow: inject a forged admin cookie via the HTTP client → `/admin` redirects to
  `/login` (no admin content served).
- Context switching: operator session cannot reach `/admin` across navigation; admin
  session can.
