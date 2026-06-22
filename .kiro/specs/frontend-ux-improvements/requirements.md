# Requirements Document

## Introduction

This feature introduces a cohesive frontend infrastructure layer for the Sellora Plus CRM (`crm-system`, a Next.js App Router + Supabase application) and applies it across the four entity tables (leads, clients, orders, follow-ups), the shared modals, and the dashboard. It replaces ad-hoc and inconsistent UX patterns surfaced in a code review: blocking `alert()` calls and silently swallowed errors, inconsistent loading/empty/error rendering, leaked `any` types, duplicated inline Supabase querying with disagreeing operator-scoping columns, un-keyed Fragment-wrapped list rows, a stale duplicate `patch/` directory, and missing success confirmations for create/update/delete actions.

The work delivers: an accessible, non-blocking toast notification system; a single declarative async-state rendering convention with shared empty/error components; a typed, centralized per-entity data-access layer built on the existing browser Supabase client and `useOperator()`; positive success confirmations and atomic UI state changes for mutations; elimination of `any` and corrected React keying in the affected components; and removal of dead code.

Scope is strictly frontend: `components/`, `app/(dashboard)`, `lib/` client helpers, and `types/`. The database authorization model — `supabase/migrations`, RLS policies, and the auth/session security model — is explicitly out of scope. The primary roles are the CRM Operator and Admin using the dashboard. These requirements are derived from the approved design document and remain traceable to its eight correctness properties.

## Glossary

- **CRM_System**: The Sellora Plus frontend application under change, comprising the entity tables, shared modals, dashboard widgets, and the new frontend infrastructure layer.
- **Toast_System**: The accessible, non-blocking notification mechanism (`ToastProvider`, `useToast`, `Toaster`) used for all error and success feedback.
- **Async_Content**: The shared rendering convention (`AsyncContent` plus `EmptyState` and `ErrorState`) that deterministically renders one of loading, error, empty, or data branches.
- **Data_Access_Layer**: The typed per-entity hooks (`useLeads`, `useClients`, `useOrders`, `useFollowUps`, `useEntityList`) and repository helpers that perform all reads and writes through the browser Supabase client.
- **Repository**: The typed query-builder module that maps Supabase responses into a `Result<T>` and applies the operator-scoping column in exactly one place.
- **Operator**: The CRM operator or admin, identified by the server-verified `operator.id` returned from `useOperator()` / `/api/auth/me`.
- **Operator_Id**: The string identifier `operator.id` used to scope reads and writes; an empty string indicates the operator has not yet resolved.
- **Scope_Column**: The single constant column name (`SCOPE_COLUMN`) used by the Repository to scope all reads to the operator.
- **Entity_Table**: One of the four data tables rendered in the dashboard — leads, clients, orders, follow-ups.
- **Mutation**: A create, update, or delete action (including order confirm and follow-up mark-done) issued through the Data_Access_Layer.
- **Result**: The discriminated union `{ ok: true; data: T } | { ok: false; error: string }` returned by every Repository function.

## Requirements

### Requirement 1: Unified, accessible toast notification system

**User Story:** As an Operator, I want all feedback delivered through consistent, non-blocking, accessible notifications, so that I am informed of outcomes without my workflow being interrupted by blocking dialogs.

#### Acceptance Criteria

1. THE CRM_System SHALL deliver all error and success feedback through the Toast_System.
2. WHEN any create, update, or delete outcome occurs, THE CRM_System SHALL surface feedback through the Toast_System rather than through a blocking browser alert.
3. WHEN a toast is displayed, THE Toast_System SHALL render the toast with an ARIA live region so that assistive technologies announce the message.
4. WHEN an error toast is displayed, THE Toast_System SHALL announce the message with assertive live-region politeness.
5. WHEN a toast is displayed with a positive duration, THE Toast_System SHALL begin automatic dismissal of the toast after the configured duration elapses, allowing brief delays to complete dismissal animations.
6. WHEN an Operator activates a toast close control, THE Toast_System SHALL dismiss the targeted toast.
7. THE Toast_System SHALL limit the number of simultaneously visible toasts to the configured maximum.
8. WHERE the dashboard or admin layout is rendered, THE CRM_System SHALL mount the Toast_System once so that toasts are available throughout the dashboard tree.

### Requirement 2: Consistent loading, empty, and error rendering

**User Story:** As an Operator, I want data views to clearly and consistently communicate loading, empty, and error states, so that I always understand what the interface is doing and can recover from failures.

#### Acceptance Criteria

1. THE Async_Content SHALL render exactly one of the loading, error, empty, or data branches for any given state.
2. THE Async_Content SHALL apply branch precedence in the order loading, then error, then empty, then data.
3. WHILE a data view reports a loading state, THE Async_Content SHALL render the loading indicator.
4. IF a data view reports a non-null error, THEN THE Async_Content SHALL render the error state including the error message and a retry control.
5. WHEN an Operator activates the retry control, THE Async_Content SHALL invoke the supplied retry handler.
6. WHILE a data view reports no error and an empty data set, THE Async_Content SHALL render the empty state.
7. WHEN a loading state transitions to not-loading, THE Async_Content SHALL render the error, empty, or data branch and SHALL NOT render the loading indicator.

### Requirement 3: Errors are never silent

**User Story:** As an Operator, I want every failed load and failed action to produce a visible explanation, so that failures are never silently swallowed.

#### Acceptance Criteria

