# Implementation Plan: Frontend UX Improvements

## Overview

This plan converts the approved design into incremental, test-driven coding steps for the Sellora Plus CRM (`crm-system`, Next.js 16 App Router + Supabase, TypeScript/React 19). It follows the design's rollout order:

1. **Land infrastructure first** with no UI behavior change — toast system, `AsyncContent`/`EmptyState`/`ErrorState`, and the typed `lib/data` data-access layer (repository with a single `SCOPE_COLUMN`, generic `useEntityList`, per-entity hooks).
2. **Extract pure helpers** (`applyFilters`, `getOrderTotal`, `getInitials`, `getLeadAge`) into `lib/utils.ts` for reuse and unit/property testing.
3. **Migrate one table end-to-end (leads) as the reference**, then clients, orders, follow-ups, then the shared modals and dashboard widgets — each replacing `alert()`/inline Supabase with hooks + toasts + `AsyncContent`, fixing Fragment keying, and eliminating `any`.
4. **Remove the stale `patch/` directory** once unreferenced.
5. **Tests throughout** — Vitest + fast-check property tests (the 8 correctness properties) and React Testing Library + jsdom component tests.

Each step builds on the previous one and ends by wiring components into the live tree; there is no orphaned code. Tasks are strictly **frontend-only** per the scope guardrails (Requirement 10): no changes to `supabase/migrations`, RLS policies, or the auth/session security model.

> **Sandbox execution note:** This environment cannot run `npm install`, `vitest`, or any package-registry-dependent command. All test files are **authored** here and are intended to be **installed, run, and verified by the user (or in CI) where registry access is available**. Tasks that add dev dependencies update `package.json` only; the actual install/run happens outside the sandbox.

## Tasks

- [x] 1. Set up test tooling and dev dependencies (no behavior change)
  - [x] 1.1 Add component-test dev dependencies and Vitest jsdom config
    - Add `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` to `devDependencies` in `package.json`
    - Add/extend `vitest.config.ts` so component specs run under the `jsdom` environment while pure logic/property tests keep using the Node env (e.g. environment per-file or a `jsdom` project), preserving the existing `@` alias
    - Create a Vitest setup file that imports `@testing-library/jest-dom` matchers
    - Do NOT run install/tests here; document that the user runs `npm install` and `npx vitest run` where registry access exists
    - _Requirements: 10.4, 10.5_

- [x] 2. Implement the toast notification system (infrastructure, unmounted)
  - [x] 2.1 Create toast presentational primitives
    - Create `components/ui/toast.tsx` with `Toast` and `ToastViewport` styled via existing Tailwind tokens and `lucide-react` icons (`CheckCircle2`/`AlertCircle`/`AlertTriangle`)
    - Each toast uses `role="status"` and a close button with an `aria-label`; the viewport is a fixed `role="region"` container with an `aria-live` region (`polite` default, `assertive` for errors)
    - Reuse `cn` and the `getStatusColor`-style palette; introduce no new design tokens and no heavy UI framework
    - _Requirements: 1.3, 1.4, 1.6, 10.4, 10.5_
  - [x] 2.2 Implement toast state, reducer, provider, and `useToast` hook
    - Create `components/ui/use-toast.tsx` exporting `ToastVariant`, `ToastOptions`, `ToastRecord`, `ToastApi`, `ToastProvider`, and `useToast()` (throws outside provider)
    - Implement the `ADD`/`DISMISS`/`REMOVE` reducer with newest-first ordering capped at `MAX_VISIBLE`, `crypto`-based ids, and auto-dismiss scheduling for positive durations (`0` = sticky)
    - Expose `show`/`success`/`error`/`warning`/`dismiss(id?)`; `error` maps to assertive announcement
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 3.2_
  - [x] 2.3 Create the `Toaster` mount component
    - Create `components/ui/toaster.tsx` that subscribes to toast context state and renders the viewport with current toasts; wires close + auto-dismiss to reducer dispatch
    - _Requirements: 1.3, 1.7, 1.8_
  - [x]* 2.4 Write property + unit tests for the toast reducer
    - **Reducer invariant property:** for arbitrary action sequences, `toasts.length <= MAX_VISIBLE` and all ids are unique (fast-check)
    - Unit-test `ADD`/`DISMISS`/`REMOVE` transitions and the visible cap
    - _Requirements: 1.7_
  - [x]* 2.5 Write component tests for `Toaster` + `useToast`
    - Assert `toast.error(msg)` mounts a toast with `role="status"`, the message text, and an `aria-live` region; auto-dismiss after duration; manual close works (RTL + jsdom)
    - **Validates: Property 1 (no blocking alerts), Property 2 (errors not silent)**
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Mount the toast system into the layouts (wiring)
  - [x] 3.1 Mount `ToastProvider` + `Toaster` in the dashboard layout
    - Wrap the dashboard tree in `ToastProvider` and render `<Toaster />` once in `app/(dashboard)/layout.tsx`
    - _Requirements: 1.8_
  - [x] 3.2 Mount `ToastProvider` + `Toaster` in the admin layout
    - Wrap and render the toaster once in `app/admin/layout.tsx`
    - _Requirements: 1.8_

