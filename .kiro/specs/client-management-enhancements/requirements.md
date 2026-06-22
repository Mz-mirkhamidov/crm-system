# Requirements Document

## Introduction

This document specifies the requirements for **Client Management Enhancements** in the Sellora
Plus CRM, derived from the approved design document. The feature transforms the client record
from a flat row with a single overwrite `comment` field into a richer, contact-centric workspace
inspired by amoCRM. It delivers seven capabilities:

1. Removal of client deletion from the UI (clients become non-destructive historical records).
2. A timestamped notes/activity timeline per client, shared generically with leads.
3. One-click lead → client conversion that preserves the notes timeline.
4. Client tags/segments with display and filtering consistent with leads.
5. Inline quick-edit of client name/phone/address/tag in the detail modal.
6. A last-contacted / stale indicator in the clients table.
7. Client order statistics surfaced in the detail modal.

The work is additive at the backend (migrations `007_notes.sql` and `008_client_enrichment.sql`)
and reuses the existing typed data-access layer (`lib/data`), operator-scoping convention
(`SCOPE_COLUMN` / `useOperator`), toast system, and `AsyncContent` infrastructure. **RLS / multi-tenant
hardening is explicitly out of scope** and is tracked separately; new database objects mirror the
existing access posture and are never made weaker. The legacy `clients.comment` field is retained
for backward compatibility. The roles addressed are the CRM **operator** and **admin**.

Each requirement below is annotated with the design **correctness properties** it supports, so the
12 properties remain fully traceable to acceptance criteria.

## Glossary

- **CRM_System**: The Sellora Plus CRM application as a whole.
- **Operator**: An authenticated CRM user (operator or admin) whose `operators.id` is used as the
  scope value stored in `user_id`.
- **Clients_Table**: The `components/clients/clients-table.tsx` view that lists clients.
- **Client_Detail_Modal**: The `PersonDetailModal` (`components/shared/detail-modal.tsx`) rendering
  a single client's or lead's details.
- **Leads_Table**: The `components/leads/leads-table.tsx` view that lists leads.
- **Notes_Timeline**: The notes/activity feed and its controlling hook (`useNotes`), backed by the
  generic `notes` table.
- **Conversion_Service**: The repository/hook flow implementing `convertLeadToClient`.
- **Repository**: The data-access layer (`lib/data/repository.ts`); the only place that calls
  `supabase.from(...)` and applies `SCOPE_COLUMN`.
- **SCOPE_COLUMN**: The scoping column `"user_id"` set to the Operator's id on every read and write.
- **Note**: A timestamped record `{ id, user_id, source_type, source_id, body, created_at, updated_at }`.
- **CLIENT_STALE_DAYS**: The staleness threshold constant (7 days) used by `getClientStaleness`.
- **DEFAULT_TAGS**: The existing preset tag list reused for client tags.
- **Mijozga aylandi**: The lead status meaning "converted to client".

## Requirements

### Requirement 1: Remove Client Deletion From the UI

**User Story:** As a CRM operator, I want clients to be non-deletable from the UI, so that client
records remain as permanent historical records in the amoCRM style.

_Supports design Property 8 (Clients are not deletable from the UI)._

#### Acceptance Criteria

1. THE Clients_Table SHALL render each client row without a delete control.
2. THE Clients_Table SHALL omit the destructive deletion confirmation dialog for clients.
3. WHERE a client record exists, THE CRM_System SHALL retain it as a non-destructive record that
   remains accessible from the UI.
4. WHERE deletion is performed by a backend or admin process outside the client UI, THE CRM_System
   SHALL permit the removal while the client UI remains non-destructive.

### Requirement 2: Notes / Activity Timeline

**User Story:** As a CRM operator, I want to add timestamped notes to a client (and to leads using
the same mechanism), so that I can maintain a chronological activity history.

_Supports design Properties 1 (reverse-chronological), 2 (empty rejection), 3 (grows by one), and
12 (operator-scoped reads)._

#### Acceptance Criteria

1. WHEN an Operator submits a note with a non-empty body for a client or lead, THE Notes_Timeline
   SHALL create a timestamped Note and add it to the timeline.
