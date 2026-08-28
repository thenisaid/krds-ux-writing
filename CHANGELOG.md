# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2] - 2026-08-28

### Changed

- **Version scheme unified**: `package.json`'s `version` field and the root `VERSION` file previously disagreed (`0.1.0` vs `0.1.0.2`) — flagged in the 2026-08-20 audit (REL-06). `0.1.0.2` is not valid semver, so `package.json` could not simply adopt it (`npm publish`/tooling would reject it). Both files now read `0.1.2`; `0.1.0.1`/`0.1.0.2` below map to this release's history. Other independently-versioned artifacts in this repo (web UI, Chrome extension, offline app) intentionally keep their own version numbers — see README "버전 관리".

### Security

- Product-boundary separation for a government-agency offline deployment: new `offline-app/` (rule-based lint only, no AI/network/history/URL-share), Rule Pack import with schema validation, minimal Electron scaffold with hardened `BrowserWindow` settings.
- Closed a GitHub Pages/Vercel/npm exposure gap where `research/`, `b2g-service-package/`, and `offline-app/` could have been served or packaged publicly.
- `LICENSE`, `NOTICE`, `SECURITY.md` added; `pnpm-lock.yaml` removed in favor of a single npm lockfile; two high-severity dev-dependency advisories (nanoid, postcss) resolved.
- Full detail: `research/2026-08-27-overnight-delivery-report.md`.

## [0.1.0.2] - 2026-05-07

### Quality Assurance

- **Regression verification pass** (Standard tier, 94/100): All 3 High-severity fixes from v0.1.0.1 confirmed intact — ISSUE-001 (rate-limit Map OOM), ISSUE-002 (duplicate CSP blocking DOMPurify), ISSUE-003 (archive recommendation fallback chain)
- **All 665 archive cards** verified: recommendation fields populated across 정부24 (222), 홈택스 (221), 전자가족관계등록 (222)
- **lint.html**: share link enable/disable threshold (>500 chars), `?t=` URL param auto-load, filter tabs all confirmed functional
- **generator/index.html**: cancel 2-step flow, fallback template, dropdown keyboard nav confirmed functional
- No new regressions detected; health score maintained at 94/100

## [0.1.0.1] - 2026-05-06

### Fixed

- **ISSUE-001** (`api/generate.js`): Rate-limit Map grew unboundedly — moved `rateLimitMap.set()` inside `RATE_LIMIT_MAP_MAX` capacity guard to prevent OOM risk under sustained traffic
- **ISSUE-002** (`lint.html`): Duplicate Content-Security-Policy meta tag blocked `cdn.jsdelivr.net` from `script-src`, preventing DOMPurify CDN from loading and disabling XSS sanitization on lint output
- **ISSUE-003** (`archive.js`): Archive recommendation field was always empty — added fallback chain (`권장 개선안` || `수정 제안` || `개선안`) to match label variants across analysis cycles