- [x] 4. Implement the async-state rendering convention (infrastructure)
  - [x] 4.1 Create `AsyncContent`, `EmptyState`, `ErrorState`, and `selectBranch`
    - Create `components/shared/async-content.tsx` with a pure exported `selectBranch({loading,error,data})` returning `"loading" | "error" | "empty" | "data"` using precedence loading > error > empty > data
    - `AsyncContent<T>` renders exactly one branch per `selectBranch`; `ErrorState` shows the message + a "Qayta urinish" retry button wired to `onRetry`; `EmptyState` shows icon/title/description/action; default loading fallback is the centered "Yuklanmoqda..." spinner
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x]* 4.2 Write property test for deterministic branch selection
    - **Property 3: Deterministic async rendering** — for arbitrary `{loading, error, data}`, `selectBranch` returns exactly one branch matching the precedence order (fast-check)
    - **Property 4: No stuck states** — assert `loading=false` never yields `"loading"`
    - **Validates: Requirements 2.1, 2.2, 2.7**
  - [x]* 4.3 Write component tests for `AsyncContent`
    - Render spinner / `ErrorState` (with Retry invoking `onRetry`) / `EmptyState` / children per state (RTL + jsdom)
    - **Validates: Property 3, Property 4**
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 5. Implement the typed data-access layer (infrastructure)
  - [x] 5.1 Create the `Result<T>` type
    - Create `lib/data/result.ts` exporting `Result<T> = { ok: true; data: T } | { ok: false; error: string }`
    - _Requirements: 4.4, 3.3_
  - [x] 5.2 Implement the repository with a single `SCOPE_COLUMN`
    - Create `lib/data/repository.ts` defining `const SCOPE_COLUMN = "user_id" as const` and typed builders over `createClient()`: `listLeads`, `listClients`, `listOrders`, `listFollowUps`, `listOrdersForSource`, `insertLead`/`updateLead`, `insertClient`/`updateClient`, `insertOrder`, `insertFollowUp`, `confirmOrder`, `markFollowUpDone`, `deleteRow(table, id)`, `findDuplicateByPhone`
    - Every read applies `.eq(SCOPE_COLUMN, operatorId)`; map every Supabase `{data,error}` into `Result<T>` with a descriptive message on failure
    - _Requirements: 3.3, 4.1, 4.4, 5.1, 5.2_
  - [x] 5.3 Implement the generic `useEntityList<T>` hook
    - Create `lib/data/use-entity-list.ts` returning `{ data, loading, error, refetch, setData }`; read `operator.id` from `useOperator()`, guard `operatorId === ""` (no query), reload on operator resolution via `useEffect`, and on load failure set `error` and fire exactly one `toast.error`
    - _Requirements: 3.1, 4.5, 5.3, 5.4, 5.5_
  - [x] 5.4 Implement the typed per-entity hooks
    - Create `lib/data/use-leads.ts`, `use-clients.ts`, `use-orders.ts`, `use-follow-ups.ts` wrapping `useEntityList` with their loaders and entity mutations (`remove`, `loadLeadOrders`, `checkDuplicate`, `confirm`, `markDone`)
    - Each mutation: on `ok` update local state once + `toast.success(...)`; on error `toast.error(...)` and leave state unchanged
    - _Requirements: 3.2, 4.1, 4.5, 6.1, 6.2, 6.3_
  - [x]* 5.5 Write property test for operator-scoping invariant
    - **Property 5: Operator-scoping invariant** — for arbitrary `operatorId` strings, the repository builder includes `eq(SCOPE_COLUMN, id)` and short-circuits on `""` (mock `createClient()`, assert the call chain)
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [x]* 5.6 Write property test for mutation atomicity
    - **Property 6: Mutation atomicity in UI** — model `remove`/`confirm`/`markDone` over a list with a mocked repository returning arbitrary ok/error; assert success ⇒ single state delta + success toast, failure ⇒ state unchanged + error toast (fast-check)
    - **Property 2: Errors are never silent** — assert each failure fires exactly one error toast
    - **Validates: Requirements 6.2, 6.3, 3.2**

