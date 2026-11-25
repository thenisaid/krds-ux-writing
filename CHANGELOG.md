# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- **PR lint gate now fails only on errors the PR introduces** (`.github/workflows/krds-lint.yml`): previously any error in a changed file failed CI, so editing one line of an old document charged the PR with every pre-existing error in it (e.g. an unrelated PR with 0 new errors failed with 1,353). The gate now lints each changed file at the PR head and at `origin/<base>`, groups errors by `(category, match)` and compares the multisets (line numbers are ignored; a decrease in one key never offsets an increase in another). Any excess is a new error and fails the check. New files count all errors as new. Renamed files are compared against their old path.
- Fail-closed is kept and extended: if the base-side lint fails, cannot be parsed, or the base ref is missing, the file is reported as a failure instead of being treated as "0 base errors".
- PR comment and step summary now show per-file existing/new counts and list only the new errors. `workflow_dispatch` (full / `target_file`) keeps the old absolute-total behaviour because there is no base to compare with.

- **Home (`index.html`) header tabs and mobile menu unified (D4)**: the 7 desktop tabs are replaced by the generated `gnb` marker region (4 primary tabs: 원칙·사전·사례·도구, no current-location tab, no secondary tabs) and the old `#mobileMenu` panel by the shared hamburger drawer (`shared/drawer.css` + `shared/gnb-desktop.css` + `shared/drawer.js`, no `nav.js`). `script.js` loses the mobile-menu code (`openMobileMenu`·`closeMobileMenu`·`toggleMobileMenu`·`setMobileMenuButtonState`·`trapFocus`·`releaseFocus`·`closestIfPossible` and their wiring); drawer open/close is now `drawer.js`. The breakpoint for the home page moves from 768px to 900px, so the tabs are replaced by the hamburger between 769 and 900px too. The external link "KRDS 공식 사이트 ↗" is no longer in the mobile menu (the footer and the body keep the same link). `node scripts/sync-site-nav.js --check` is now 20/20.

### Added

- Logo accessible name now starts with the visible wordmark: `LOGO.ariaLabel` is `UXW KRDS UX Writing 가이드라인 홈` on all 20 pages (success criterion 2.5.3, Label in Name). `inspectPage` now requires the logo `aria-label` to equal the definition, and `tests/logo-label-in-name.test.js` pins the 11 pages whose visible `K` mark still leaves them unmet (`KNOWN_UNMET`, may only shrink).
- `scripts/lint-delta.js` (decision logic, dependency-free) with `tests/lint-delta.test.js`, and `scripts/lint-delta-run.sh` (per-file loop called by the workflow).

## [0.1.2] - 2026-08-28

### Changed

- **Version scheme unified**: `package.json`'s `version` field and the root `VERSION` file previously disagreed (`0.1.0` vs `0.1.0.2`) — flagged in the 2026-08-20 audit (REL-06). `0.1.0.2` is not valid semver, so `package.json` could not simply adopt it (`npm publish`/tooling would reject it). Both files now read `0.1.2`; `0.1.0.1`/`0.1.0.2` below map to this release's history. Other independently-versioned artifacts in this repo (web UI, Chrome extension, offline app) intentionally keep their own version numbers — see `README.md` "버전 관리".

### Security

- Product-boundary separation for a government-agency offline deployment: new `offline-app/` (rule-based lint only, no AI/network/history/URL-share), Rule Pack import with schema validation, minimal Electron scaffold with hardened `BrowserWindow` settings.
- Closed a GitHub Pages/Vercel/npm exposure gap where `research/`, `b2g-service-package/`, and `offline-app/` could have been served or packaged publicly.
- `LICENSE`, `NOTICE`, `SECURITY.md` added; `pnpm-lock.yaml` removed in favor of a single npm lockfile; two high-severity dev-dependency advisories (nanoid, postcss) resolved.

## [0.1.0.2] - 2026-05-07

### Quality Assurance

- **Regression verification pass** (Standard tier, 94/100): All 3 High-severity fixes from v0.1.0.1 confirmed intact — `ISSUE-001` (rate-limit Map OOM), `ISSUE-002` (duplicate CSP blocking DOMPurify), `ISSUE-003` (archive recommendation fallback chain)
- **All 665 archive cards** verified: recommendation fields populated across 정부24 (222), 홈택스 (221), 전자가족관계등록 (222)
- **lint.html**: share link enable/disable threshold (>500 chars), `?t=` URL param auto-load, filter tabs all confirmed functional
- **generator/index.html**: cancel 2-step flow, fallback template, dropdown keyboard nav confirmed functional
- No new regressions detected; health score maintained at 94/100

## [0.1.0.1] - 2026-05-06

### Fixed

- **`ISSUE-001`** (`api/generate.js`): Rate-limit Map grew unboundedly — moved `rateLimitMap.set()` inside `RATE_LIMIT_MAP_MAX` capacity guard to prevent OOM risk under sustained traffic
- **`ISSUE-002`** (`lint.html`): Duplicate Content-Security-Policy meta tag blocked `cdn.jsdelivr.net` from `script-src`, preventing DOMPurify CDN from loading and disabling XSS sanitization on lint output
- **`ISSUE-003`** (`archive.js`): Archive recommendation field was always empty — added fallback chain (`권장 개선안` || `수정 제안` || `개선안`) to match label variants across analysis cycles
