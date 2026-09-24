# User Flow Matrix

Use this template when auditing or implementing a website journey. Keep one row per meaningful transition, not one row per component.

| Field | What to record |
| --- | --- |
| Journey | Signup, publish, checkout, upload, referral, domain, etc. |
| Actor | Anonymous, owner, paid user, admin, RTL user, keyboard user, etc. |
| Entry points | Route, deep link, CTA, notification, browser back, refresh. |
| Intent | What the user believes will happen. |
| Preconditions | Auth, plan, ownership, required data, network, permissions. |
| Transition | Click, submit, drag, upload, callback, redirect, webhook, etc. |
| Pending state | Immediate feedback, disabled duplicate action, progress, cancellation. |
| Success state | Persisted result, URL/state change, confirmation, next action. |
| Failure states | Validation, auth, permission, network, server, duplicate, timeout, payment. |
| Recovery | Retry, edit, cancel, resume, contact support, safe fallback. |
| Persistence | What survives refresh, back, logout, reconnect, or a second device. |
| Accessibility | Name, focus, keyboard path, announcement, target size, contrast. |
| Responsive/RTL | Narrow layout, touch behavior, ordering, direction, truncation. |
| Evidence | File, route, test, screenshot, or API response. |
| Severity | P0, P1, or P2. |

## Completion gate

Mark a journey complete only when all of these are true:

- The user can enter from every supported entry point.
- The primary action has a visible pending state.
- Invalid input is explained beside the correction target.
- Server rejection and network failure preserve recoverable input.
- Success is reflected in persisted state, not only local UI state.
- Refresh, browser Back, and a direct URL do not create a contradictory state.
- Unauthorized users cannot reach protected mutations by changing client state.
- Keyboard and touch paths reach the same outcome.
- Mobile and RTL layouts do not hide the next action or error.
- Analytics events, if present, fire once at the correct transition.
- A test or documented manual procedure proves the result.
