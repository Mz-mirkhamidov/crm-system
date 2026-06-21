import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Test runner configuration for the auth-session-security-fix spec.
//
// The middleware (`proxy.ts`) and session helpers (`lib/session.ts`) rely on the
// Web Crypto API (`globalThis.crypto.subtle`) for HMAC signing/verification. We run
// tests in the Node runtime, where Web Crypto is exposed globally (Node >= 18),
// matching the primitives available to `proxy.ts` at the Edge.
export default defineConfig({
  test: {
    // Node environment exposes globalThis.crypto.subtle (Web Crypto), the same
    // primitive surface available in the Edge runtime used by proxy.ts.
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts", "**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Load a test SESSION_SECRET before any test module is imported so the
    // "valid session" branch can be exercised exactly as production would.
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" path alias so tests can import app modules.
      "@": resolve(__dirname, "."),
    },
  },
});
