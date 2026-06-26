---
name: krds-lean-implementation
description: Prefer the smallest safe change when working in KRDS. Use for requests to simplify implementations, avoid new dependencies, replace custom behavior with native platform features, reduce diff size, or challenge whether a new abstraction is necessary in KRDS pages, API handlers, CLI scripts, and tests. Keep accessibility, CSP/security, and required validation intact.
---

# KRDS Lean Implementation

## Overview

Apply Ponytail-style minimalism to KRDS without importing Ponytail's full always-on behavior. Prefer deleting code, using native browser or platform features, and reusing existing repo patterns before adding helpers, abstractions, or dependencies.

Typical triggers:

- "Can we do this without a package?"
- "Keep the diff small."
- "Make this simpler."
- "Do we need this abstraction?"
- "Can this use native browser features instead?"

## Decision Ladder

Use the first option that safely solves the task:

1. Delete or reuse code before adding anything.
   - Remove dead branches, duplicate DOM work, or redundant wrappers.
   - Reuse an existing helper if it already matches the problem closely.
2. Prefer native browser or platform features.
   - Favor semantic HTML, built-in form controls, `<details>`, `<dialog>`, browser validation, and standard DOM APIs before custom widgets.
   - Favor Node or platform built-ins before adding packages for server or CLI work.
3. Prefer existing KRDS patterns over new abstractions.
   - Reuse conventions already present in `shared/`, existing DOM wiring, and current validation patterns.
   - Add a new helper only after repeated need is visible in files you are already touching.
4. Add the minimum new code that closes a real gap.
   - Keep the diff narrow.
   - Keep the number of touched files low when that does not hide risk.
   - Avoid new dependencies unless the user explicitly wants one or native options clearly fail.

## KRDS Non-Negotiables

- Preserve accessibility.
  - Keep keyboard access, focus handling, ARIA state, reduced-motion behavior, and minimum touch target expectations intact.
- Preserve CSP and DOM safety.
  - Do not add inline event handlers.
  - Do not introduce dynamic `innerHTML` when DOM APIs or `textContent` are the safer pattern.
- Preserve the established visual language.
  - Simplify implementation, not the product's intentional UX.
  - Do not flatten existing KRDS styling into generic boilerplate when the task is visual or editorial.
- Preserve resilience.
  - Do not remove validation, fallback states, rate limiting, or defensive checks just to shorten code.
- Preserve review quality.
  - When reviewing code, treat complexity concerns as secondary to bugs, regressions, and missing tests.

## KRDS-Specific Guidance

- For static pages and vanilla JS files, prefer straightforward DOM code over framework-like helper layers.
- For API handlers and server code, prefer existing validation and error shapes over clever abstractions.
- For content-heavy pages, preserve public-sector tone and content structure before chasing code elegance.
- For frontend tasks that explicitly ask for a bold redesign or stronger visual direction, this skill should yield to the design brief rather than forcing minimal visuals.

## Validation

- Run `node --check` on any edited JS file.
- Run targeted `pnpm vitest run ...` coverage for touched tested modules such as API handlers, `server.js`, or `krds-lint.js`.
- When changing HTML or DOM behavior, verify that required nodes, CSP expectations, and keyboard behavior still hold.
- If behavior is user-visible and easy to exercise locally, serve the site and smoke-test the changed path instead of assuming.
- For KRDS-specific forward tests and comparison prompts, read `references/krds-forward-tests.md`.

## Stop Conditions

Do not force this skill when:

- The user explicitly wants a broader architecture, a new subsystem, or a more expressive UI direction.
- The safest solution is larger than the smallest diff.
- Simplification would obscure business logic, weaken maintainability, or remove intentional product behavior.