1. IF a data load fails, THEN THE CRM_System SHALL both display exactly one error toast and set the corresponding view error state to a non-null value.
2. IF a Mutation fails, THEN THE CRM_System SHALL display exactly one error toast.
3. WHEN the Data_Access_Layer receives a failed Supabase response, THE Data_Access_Layer SHALL convert the failure into a Result with `ok` equal to false and a descriptive error message.

### Requirement 4: Typed, centralized data-access layer

**User Story:** As a developer maintaining the CRM, I want a single typed data-access layer for all reads and writes, so that inline Supabase duplication is removed and data handling is consistent and testable.

#### Acceptance Criteria

1. THE CRM_System SHALL route all reads and writes for leads, clients, orders, and follow-ups through the Data_Access_Layer.
2. THE Entity_Table components and shared modals SHALL NOT call the Supabase client directly once migration of a given component to the Data_Access_Layer is complete.
3. WHILE a given component is being migrated to the Data_Access_Layer, THE CRM_System SHALL permit that component to retain direct Supabase calls until its migration is complete.
4. THE Repository SHALL return a Result for every read and write operation.
5. THE Data_Access_Layer SHALL expose typed per-entity hooks for leads, clients, orders, and follow-ups built on the existing browser Supabase client and the Operator identity from `useOperator()`.

### Requirement 5: Consistent operator scoping

**User Story:** As an Operator, I want data queries scoped consistently to my operator identity, so that the views I see are correct and the scoping logic is maintained in one place.

#### Acceptance Criteria

1. THE Repository SHALL apply the Scope_Column equality filter using the Operator_Id to every read operation.
2. THE Repository SHALL define the Scope_Column as a single shared constant used by all read operations.
3. IF the Operator_Id is an empty string, THEN THE Data_Access_Layer SHALL NOT execute the query.
4. WHEN the Operator identity resolves to a non-empty Operator_Id, THE Data_Access_Layer SHALL load the entity data for that Operator.
5. IF the Operator identity resolution fails, THEN THE Data_Access_Layer SHALL set a non-null error state and display an error toast.

### Requirement 6: Success confirmation and mutation atomicity

**User Story:** As an Operator, I want clear confirmation when an action succeeds and no partial UI changes when it fails, so that the interface always reflects the true outcome of my actions.

#### Acceptance Criteria

1. WHEN a create, update, or delete Mutation succeeds, THE CRM_System SHALL display a success toast.
2. WHEN a Mutation succeeds, THE CRM_System SHALL update the local view state to reflect the change exactly once.
3. IF a Mutation fails, THEN THE CRM_System SHALL leave the local view state unchanged.
4. WHEN a form modal submission succeeds, THE CRM_System SHALL close the modal.
5. IF a form modal submission fails, THEN THE CRM_System SHALL keep the modal open and display an error toast.

### Requirement 7: Stable, unique React keys for list rows

**User Story:** As a developer, I want list rows including expandable Fragment-wrapped groups to use correct unique keys, so that React rendering is correct and free of key warnings.

#### Acceptance Criteria

1. THE CRM_System SHALL assign a unique, stable key derived from the row identifier to each mapped list element, including Fragment-wrapped sibling-row groups.
2. WHERE two rendered rows are distinct, THE CRM_System SHALL assign distinct keys to those rows.
3. THE CRM_System SHALL key the wrapping Fragment of an expandable row group rather than relying on keys placed only on inner row elements.

### Requirement 8: Type soundness in entity tables and shared modals

**User Story:** As a developer, I want strongly typed data components, so that rendered data is type-checked and `any` no longer leaks through the codebase.

#### Acceptance Criteria

1. THE CRM_System SHALL represent every rendered row in the four entity tables and shared modals as one of the typed models Lead, Client, Order, or FollowUp.
2. THE four entity tables and shared modals SHALL NOT use the `any` type for rendered data.
3. WHERE an aggregate or presentation value is derived from rendered rows, THE CRM_System SHALL compute the value through a typed helper.

### Requirement 9: Consistent button states and dialog focus management

**User Story:** As an Operator, I want buttons to reflect their loading state and dialogs to manage focus consistently, so that I cannot trigger duplicate submissions and dialogs behave predictably.

#### Acceptance Criteria

1. WHILE a submit or asynchronous row action is in progress, THE CRM_System SHALL disable the triggering control and display a loading indicator on that control, where disabling the control is the binding constraint that prevents duplicate submission.
2. WHEN a destructive action is requested, THE CRM_System SHALL request confirmation through the existing confirmation dialog rather than a raw browser confirm.
3. WHEN a form modal opens, THE CRM_System SHALL place initial focus on the primary input field.
4. WHEN a dialog closes, THE CRM_System SHALL restore focus to the element that was focused before the dialog opened.

### Requirement 10: Code hygiene and scope guardrails

**User Story:** As a developer, I want dead code removed and the change kept within frontend boundaries, so that the codebase stays maintainable and the backend security model is untouched.

#### Acceptance Criteria

1. THE CRM_System SHALL remove the stale `patch/` directory once no references to it remain.
2. THE CRM_System SHALL confine all changes to the frontend surfaces `components/`, `app/(dashboard)`, `lib/` client helpers, and `types/`.
3. THE CRM_System SHALL NOT modify `supabase/migrations`, RLS policies, or the auth/session security model.
4. THE CRM_System SHALL reuse the existing `components/ui` primitives and Tailwind design tokens for new interface elements.
5. THE CRM_System SHALL NOT introduce a heavy new user-interface framework.
