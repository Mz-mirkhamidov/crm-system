// Component-test setup for the frontend-ux-improvements spec.
//
// Registers the @testing-library/jest-dom custom matchers (e.g. `toBeInTheDocument`,
// `toHaveAttribute`) on Vitest's `expect`. This file is listed in `setupFiles` so it
// loads for every test, but the matchers only access the DOM when invoked from a spec
// that opts into the jsdom environment via `// @vitest-environment jsdom`. Loading it in
// the Node environment is harmless.
import "@testing-library/jest-dom/vitest";
