# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0.1] - 2026-05-06

### Fixed

- **ISSUE-001** (`api/generate.js`): Rate-limit Map grew unboundedly — moved `rateLimitMap.set()` inside `RATE_LIMIT_MAP_MAX` capacity guard to prevent OOM risk under sustained traffic
- **ISSUE-002** (`lint.html`): Duplicate Content-Security-Policy meta tag blocked `cdn.jsdelivr.net` from `script-src`, preventing DOMPurify CDN from loading and disabling XSS sanitization on lint output
- **ISSUE-003** (`archive.js`): Archive recommendation field was always empty — added fallback chain (`권장 개선안` || `수정 제안` || `개선안`) to match label variants across analysis cycles