2. WHEN a Note is successfully added, THE Notes_Timeline SHALL increase the timeline length by
   exactly one and include the new Note.
3. IF an Operator submits a note body that consists solely of whitespace, THEN THE Notes_Timeline
   SHALL reject the submission and leave the timeline unchanged.
4. THE Notes_Timeline SHALL order displayed Notes by `created_at` in descending order, newest first.
5. WHEN an Operator requests the Notes for a source, THE Repository SHALL return only Notes whose
   `user_id` equals that Operator's id.
6. WHERE the note source is a lead, THE Notes_Timeline SHALL store the Note with `source_type`
   `'lead'` and `source_id` equal to the lead's id, using the shared generic timeline.
7. WHEN a Note is successfully added for a client, THE Notes_Timeline SHALL update that client's
   `last_contacted_at` timestamp.
8. WHEN a note submission succeeds, THE Client_Detail_Modal SHALL clear the note input field.
9. IF a Notes read fails, THEN THE Client_Detail_Modal SHALL display the error state and an error
   toast, and SHALL provide a retry action.

### Requirement 3: Lead → Client Conversion

**User Story:** As a CRM operator, I want to convert a lead into a client with one click, so that an
interested lead becomes a managed client while its history is preserved.

_Supports design Properties 4 (re-points the full timeline), 5 (idempotent), and 6 (converted leads
leave the active pipeline)._

#### Acceptance Criteria

1. WHEN an Operator triggers conversion on a lead, THE Conversion_Service SHALL create a client from
   the lead's name, phone, address, comment, and tag, scoped to the Operator.
2. WHEN a lead is converted, THE Conversion_Service SHALL re-point the lead's entire Notes timeline
   to the created client so that the client's timeline contains exactly those Notes and the lead
   retains none.
3. WHEN a lead is converted, THE Conversion_Service SHALL set the lead's status to `'Mijozga aylandi'`
   and set `converted_client_id` to the created client's id.
4. WHEN a conversion succeeds, THE Conversion_Service SHALL set the created client's
   `last_contacted_at` to the conversion time.
5. IF a lead already has `converted_client_id` set, THEN THE Conversion_Service SHALL return the
   existing client without creating a second client and without duplicating Notes.
6. WHILE a lead has status `'Mijozga aylandi'`, THE CRM_System SHALL exclude that lead from the
   active and cold-lead pipeline filters.
7. WHERE a lead's `converted_client_id` is set (conversion has completed), THE Leads_Table SHALL
   disable the convert action.
8. IF the client insert during conversion fails, THEN THE Conversion_Service SHALL return an error
   and perform no Notes re-point or lead update.
9. WHEN a conversion succeeds, THE CRM_System SHALL refresh the leads and clients lists.

### Requirement 4: Client Tags / Segments

**User Story:** As a CRM operator, I want to tag and segment clients and filter by tag, so that I can
organize clients consistently with how lead tags work today.

_Supports design Property 9 (tag filter soundness)._

#### Acceptance Criteria

1. THE Clients_Table SHALL display a tag for each client consistent with the lead tag display.
2. THE Clients_Table SHALL provide a tag filter seeded from DEFAULT_TAGS plus any tags present in the
   loaded clients.
3. WHERE a tag filter value other than "all" is selected, THE Clients_Table SHALL display only
   clients whose `tag` equals the selected value exactly, hiding clients without that exact tag.
4. WHERE the tag filter value is "all", THE Clients_Table SHALL display all clients regardless of
   their tag value.
5. THE client add and edit form SHALL provide a tag selection control.

### Requirement 5: Inline Quick-Edit of Client Details

**User Story:** As a CRM operator, I want to inline-edit a client's name, phone, address, and tag in
the detail modal, so that I can update details quickly without a separate flow.

_Supports design Property 11 (quick-edit persists through the repository)._

#### Acceptance Criteria

1. WHEN an Operator saves an inline edit of a client's name, phone, address, or tag, THE
   Client_Detail_Modal SHALL persist the submitted values through `updateClient` scoped to the
   Operator.
2. WHEN a quick-edit save succeeds, THE Client_Detail_Modal SHALL reflect exactly the submitted
   values and SHALL remain open.