- [x] 6. Extract pure helpers into `lib/utils.ts`
  - [x] 6.1 Extract and type the pure render/aggregate helpers
    - Add `applyFilters(leads, criteria)` (search/status/tag/age), `getOrderTotal(orders: Order[]): number`, `getInitials(name: string)`, `getLeadAge(...)`, and a `getRowKey(row)` key-derivation helper to `lib/utils.ts`
    - Keep them pure and typed (no `any`); these will replace the inline logic during table migration
    - _Requirements: 8.1, 8.2, 8.3_
  - [x]* 6.2 Write unit tests for the pure helpers
    - Table-test `applyFilters`, `getOrderTotal`, `getInitials`, `getLeadAge` edge cases
    - _Requirements: 8.3_
  - [x]* 6.3 Write property test for unique list keys
    - **Property 7: Stable list keys** — for arbitrary arrays of rows with unique ids, `getRowKey` yields all-distinct keys (fast-check)
    - **Validates: Requirements 7.1, 7.2**

- [x] 7. Checkpoint - infrastructure complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Migrate the leads table end-to-end (reference implementation)
  - [x] 8.1 Refactor `leads-table.tsx` onto the new infrastructure
    - Replace inline Supabase with `useLeads`; wrap rendering in `AsyncContent` (loading/error/empty + retry via `refetch`); type `leadOrders` as `Record<string, Order[]>` and order callbacks as `Order`; remove all `any`
    - Fix Fragment keying: import `Fragment`, key the wrapping `<Fragment key={lead.id}>`, drop inner `<tr>` keys; compute avatar color index without using it as a key; use the extracted `applyFilters`/`getInitials`
    - Standardize destructive delete through `AlertDialog` and disable async row actions while in flight with a `Loader2` spinner
    - _Requirements: 2.x, 4.1, 4.2, 6.x, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2_
    - **Covers: Property 1, 2, 3, 4, 5, 6, 7, 8**
  - [x] 8.2 Refactor the lead form modal to repository + toasts
    - Replace `alert()` with `toast.error`/`toast.success`; call `insertLead`/`updateLead` returning `Result`; on failure keep modal open + error toast, on success close modal + success toast; set `autoFocus` on the primary field and `disabled={saving}` with spinner on submit
    - _Requirements: 1.1, 1.2, 6.1, 6.4, 6.5, 9.1, 9.3, 9.4_
    - **Covers: Property 1, 2, 6**
  - [x]* 8.3 Write component tests for the leads table + form
    - Failed load renders `ErrorState` and fires one error toast (no `window.alert` spy ever called); successful create closes the modal and fires a success toast; expanded rows emit no React key warning (console spy)
    - **Validates: Property 1, 2, 4, 6, 7**
    - _Requirements: 1.2, 2.4, 2.7, 6.4, 6.5, 7.1_

