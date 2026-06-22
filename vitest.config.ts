import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Test runner configuration.
//
// Two kinds of tests coexist in this repo:
//
//  1. Node-env tests (auth-session-security-fix spec + pure logic/property tests):
//     the middleware (`proxy.ts`) and session helpers (`lib/session.ts`) rely on the
//     Web Crypto API (`globalThis.crypto.subtle`), exposed globally in Node >= 18.
//     These run in the default `node` environment.
//
//  2. Component tests (frontend-ux-improvements spec): React Testing Library specs that
//     need a DOM. These opt in to jsdom **per file** with a docblock at the top of the
//     test file:
//
//         // @vitest-environment jsdom
//
//     Using a per-file environment (rather than a global one) keeps the existing
//     Node-env crypto tests working unchanged while letting component specs render to a
//     DOM. The shared `@` path alias and the `tests/setup.ts` SESSION_SECRET bootstrap
//     are preserved for every test.
//
// Setup files run in every environment:
//   - tests/setup.ts            establishes a deterministic SESSION_SECRET.
//   - tests/setup-jsdom.ts      registers @testing-library/jest-dom matchers (safe to
//                               load in the Node env; matchers only touch the DOM when
//                               actually invoked from a jsdom spec).
export default defineConfig({
  test: {
    // Default environment. Component specs override this to `jsdom` via the
    // `// @vitest-environment jsdom` docblock.
    environment: "node",
    globals: true,
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    exclude: ["node_modules/**", ".next/**", "patch/**"],
    // Load the test SESSION_SECRET and the jest-dom matchers before any test module is
    // imported. The SESSION_SECRET bootstrap is required by the auth-session tests.
    setupFiles: ["tests/setup.ts", "tests/setup-jsdom.ts"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" path alias so tests can import app modules.
      "@": resolve(__dirname, "."),
    },
  },
});
