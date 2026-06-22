# Implementation Plan: Client Management Enhancements

## Overview

This plan converts the approved design into incremental, test-driven TypeScript tasks for the
Sellora Plus CRM (Next.js + Supabase anon client, Vitest + fast-check + React Testing Library).
The rollout is **bottom-up**: additive backend migrations first, then types, then the
operator-scoped data layer (`lib/data`), then pure helpers, then UI, with property and component
tests placed next to the code they validate so regressions surface early. Every UI data path goes
through `lib/data` — no inline `supabase.from(...)` in components.

Each task references granular acceptance criteria (`_Requirements: N.M_`) and, where applicable,
the design **Correctness Properties** (P1–P12) it covers. Test sub-tasks are marked optional with
`*`; property tests run a **minimum of 100 iterations** and are tagged
`Feature: client-management-enhancements, Property N: <text>`.

> **Sandbox limitation:** this environment cannot run `npm install`, execute the test suite, or
> apply Supabase migrations (no DB or registry access). All files are *authored* here; the user
> runs `npm test`, type-checks, and applies migrations `007`/`008` in an environment that has DB
> and registry access. Tasks are written so the user can verify each wave independently.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1", "1.2"], "rationale": "Additive backend migrations; independently applicable, no code deps." },
    { "wave": 2, "tasks": ["2.1"], "rationale": "Type extensions unblock every data-layer and UI change." },
    { "wave": 3, "tasks": ["3.1", "3.2", "3.3", "3.4"], "rationale": "Repository functions (notes, touch, convert, client tag) on top of types." },
    { "wave": 4, "tasks": ["4.1", "4.2", "4.3"], "rationale": "Hooks (use-notes, use-clients.convert) consume the repository." },
    { "wave": 5, "tasks": ["5.1", "5.3", "5.2"], "rationale": "Pure helpers: staleness (5.1) + closed-status pipeline logic (5.3), then their property tests (5.2); depend only on types." },
    { "wave": 6, "tasks": ["6.1"], "rationale": "Checkpoint after data + helpers." },
    { "wave": 7, "tasks": ["7.1", "7.2"], "rationale": "Shared NotesFeed component + clients-table refactor (remove delete, tags, stale)." },
    { "wave": 8, "tasks": ["8.1", "8.2"], "rationale": "Detail modal (notes feed, quick-edit, order stats) and leads-table convert action wire hooks into UI." },
    { "wave": 9, "tasks": ["9.1"], "rationale": "Final checkpoint: full suite + traceability review." }
  ],
  "notes": "Waves 1 and 2 can proceed in parallel with each other only at authoring time, but 008 status work and types should agree; treat wave 1 -> wave 2 as the safe order. Within a wave, tasks are independent unless a sub-task '*' test depends on its sibling implementation."
}
```

---

## Tasks

- [x] 1. Backend migrations (additive, independently applicable)
  - [x] 1.1 Author `supabase/migrations/007_notes.sql`
    - Create generic `notes` table: `id UUID PK gen_random_uuid()`, `user_id UUID NOT NULL` (scope), `operator_id UUID`, `source_type TEXT NOT NULL CHECK (source_type IN ('lead','client'))`, `source_id UUID NOT NULL`, `body TEXT NOT NULL`, `created_at`/`updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL`.
    - Mirror the 002/003 access posture exactly: `ALTER TABLE notes DISABLE ROW LEVEL SECURITY;` and `GRANT ALL ON notes TO anon;` — no `auth.users` FK on `user_id` (operator-id scoping model).
    - Add indexes `idx_notes_user_id`, `idx_notes_source(source_id, source_type)`, `idx_notes_created`.
    - Attach `notes_updated_at BEFORE UPDATE` trigger reusing the existing `update_updated_at()` function from `001_initial.sql`.
    - _Requirements: 9.1, 9.3_
    - _Covers: enables P1, P2, P3, P4, P5, P12_

  - [x] 1.2 Author `supabase/migrations/008_client_enrichment.sql`
    - `ALTER TABLE clients ADD COLUMN IF NOT EXISTS tag TEXT;` + `idx_clients_tag`.
    - `ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;` + `idx_clients_last_contacted`.
    - `ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_client_id UUID;`.
    - Drop and recreate `leads_status_check` to add `'Mijozga aylandi'` to the allowed status set (preserving existing values).
    - Ensure all changes are additive/backward-compatible and do NOT depend on `007_notes.sql` being applied first.
    - _Requirements: 9.2, 9.4_
    - _Covers: enables P6, P7, P9_

- [x] 2. Extend domain types
  - [x] 2.1 Update `types/index.ts`
    - Add `Note` interface `{ id, user_id, source_type: SourceType, source_id, body, created_at, updated_at }`.
    - Extend `Client` with `tag: string | null` and `last_contacted_at: string | null` (keep legacy `comment`).
    - Extend `Lead` with `converted_client_id: string | null`.
    - Extend `LeadStatus` union with `'Mijozga aylandi'`.
    - Confirm `SourceType` already includes `'lead' | 'client'`; reuse `DEFAULT_TAGS` for clients (no new constant).
    - _Requirements: 9.2, 9.5_

- [x] 3. Repository layer (`lib/data/repository.ts`) — operator-scoped data access
  - [x] 3.1 Add notes read/write functions
    - `listNotesForSource(operatorId, sourceId, sourceType): Promise<Result<Note[]>>` applying `.eq(SCOPE_COLUMN, operatorId)` and ordering `created_at` DESC.
    - `addNote(operatorId, input: NoteInput): Promise<Result<Note>>` inserting `{ user_id: operatorId, operator_id: operatorId, ...input }`.
    - `updateNote(id, body): Promise<Result<Note>>`.
    - Define `NoteInput { source_type: SourceType; source_id: string; body: string }`. Map `{data,error}` → `Result<T>`.
    - _Requirements: 2.1, 2.4, 2.5, 8.1, 8.2, 8.3_
    - _Covers: P1, P12 (and underpins P3, P4)_

  - [x]* 3.2 Property + unit tests for notes repository
    - **P12: Reads stay operator-scoped** — for any operator id and generated notes, `listNotesForSource` only returns notes whose `user_id` equals that operator (assert the `.eq(SCOPE_COLUMN, operatorId)` filter shape via mocked supabase). Min 100 iterations.
    - **P1: Notes feed reverse-chronological** — for any generated note set, the returned order is strictly `created_at` DESC. Min 100 iterations.
    - Unit: `addNote` sets both `user_id` and `operator_id` to the operator id (P12 / Req 8.2).
    - _Requirements: 2.4, 2.5, 8.2, 8.3_

  - [x] 3.3 Add client-enrichment writes
    - Extend `ClientInput` with `tag: string | null`; ensure `insertClient`/`updateClient` carry `tag` and support partial `last_contacted_at` updates.
    - Add `touchClientLastContacted(id, whenISO?): Promise<Result<Client>>` defaulting to `new Date().toISOString()`.
    - _Requirements: 2.7, 4.5, 5.1_
    - _Covers: P11 (write path)_

  - [x] 3.4 Add `convertLeadToClient(operatorId, lead): Promise<Result<Client>>`
    - Idempotent guard: if `lead.converted_client_id` is set, return the existing client without new inserts/duplication.
    - Insert client from `lead.name/phone/address/comment/tag`, scoped to operator, with `last_contacted_at = now()`.
    - On insert failure, return the error and perform NO notes re-point or lead update.
    - After successful insert: re-point notes `SET source_type='client', source_id=client.id WHERE user_id=operatorId AND source_type='lead' AND source_id=lead.id`; then `UPDATE leads SET status='Mijozga aylandi', converted_client_id=client.id WHERE id=lead.id`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8_
    - _Covers: P4, P5_

  - [x]* 3.5 Property + unit tests for conversion
    - **P4: Conversion re-points the full timeline** — for any lead with N generated notes, after conversion the client's timeline has exactly those N notes (none lost/duplicated) and the lead retains none. Min 100 iterations.
    - **P5: Conversion is idempotent** — for any already-converted lead (`converted_client_id` set), a second conversion creates no second client and duplicates no notes. Min 100 iterations.
    - Unit: client insert failure path performs no notes/lead mutation (Req 3.8); field mapping lead→client (Req 3.1).
    - _Requirements: 3.1, 3.2, 3.5, 3.8_

- [x] 4. Hook layer (`lib/data/use-*.ts`)
  - [x] 4.1 Create `lib/data/use-notes.ts`
    - `useNotes(sourceId, sourceType): UseNotesResult { notes, loading, error, reload, addNote }` loading via repository on mount/id change.
    - `addNote(body)` trims and rejects empty/whitespace (returns `false`, no repository call); on success prepends optimistically via `runMutation`, shows exactly one toast, and for clients calls `touchClientLastContacted` (best-effort/silent on failure).
    - Surface read failures as error state for the modal's `AsyncContent` + error toast with retry (`reload`).
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 2.9, 8.5_
    - _Covers: P2, P3_

  - [x]* 4.2 Property + unit tests for `useNotes`
    - **P2: Empty/whitespace notes rejected** — for any whitespace-only string, `addNote` returns false and triggers no insert and no list change. Min 100 iterations.
    - **P3: Adding a note grows the timeline by exactly one** — for any existing list and non-empty body, a successful add yields length+1 and contains the new note. Min 100 iterations.
    - Unit: success clears input behavior is asserted at the modal layer (8.x); here assert toast-once and `touchClientLastContacted` called only for `source_type='client'`.
    - _Requirements: 2.2, 2.3, 2.7_

  - [x] 4.3 Extend `lib/data/use-clients.ts`
    - Add `convert(lead): Promise<Client | null>` wrapping `convertLeadToClient` via `runMutation` with a single toast; on success the caller refetches leads and clients.
    - Keep `remove(id)` in the hook for back-compat/non-UI callers but ensure it is NOT referenced by any clients UI control.
    - _Requirements: 3.1, 3.9, 8.5_
    - _Covers: P5 (UI entry), P8 (remove stays out of UI)_

- [x] 5. Pure helpers (`lib/utils.ts`)
  - [x] 5.1 Add `getClientStaleness` and `CLIENT_STALE_DAYS`
    - `CLIENT_STALE_DAYS = 7`; `getClientStaleness(client: Pick<Client,'last_contacted_at'|'created_at'>, now?: number): ClientStaleness` returning `{ days, stale, label, color }`.
    - Effective reference = `last_contacted_at ?? created_at`; `stale = days >= CLIENT_STALE_DAYS`; clamp future timestamps to 0 days; reuse `getLeadAge` bucket color thresholds. Keep pure (inject `now`).
    - _Requirements: 6.1, 6.2, 6.3_
    - _Covers: P7_

  - [x]* 5.2 Property + unit tests for helpers and pipeline logic
    - **P7: Client staleness threshold** — for any timestamp around the boundary, `stale` is true iff whole days since effective last-contact `>= 7`; null `last_contacted_at` falls back to `created_at`; future clamps to 0. Min 100 iterations.
    - **P6: Converted leads leave the active pipeline** — extend `CLOSED_LEAD_STATUSES` to include `'Mijozga aylandi'`; generate leads across all statuses and assert `applyFilters` cold/age path excludes converted leads. Min 100 iterations.
    - _Requirements: 3.6, 6.2, 6.3_

  - [x] 5.3 Update `CLOSED_LEAD_STATUSES` / `applyFilters` age logic
    - Add `'Mijozga aylandi'` to `CLOSED_LEAD_STATUSES` so converted leads are excluded from cold/age computation alongside `'Buyurtma berilgan'` / `'Rad etildi'`.
    - _Requirements: 3.6_
    - _Covers: P6_

- [x] 6. Checkpoint — data layer and helpers
  - Ensure all tests pass (repository, hooks, utils), ask the user if questions arise.

- [x] 7. Clients UI: shared NotesFeed + clients-table
  - [x] 7.1 Create `components/shared/notes-feed.tsx`
    - Presentational `NotesFeed` backed by `useNotes(sourceId, sourceType)`: an add-note input above a reverse-chronological feed, wrapped in `AsyncContent` (loading/error/empty), clearing the input on successful submit.
    - _Requirements: 2.1, 2.4, 2.8, 2.9, 8.4_
    - _Covers: P1, P3_

  - [x] 7.2 Refactor `components/clients/clients-table.tsx`
    - REMOVE all delete affordances: the `AlertDialog` block, `Trash2` button, `deletingId` state, `handleDelete`, and the `remove` usage from `useClients()`.
    - Add a tag chip column (mirroring leads) and a tag `Select` filter seeded from `DEFAULT_TAGS` plus tags present in loaded clients; "all" shows everything, a specific value shows only exact-tag matches.
    - Add a "needs attention" banner when any client is stale and a per-row staleness badge using `getClientStaleness`.
    - Add a tag `Select` to the `ClientFormModal` add/edit form.
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.4, 8.1, 8.4_
    - _Covers: P8, P9, P7_

  - [x]* 7.3 Component + property tests for clients-table
    - **P8: Clients are not deletable from the UI** (RTL) — render the table and assert no delete control and no AlertDialog are present.
    - **P9: Tag filter soundness** — for any generated clients and a non-"all" tag selection, every displayed row has `tag` exactly equal to the selected value. Min 100 iterations.
    - Component: stale banner appears iff at least one client is stale; per-row badge reflects `getClientStaleness`.
    - _Requirements: 1.1, 1.2, 4.3, 4.4, 6.1, 6.4_

- [x] 8. Detail modal + leads convert action
  - [x] 8.1 Enhance `components/shared/detail-modal.tsx` (`PersonDetailModal`)
    - Render `NotesFeed` for `person.id` with the correct `source_type`; keep legacy `person.comment` read-only ABOVE the timeline.
    - Inline quick-edit of `name/phone/address` (and `tag` for clients): save via `updateClient` (operator-scoped) + toast; modal stays open and calls `onRefresh` on success; on failure show one error toast and retain entered values.
    - Order stats: show count (`orders.length`), total (`getOrderTotal(orders)`), and last-order date (max `created_at`; omit when no orders).
    - _Requirements: 2.8, 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 7.4, 8.4, 9.5_
    - _Covers: P10, P11_

  - [x]* 8.2 Property + component tests for detail modal
    - **P10: Order stats consistency** — for any generated orders, displayed total equals `getOrderTotal(orders)`, count equals `orders.length`, and last-order date equals max `created_at` (absent when none). Min 100 iterations.
    - **P11: Quick-edit persists through the repository** — for any valid name/phone/address/tag edit, values are saved via `updateClient` and the refreshed client reflects exactly the submitted values. Min 100 iterations.
    - Component (RTL): add-note input clears on submit and feed updates; quick-edit save keeps modal open and triggers `onRefresh`; failed save retains entered values + shows one toast.
    - _Requirements: 2.8, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 7.4_

  - [x] 8.3 Add convert action to `components/leads/leads-table.tsx` (and/or lead branch of detail modal)
    - Add "Mijozga aylantirish" action calling `useClients().convert(lead)`, then refetch leads and clients on success.
    - Disable the action when `lead.converted_client_id` is set or `lead.status === 'Mijozga aylandi'`.
    - _Requirements: 3.7, 3.9_
    - _Covers: P5_

  - [x]* 8.4 Component tests for convert action
    - Convert button disabled once `converted_client_id` is set / status is `'Mijozga aylandi'` (Req 3.7); successful convert triggers leads + clients refetch (Req 3.9).
    - _Requirements: 3.7, 3.9_

- [x] 9. Final checkpoint — full suite and traceability
  - Run the full Vitest suite (unit + 100-iteration property tests + RTL component tests) and type-check.
  - Verify every property P1–P12 has a passing test and every requirement clause is referenced by a task.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP, but the
  12 correctness properties are only validated when their `*` tasks are implemented.
- All new data access flows through `lib/data` (repository + hooks); no inline `supabase.from(...)`
  in components (Req 8.1).
- Property tests use fast-check with **min 100 iterations** and are tagged
  `Feature: client-management-enhancements, Property N: <text>`.
- **Sandbox cannot** run `npm install`, execute tests, or apply migrations — the user performs
  those steps where DB and package-registry access exist. Files here are authored and reviewed only.
- RLS / multi-tenant hardening is explicitly out of scope; migrations mirror the existing access
  posture and are never made weaker (Req 9.3).

### Property → Task coverage map

| Property | Implemented by | Tested by |
| --- | --- | --- |
| P1 Reverse-chronological notes | 3.1, 7.1 | 3.2 |
| P2 Whitespace rejection | 4.1 | 4.2 |
| P3 Timeline grows by one | 4.1, 7.1 | 4.2 |
| P4 Conversion re-points timeline | 3.4 | 3.5 |
| P5 Conversion idempotent | 3.4, 4.3, 8.3 | 3.5 |
| P6 Converted leads leave pipeline | 5.3 | 5.2 |
| P7 Staleness threshold | 5.1, 7.2 | 5.2, 7.3 |
| P8 No client delete in UI | 4.3, 7.2 | 7.3 |
| P9 Tag filter soundness | 7.2 | 7.3 |
| P10 Order stats consistency | 8.1 | 8.2 |
| P11 Quick-edit persists | 3.3, 8.1 | 8.2 |
| P12 Operator-scoped reads | 3.1 | 3.2 |