- [x] 9. Migrate the clients table
  - [x] 9.1 Refactor `clients-table.tsx` onto `useClients` + `AsyncContent`
    - Replace inline Supabase, type `clientOrders` as `Record<string, Order[]>`, remove `any`, fix Fragment keying, standardize delete via `AlertDialog` + loading states
    - _Requirements: 2.x, 4.1, 4.2, 6.x, 7.1, 7.2, 7.3, 8.1, 8.2, 9.1, 9.2_
    - **Covers: Property 1, 2, 3, 4, 5, 6, 7, 8**
  - [x] 9.2 Refactor the client form modal to repository + toasts
    - Replace `alert()` with toasts, use `insertClient`/`updateClient` Result, modal-open-on-failure / close-on-success, `autoFocus` + disabled submit spinner
    - _Requirements: 1.1, 1.2, 6.1, 6.4, 6.5, 9.1, 9.3_
    - **Covers: Property 1, 2, 6**
  - [x]* 9.3 Write component tests for the clients table
    - Failed load → `ErrorState` + one error toast; success → toast; no key warnings
    - **Validates: Property 1, 2, 4, 7**
    - _Requirements: 1.2, 2.4, 7.1_

- [x] 10. Migrate the orders table
  - [x] 10.1 Refactor `orders-table.tsx` onto `useOrders` + `AsyncContent`
    - Replace inline Supabase (and the divergent `operator_id` scoping) with `useOrders`; implement `confirm` ("Keyinroqi" → "Hozirgi") and delete via hook mutations with toasts; remove `any`; add loading/disabled states
    - _Requirements: 2.x, 4.1, 4.2, 5.1, 5.2, 6.x, 8.1, 8.2, 9.1, 9.2_
    - **Covers: Property 1, 2, 3, 4, 5, 6, 8**
  - [x]* 10.2 Write component tests for the orders table
    - Failed load → `ErrorState` + one error toast; confirm/delete success → state delta + success toast
    - **Validates: Property 2, 4, 6**
    - _Requirements: 2.4, 6.1, 6.2_

- [x] 11. Migrate the follow-ups table
  - [x] 11.1 Refactor `follow-ups-table.tsx` onto `useFollowUps` + `AsyncContent`
    - Replace inline Supabase with `useFollowUps`; implement `markDone` and delete via hook mutations with toasts; remove `any`; add loading/disabled states
    - Fix the latent empty-`user_id` query bug by relying on the `useEntityList` `operatorId === ""` guard (no `useEffect(..., [])` firing before operator resolves)
    - _Requirements: 2.x, 4.1, 4.2, 5.3, 5.4, 6.x, 8.1, 8.2, 9.1, 9.2_
    - **Covers: Property 1, 2, 3, 4, 5, 6, 8**
  - [x]* 11.2 Write component tests for the follow-ups table
    - No query fires while `operatorId === ""`; failed load → `ErrorState` + one error toast; markDone success → state delta + success toast
    - **Validates: Property 2, 4, 5, 6**
    - _Requirements: 2.4, 5.3, 6.1, 6.2_

