# Bugfix Requirements Document

## Introduction

Sellora Plus CRM authenticates users with a session cookie (`crm_op_session`) whose value is nothing more than the base64 encoding of the operator object (`{ id, name, phone, role }`). The cookie is neither signed nor encrypted, and the middleware that guards every route trusts the decoded contents as-is. As a result, any visitor can hand-craft a cookie that claims `role: "admin"` (or any other operator `id`) and obtain elevated, unauthenticated access to the application — a classic **authentication bypass / privilege escalation** defect.

This bug is critical because it defeats all route protection: an attacker needs no valid credentials, only knowledge of the cookie name and the trivially-reversible encoding. Related weaknesses compound the risk — login credentials and an owner identifier are hardcoded in source, password hashing uses a single static global salt with a fast hash, and two competing authentication mechanisms coexist, producing inconsistent enforcement.

This bugfix is scoped to the **session/authentication security defect**: making sessions tamper-proof and server-validated, removing hardcoded secrets, strengthening password hashing, and consolidating enforcement onto a single trusted path. Broader backend/frontend improvements requested for the CRM may be addressed in subsequent specs.

The bug condition `C(X)` is: *a request presents session state (the `crm_op_session` cookie) that was not issued and integrity-protected by the server, yet the system treats it as a valid authenticated identity (including its `role` and `id`).*

## Bug Analysis

### Current Behavior (Defect)

What currently happens when the bug is triggered:

1.1 WHEN a request presents a `crm_op_session` cookie whose value decodes to JSON with an `id` and `role`, THEN the system trusts the decoded `role` and `id` without verifying any cryptographic signature, encryption, or server-side validation of the session.

1.2 WHEN an actor hand-crafts a cookie containing `role: "admin"`, THEN the system grants administrator access (routes the request to `/admin` and serves admin-only pages) even though the actor never authenticated as an admin.

1.3 WHEN an actor hand-crafts a cookie containing an arbitrary `id` and `role: "operator"`, THEN the system accepts the forged identity and treats subsequent requests as that operator, enabling impersonation of any operator.

1.4 WHEN the application is built and deployed, THEN valid login credentials and a fixed owner identifier are present in source code (hardcoded secrets), so anyone with read access to the source can authenticate or impersonate the owner.

1.5 WHEN a user password is hashed, THEN the system applies a fast hash with a single static, application-wide salt and no per-user salt, leaving stored hashes weak against precomputation and offline cracking.

1.6 WHEN a route is accessed, THEN enforcement may rely on either of two parallel/competing authentication mechanisms, producing inconsistent and unreliable access control.

### Expected Behavior (Correct)

What should happen instead (each clause corresponds to the same-numbered defect above):

2.1 WHEN a request presents a `crm_op_session` cookie, THEN the system SHALL verify the session's integrity and authenticity server-side (e.g., a signed and/or encrypted token validated against a server-held secret) before trusting any of its contents, and SHALL reject any session that fails verification by treating the request as unauthenticated.

2.2 WHEN an actor presents a forged or tampered cookie claiming `role: "admin"`, THEN the system SHALL reject it and deny admin access, redirecting the request to the login flow rather than serving admin pages.

2.3 WHEN an actor presents a forged or tampered cookie with an arbitrary `id` and/or `role: "operator"`, THEN the system SHALL reject it and SHALL NOT establish or act upon the forged identity, preventing impersonation.

2.4 WHEN the application is built and deployed, THEN credentials, signing/encryption keys, and any owner identifier SHALL be sourced from secure configuration (environment variables / secret storage) and SHALL NOT be hardcoded in source.

2.5 WHEN a user password is hashed, THEN the system SHALL use a strong, slow, salted password-hashing scheme with a unique per-user salt (e.g., bcrypt/scrypt/Argon2 performed server-side), making stored hashes resistant to offline attacks.

2.6 WHEN any protected route is accessed, THEN access control SHALL be enforced through a single authoritative, server-validated session mechanism so that enforcement is consistent across the application.

### Unchanged Behavior (Regression Prevention)

Existing behavior that must be preserved:

3.1 WHEN an operator logs in with valid credentials, THEN the system SHALL CONTINUE TO issue a session and route them to `/dashboard`.

3.2 WHEN an admin logs in with valid credentials, THEN the system SHALL CONTINUE TO issue a session and route them to `/admin`.

3.3 WHEN a legitimately authenticated operator attempts to access an `/admin` route, THEN the system SHALL CONTINUE TO block the request and redirect to `/dashboard`.

3.4 WHEN a request has no session (or an invalid one), THEN the system SHALL CONTINUE TO redirect to `/login`, while leaving `/login` and `/register` publicly accessible.

3.5 WHEN a login attempt is made for an account that is pending approval or blocked, THEN the system SHALL CONTINUE TO reject the login with the appropriate message ("pending" / "blocked").

3.6 WHEN an authenticated user visits the root path or the login page, THEN the system SHALL CONTINUE TO redirect them to `/admin` or `/dashboard` according to their (now verified) role.
