# Changelog

All notable changes to this project will be documented in this file.

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
