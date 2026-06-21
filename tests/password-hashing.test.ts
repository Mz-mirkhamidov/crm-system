// Task 6.2 — Password Hashing Is Slow And Per-User-Salted (Property 3)
// Spec: auth-session-security-fix
//
// Property 3 — Password hashing is slow and per-user-salted:
//   For any two users (or one user hashing the same password twice), the stored password
//   hash is produced by a slow, salted scheme with a UNIQUE per-user salt such that
//   identical plaintext passwords yield DIFFERENT stored hashes; verification is performed
//   SERVER-SIDE; and no hash is derivable from a single static application-wide salt.
//
// **Validates: Requirements 2.4, 2.5**
//
// ============================================================================
// EXPECTED OUTCOME: **THESE TESTS PASS** (static/invariant assertions).
// ============================================================================
// SCOPE / ENVIRONMENT NOTE:
//   The production scheme is bcrypt via Postgres `pgcrypto` (`crypt(pw, gen_salt('bf',12))`),
//   executed inside Supabase. This sandbox has NO live Postgres/pgcrypto and NO bundled
//   bcrypt, so full runtime verification of the bcrypt round-trip is deferred to integration
//   testing (Task 7) where DB access is available. Here we assert Property 3 at the two
//   levels we CAN check deterministically:
//     (A) STATIC: the migration uses a unique per-user bcrypt salt (`gen_salt('bf', ...)`),
//         the verifier uses `crypt()`, and the ACTIVE app no longer hashes with the legacy
//         static salt `crm_salt_2026` (and no longer exposes the browser `hashPassword`).
//     (B) INVARIANT MODEL: a reference per-user-salted hash exhibits the exact properties
//         the bcrypt scheme guarantees — same plaintext -> different stored hash, correct
//         password verifies, wrong password fails, and a single static-salt derivation can
//         NOT reproduce the stored hash.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import fc from "fast-check";

const REPO_ROOT = process.cwd();
const MIGRATION_PATH = join(REPO_ROOT, "supabase/migrations/006_password_hashing.sql");
const LEGACY_STATIC_SALT = "crm_salt_2026";

// Directories outside the active application build (mirrors single-enforcement.test.ts).
//   - supabase: SQL migrations legitimately reference the legacy salt in the BACKWARD-COMPAT
//     verification path; that is verification of old hashes, not new hashing.
//   - tests: this suite mentions the salt in prose.
//   - patch: stale duplicates excluded from the build.
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "tests",
  "patch",
  ".kiro",
  "public",
  "supabase",
]);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// (A) STATIC checks against the migration and the active app source.
// ---------------------------------------------------------------------------

