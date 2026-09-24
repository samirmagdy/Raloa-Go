---
name: user-flow-integrity
description: Audit and repair website user journeys across visitor, authenticated, paid, mobile, keyboard, RTL, error, and recovery states. Use when a site must be checked for logical flow, dead ends, confusing transitions, or incomplete state handling.
---

# User Flow Integrity

Make the website predictable and complete for real users. Review the whole journey, not only the happy-path screen. Preserve the product's stated scope, URL structure, analytics contracts, legal copy, and authorization boundaries unless the user explicitly asks to change them.

## Operating mode

Start with a one-line read of the product, audience, and primary conversion or task. Then declare whether this is an audit-only request or an implementation request. For an audit, do not modify code. For an implementation, fix the underlying shared cause before applying local polish.

Do not promise “perfect” behavior without evidence. Define completion as: every supported entry point has a clear next action, every async action has loading/success/error states, every failure has a recovery path, and the state remains coherent after refresh, back navigation, deep linking, permission changes, and localization.

## Required workflow

### 1. Map the product before changing it

Inspect routes, route resolution, navigation actions, forms, modal triggers, API calls, persistence, auth gates, billing gates, uploads, publishing, and redirects. Build a route and state inventory from the code instead of assuming the screenshot represents the whole product.

Identify the actors that matter:

- anonymous visitor;
- newly registered user;
- signed-in user with incomplete setup;
- paid user and downgraded user;
- owner versus non-owner;
- mobile, desktop, keyboard-only, screen-reader, RTL, and reduced-motion users;
- slow, offline, expired-session, denied-permission, and failed-payment users.

Read [references/flow-matrix.md](references/flow-matrix.md) when creating the inventory or reporting results.

### 2. Model each critical journey as states and transitions

For every primary flow, write:

`entry -> intent -> input -> validation -> request -> pending -> success -> next state`

Then explicitly add:

`invalid input`, `unauthorized`, `expired session`, `network failure`, `server rejection`, `duplicate submission`, `cancel`, `back`, `refresh`, and `retry`.

A button is not a completed flow. Verify what changes in the URL, client state, server record, visible UI, and analytics event after activation. A success message that does not persist after refresh is not success.

### 3. Audit transitions, not just components

For each transition, check:

- Is the action label accurate and does it match the destination?
- Is the user told what is happening within 100 ms of an async action?
- Is duplicate submission prevented without disabling recovery?
- Is the error attached to the field or action that caused it?
- Can the user retry without losing valid input?
- Does cancel return to the prior stable state?
- Does browser Back return to the expected state rather than closing unrelated UI?
- Does a direct URL load the same state as in-app navigation?
- Is persistence server-authoritative where ownership, payment, referral, publishing, or permissions are involved?
- Are loading, empty, success, partial-success, and error states visually distinct?

### 4. Check all perspectives

Run the same journeys at 320, 375, 430, 768, 1024, 1280, and 1440px when a browser is available. Test light and dark themes, Arabic RTL, reduced motion, keyboard-only navigation, focus return, screen-reader names, slow network, offline recovery, and expired authentication.

For touch interfaces, interactive targets should be at least 44 by 44 CSS pixels unless there is a documented exception. For keyboard users, every action must be reachable, visibly focused, and operable without hover. For screen readers, dialogs need a name, focus containment, Escape behavior, and focus restoration. For RTL, verify logical order, icon direction, truncation, and validation placement rather than only flipping text alignment.

### 5. Fix shared causes first

Prefer one fix at the source of repeated failures:

- one route/state resolver instead of page-specific URL assumptions;
- one async request state model instead of unrelated loading flags;
- one auth and permission gate instead of client-only visibility checks;
- one modal accessibility hook instead of per-dialog variants;
- one image fallback and loading contract instead of broken-image patches;
- one section observer or navigation registry instead of multiple scroll listeners;
- one capability definition shared by UI, server, billing, and persistence;
- one error taxonomy with user-safe copy and developer diagnostics.

Do not hide layout failures with global `overflow-x: hidden`, swallow errors, add arbitrary timeouts, or report success before the server confirms the mutation. Do not invent unsupported product capabilities to make a flow appear complete.

### 6. Verify the repaired flow

Run the repository's existing lint, typecheck, build, unit, integration, and route tests. Add focused tests for every repaired state transition where the codebase has a test pattern. If browser tooling is unavailable, say so explicitly and provide a manual viewport matrix instead of claiming visual verification.

For risky actions such as payment, deletion, publishing, domain changes, referrals, or permission changes, verify idempotency, refresh behavior, duplicate requests, and rollback or cancellation behavior. Never use live external services for testing without explicit authorization.

## Deliverable

For an audit, produce a prioritized flow matrix with route/component evidence, severity, user impact, root cause, and recommended fix. For implementation, report:

1. journeys audited;
2. root causes fixed;
3. states and recovery paths added;
4. files changed;
5. commands and tests run;
6. remaining limitations, especially browser, external-service, or production-state verification.

Use P0 for blocked, unsafe, data-loss, payment, auth, or inaccessible flows; P1 for broken completion, misleading state, or major responsive failure; P2 for friction and polish. Do not label a flow complete until its error and recovery states are handled.

## Boundaries

This skill reviews product journeys and interaction logic. It does not replace a dedicated visual-design, SEO, Firebase-security, billing, or deployment skill. Invoke those skills when their specialized checks are required, and keep their scope explicit.
