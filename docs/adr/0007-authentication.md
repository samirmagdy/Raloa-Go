# ADR-0007: Firebase Auth for identity

- Status: Accepted
- Date: 2026-09-27

## Context

The platform already uses Firebase Auth and needs email/password, social providers, sessions, and token verification without making application authorization provider-specific.

## Decision

Firebase Auth establishes identity. The backend resolves account, workspace, tenant/site ownership, roles, permissions, and entitlements through its centralized authorization policy.

## Alternatives

Build a custom credential system, adopt another hosted identity provider, or let Firestore rules be the application authorization model.

## Tradeoffs

Firebase reduces credential/security implementation but adds provider dependency and configuration coupling. Separating identity from authorization keeps business policy portable and testable.

## Migration impact

Persist stable external auth IDs, keep application resources keyed by internal ownership, and route provider operations through adapters. Raw tokens never reach frontend business services.

## Reversal strategy

Keep the application authorization contract stable, add a second identity adapter, dual-verify during migration, and switch identity providers without changing domain resource ownership.