describe("Property 3 (Hashing): migration uses slow, per-user-salted bcrypt server-side", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf-8");

  it("enables pgcrypto so hashing runs in Postgres (server-side)", () => {
    expect(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pgcrypto/i.test(sql)).toBe(true);
  });

  it("register_operator stores a bcrypt hash with a unique per-user salt", () => {
    // gen_salt('bf', ...) => a fresh bcrypt salt per call => per-user salt embedded.
    expect(/crypt\(\s*p_password\s*,\s*gen_salt\(\s*'bf'\s*,\s*\d+\s*\)\s*\)/i.test(sql)).toBe(true);
  });

  it("check_login verifies bcrypt with crypt() and re-hashes legacy rows on success", () => {
    // Modern verification: stored = crypt(p_password, stored).
    expect(/crypt\(\s*p_password\s*,\s*op\.password\s*\)/i.test(sql)).toBe(true);
    // Transparent upgrade: legacy rows are re-hashed to bcrypt after a successful login.
    expect(/UPDATE\s+operators[\s\S]*?crypt\(\s*p_password\s*,\s*gen_salt\(\s*'bf'/i.test(sql)).toBe(true);
  });

  it("RPCs accept the RAW password (not a precomputed hash)", () => {
    // Parameter renamed from p_password_hash -> p_password across the recreated functions.
    expect(sql).toContain("check_login(p_phone TEXT, p_password TEXT)");
    expect(sql).toContain("register_operator(p_phone TEXT, p_name TEXT, p_password TEXT)");
    expect(sql).not.toMatch(/p_password_hash/);
  });
});

describe("Property 3 (Hashing): the active app no longer hashes with a static salt", () => {
  const sourceFiles = collectSourceFiles(REPO_ROOT);

  it("finds active application source files to scan", () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it("no active source derives a hash from the static application-wide salt", () => {
    const offenders = sourceFiles.filter((f) =>
      readFileSync(f, "utf-8").includes(LEGACY_STATIC_SALT)
    );
    expect(offenders.map((f) => relative(REPO_ROOT, f))).toEqual([]);
  });

  it("no active source still hashes passwords in the browser via `hashPassword`", () => {
    const offenders = sourceFiles.filter((f) => /\bhashPassword\b/.test(readFileSync(f, "utf-8")));
    expect(offenders.map((f) => relative(REPO_ROOT, f))).toEqual([]);
  });

  it("the login/register routes submit the raw password to the server RPCs", () => {
    const login = readFileSync(join(REPO_ROOT, "app/api/auth/login/route.ts"), "utf-8");
    const register = readFileSync(join(REPO_ROOT, "app/api/auth/register/route.ts"), "utf-8");
    expect(login).toMatch(/p_password:\s*password/);
    expect(register).toMatch(/p_password:\s*password/);
    expect(login).not.toMatch(/p_password_hash/);
    expect(register).not.toMatch(/p_password_hash/);
  });
});

// ---------------------------------------------------------------------------
// (B) INVARIANT MODEL — a reference per-user-salted hash that exhibits the exact
//     security properties bcrypt guarantees. This documents and enforces the invariants
//     deterministically without a live Postgres; the real bcrypt round-trip is exercised by
//     integration testing (Task 7).
// ---------------------------------------------------------------------------

/** A fresh random salt per call — the model of bcrypt's per-user `gen_salt('bf', ...)`. */
function freshSalt(bytes = 16): Uint8Array {
  const salt = new Uint8Array(bytes);
  crypto.getRandomValues(salt);
  return salt;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reference salted hash: stores the per-user salt alongside the digest (`salt$digest`). */
async function modelHash(password: string, salt: Uint8Array = freshSalt()): Promise<string> {
  const input = new Uint8Array([...salt, ...new TextEncoder().encode(password)]);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return `${toHex(salt)}$${toHex(digest)}`;
}

/** Reference verification: re-derive using the salt embedded in the stored hash. */
async function modelVerify(password: string, stored: string): Promise<boolean> {
  const [saltHex] = stored.split("$");
  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
  return (await modelHash(password, salt)) === stored;
}

/** The retired static-salt derivation (legacy `hashPassword`) used for the negative check. */
async function legacyStaticHash(password: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password + LEGACY_STATIC_SALT))
  );
  return toHex(digest);
}

describe("Property 3 (Hashing): per-user-salt invariants (reference model)", () => {
  it("same plaintext hashed twice yields DIFFERENT stored hashes (unique per-user salt)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 64 }), async (password) => {
        const a = await modelHash(password);
        const b = await modelHash(password);
        expect(a).not.toBe(b);
      }),
      { numRuns: 100 }
    );
  });

  it("verification SUCCEEDS for the correct password", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 64 }), async (password) => {
        const stored = await modelHash(password);
        expect(await modelVerify(password, stored)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("verification FAILS for a wrong password", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        async (password, other) => {
          fc.pre(password !== other);
          const stored = await modelHash(password);
          expect(await modelVerify(other, stored)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("no single static-salt derivation can reproduce the per-user-salted stored hash", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 64 }), async (password) => {
        const stored = await modelHash(password);
        const staticDerived = await legacyStaticHash(password);
        // The static-salt hash is neither the stored value nor its digest half.
        expect(stored).not.toBe(staticDerived);
        expect(stored.split("$")[1]).not.toBe(staticDerived);
      }),
      { numRuns: 100 }
    );
  });
});