3. WHEN a quick-edit save succeeds, THE Client_Detail_Modal SHALL trigger a refresh of the client
   data.
4. IF a quick-edit save fails or does not complete successfully, THEN THE Client_Detail_Modal SHALL
   display an error toast and SHALL retain the entered values.

### Requirement 6: Last-Contacted and Stale Indicator

**User Story:** As a CRM operator, I want a last-contacted and stale indicator on clients, so that I
can see which clients need attention, mirroring the leads cold banner.

_Supports design Property 7 (client staleness threshold)._

#### Acceptance Criteria

1. THE Clients_Table SHALL display a per-client staleness indicator derived from
   `getClientStaleness`.
2. THE `getClientStaleness` function SHALL report `stale = true` if and only if the number of whole
   days since the effective last-contact timestamp is at least CLIENT_STALE_DAYS.
3. WHERE a client's `last_contacted_at` is null, THE `getClientStaleness` function SHALL use the
   client's `created_at` as the effective last-contact timestamp.
4. WHILE one or more clients are stale, THE Clients_Table SHALL display a "needs attention" banner
   mirroring the leads cold banner.

### Requirement 7: Client Order Statistics

**User Story:** As a CRM operator, I want to see a client's order statistics in the detail modal, so
that I understand their purchase history at a glance.

_Supports design Property 10 (order stats consistency)._

#### Acceptance Criteria

1. WHEN the Client_Detail_Modal displays a client's orders, THE Client_Detail_Modal SHALL show an
   order total equal to `getOrderTotal(orders)`.
2. WHEN the Client_Detail_Modal displays a client's orders, THE Client_Detail_Modal SHALL show an
   order count equal to `orders.length`.
3. WHEN a client has one or more orders, THE Client_Detail_Modal SHALL show a last-order date equal
   to the maximum `created_at` among those orders.
4. IF a client has no orders, THEN THE Client_Detail_Modal SHALL omit the last-order date.

### Requirement 8: Layered Data Access and Operator Scoping

**User Story:** As a CRM developer, I want all new data access to flow through `lib/data` with
operator scoping, so that the layered architecture and the existing security posture are preserved.

_Supports design Property 12 (reads stay operator-scoped) and the data-access non-functional
constraints._

#### Acceptance Criteria

1. THE CRM_System SHALL perform all client, lead, and notes data access through the `lib/data`
   repository and hook layers, with no inline `supabase.from(...)` calls in components.
2. WHEN the Repository inserts a Note, THE Repository SHALL set both `user_id` and `operator_id` to
   the Operator's id.
3. WHEN the Repository reads Notes, THE Repository SHALL filter by SCOPE_COLUMN equal to the
   Operator's id.
4. THE CRM_System SHALL reuse the existing toast and `AsyncContent` infrastructure and the existing
   UI primitives for all new client-management UI.
5. WHEN a Repository mutation fails, THE CRM_System SHALL surface the failure through exactly one
   toast.

### Requirement 9: Additive Migrations and Backward Compatibility

**User Story:** As a CRM developer, I want backend changes to be additive and backward-compatible, so
that existing data and the access posture are preserved while RLS hardening remains a separate effort.

_Supports the additive-migration and backward-compatibility non-functional constraints, and underpins
Properties 1–12 that depend on the new schema._

#### Acceptance Criteria

1. THE CRM_System SHALL introduce a generic `notes` table via migration `007_notes.sql`, with
   `source_type` constrained to `'lead'` or `'client'`.
2. THE CRM_System SHALL add `clients.tag`, `clients.last_contacted_at`, `leads.converted_client_id`,
   and the `'Mijozga aylandi'` lead status via migration `008_client_enrichment.sql`.
3. THE new database objects SHALL mirror the existing tables' access posture (anon GRANT, RLS
   disabled, `updated_at` trigger) and SHALL be no less safe than the existing tables.
4. THE migration `008_client_enrichment.sql` field additions SHALL be independently applicable and
   SHALL NOT depend on the `notes` table from `007_notes.sql` being created first.
5. THE CRM_System SHALL retain the legacy `clients.comment` field for backward compatibility and
   SHALL display it read-only above the Notes timeline.