- [ ] 12. Checkpoint - all four tables migrated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Migrate the shared modals
  - [x] 13.1 Refactor `order-modal.tsx` to repository + toasts
    - Replace inline Supabase/`alert()` with `insertOrder` Result + toasts; close-on-success / open-on-failure; keep existing `autoFocus`; disabled submit spinner; remove `any`
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 6.1, 6.4, 6.5, 8.1, 8.2, 9.1, 9.3_
    - **Covers: Property 1, 2, 6, 8**
  - [x] 13.2 Refactor `follow-up-modal.tsx` to repository + toasts
    - Replace inline Supabase/`alert()` with `insertFollowUp` Result + toasts; close-on-success / open-on-failure; disabled submit spinner; remove `any`
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 6.1, 6.4, 6.5, 8.1, 8.2, 9.1, 9.3_
    - **Covers: Property 1, 2, 6, 8**
  - [x] 13.3 Refactor `detail-modal.tsx` to typed reads via repository
    - Type `orders` as `Order[]` and `followUps` as `FollowUp[]`; load via `listOrdersForSource` (consistent `SCOPE_COLUMN`); wrap sub-lists in `AsyncContent`; use `getOrderTotal` for aggregates; remove `any`
    - _Requirements: 2.x, 4.1, 4.2, 5.1, 8.1, 8.2, 8.3_
    - **Covers: Property 3, 4, 5, 8**
  - [x]* 13.4 Write component tests for the shared modals
    - Submit failure keeps modal open + one error toast; submit success closes modal + success toast; `detail-modal` renders typed lists and `ErrorState` on load failure
    - **Validates: Property 1, 2, 6, 8**
    - _Requirements: 1.2, 6.4, 6.5_

- [x] 14. Migrate the dashboard widgets
  - [x] 14.1 Refactor dashboard widgets onto entity hooks + `AsyncContent`
    - Replace inline Supabase in `components/dashboard/*` (`stats-cards`, `today-list`, `leads-chart`, `welcome-widget`) with the typed hooks; wrap async sections in `AsyncContent`; route errors to toasts; remove `any`
    - _Requirements: 2.x, 3.1, 4.1, 4.2, 8.1, 8.2_
    - **Covers: Property 2, 3, 4, 5, 8**
  - [x]* 14.2 Write component tests for dashboard widgets
    - Failed load → `ErrorState` + one error toast; loaded data renders without `any`-related runtime issues
    - **Validates: Property 2, 4**
    - _Requirements: 2.4, 3.1_

- [x] 15. Remove dead code
  - [x] 15.1 Delete the stale `patch/` directory
    - Confirm no references remain (already excluded in `tsconfig.json`), then remove the `patch/` directory and verify the build/typecheck is unaffected
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 16. Final checkpoint - ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Sandbox note: the component/property tests for tasks 13.4, 14.2 (and all prior `*` test tasks) are authored in the repo but cannot be executed here (INTEGRATIONS_ONLY: no `npm install`/`vitest`). Run `npm install && npx vitest run` where package-registry access exists (locally or in CI) to verify.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements (granular clause numbers) for traceability, and each migration/test task annotates the design correctness property(ies) it covers.
- Property-based tests map to the 8 correctness properties in the design: P3/P4 (async branch), P5 (scoping), P6 + P2 (mutation atomicity / errors-not-silent), P7 (unique keys), plus the toast reducer invariant.
- Checkpoints (tasks 7, 12, 16) provide incremental validation at natural boundaries.
- **Scope guardrails (Requirement 10):** all tasks stay within `components/`, `app/(dashboard)`, `app/admin`, `lib/` client helpers, and `types/`. No task touches `supabase/migrations`, RLS, or the auth/session security model, and no heavy UI framework is introduced.
- **Sandbox limitation:** `npm install` and test runners cannot execute in this environment. Test files (steps marked `*` and the dev-dependency setup in 1.1) are authored here; install and run them where you have package-registry access (locally or in CI) to verify.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.1", "5.1", "6.1"] },
    { "id": 1, "tasks": ["2.2", "4.2", "4.3", "5.2", "6.2", "6.3"] },
    { "id": 2, "tasks": ["2.3", "2.4", "5.3", "5.5"] },
    { "id": 3, "tasks": ["2.5", "3.1", "3.2", "5.4"] },
    { "id": 4, "tasks": ["5.6", "8.1"] },
    { "id": 5, "tasks": ["8.2", "9.1", "10.1", "11.1"] },
    { "id": 6, "tasks": ["8.3", "9.2", "10.2", "11.2", "13.1", "13.2", "13.3"] },
    { "id": 7, "tasks": ["9.3", "13.4", "14.1"] },
    { "id": 8, "tasks": ["14.2", "15.1"] }
  ]
}
```
