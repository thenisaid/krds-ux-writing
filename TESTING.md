# Testing Guide

## Philosophy

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

**vitest** v1.x — Node.js unit test runner compatible with ESM and CommonJS.

## Running Tests

```bash
# Run all tests once (CI mode)
npm test

# Watch mode (development)
npm run test:watch
```

## Test Directory

```
tests/
├── cli.test.js
├── generate-api.test.js
├── server-config.test.js
├── content-counts.test.js
├── css-token-contracts.test.js
├── nationality-copy-sync.test.js
├── html-inline-safety.test.js
├── site-links.test.js
├── base-path*.test.js
├── shared-nav-*.test.js
├── script-ui.test.js
├── index-*.test.js
├── archive-ui.test.js
├── dictionary-dict.test.js
├── before-after-ui.test.js
├── prompt-library-ui.test.js
├── presentation-inline-safety.test.js
├── krds-lint-browser.test.js
├── switch-ai-mode-script.test.js
└── krds-lint.test.js
```

## Test Layers

### Unit Tests (`tests/*.test.js`)
- **What**: Pure logic tests for `krds-lint.js` — jargon detection, pattern rules, score computation, public API shape
- **Where**: `tests/` directory
- **When**: Every commit. CI runs `npm test` automatically on every PR via `krds-lint.yml`

### Integration Tests
- `tests/cli.test.js`: `bin/krds-lint` directory recursion, exit codes, single-file JSON compatibility, aggregate JSON schema
- `tests/generate-api.test.js`: `api/generate.js` + `functions/api/generate.js` validation, allowed agency types, CORS headers, streaming happy path with mocked `fetch`
- `tests/server-config.test.js`: static path normalization and preview/deploy route handling in `server.js`
- `tests/content-counts.test.js`: hand-maintained archive/dictionary counters stay aligned with source content
- `tests/css-token-contracts.test.js`: 모든 HTML이 fallback 없는 CSS 커스텀 속성을 실제 정의 토큰에만 연결하는지 검증
- `tests/nationality-copy-sync.test.js`: `국적 회복 허가` follow-up wording stays aligned across corpus, principles pages, case studies, and regression tests so stale `2년` copy cannot drift back in
- `tests/switch-ai-mode-script.test.js`: `scripts/switch-ai-mode.sh` local/cloud 전환, 백업 복원, 잘못된 모드 usage 경로 검증

### Smoke Tests
- Manual: open `lint.html`, paste Korean text, verify lint results appear
- Manual: open `archive.html`, verify cards render and search works

### E2E Tests
- Not yet implemented. Candidate: Playwright MCP tests against GitHub Pages URL
- Run via `/qa` skill (browser-based, with screenshot evidence)

## Testable Modules

| File | Node.js? | Reason |
|------|----------|--------|
| `krds-lint.js` | ✅ Yes | UMD module, exports `lint`, `formatCLI`, `ADMIN_JARGON`, `PATTERN_RULES`, `version` |
| `bin/krds-lint` | ✅ Yes | Spawnable CLI, verified via child process integration tests |
| `api/generate.js` | ✅ Yes | Edge handler can be called with `Request` + mocked `fetch` |
| `functions/api/generate.js` | ✅ Yes | Cloudflare Pages handler can be called with mock context |
| `index.html` / `index-v2.html` | ✅ Yes (token contract) | 홈 페이지 토큰 누락이 CI에서 바로 걸리도록 HTML+로컬 CSS 계약 테스트가 돈다 |
| `scripts/switch-ai-mode.sh` | ✅ Yes (spawned shell) | 로컬/클라우드 전환이 임시 `.env` fixture에서 회귀 테스트된다 |
| `archive.js` | ✅ Yes (VM DOM harness) | Browser-DOM IIFE, verified with mocked tabs/search/fetch via `vm.runInNewContext` |
| `dictionary/dict.js` | ✅ Yes (VM DOM harness) | Browser-DOM filter/search logic covered with mocked DOM state |
| `shared/nav.js` | ✅ Yes (VM DOM harness) | Path rewriting, Ctrl+K behavior, and shared theme logic are exercised directly |
| `script.js` | ✅ Yes (VM DOM harness) | Live index page behavior (theme, mobile menu, skip link) is tested with a lightweight DOM harness |
| Inline page scripts | ✅ Yes (VM DOM harness) | `before-after`, `index`, `index-v2`, presentation pages, and prompt-library interactions have direct regression tests |

## Conventions

### File Naming
- `tests/{module-name}.test.js` — matches the source file name

### Assertion Style
```js
import { describe, it, expect } from 'vitest';
import KRDSLint from '../krds-lint.js';

describe('feature — short description', () => {
  it('does specific thing when specific condition', () => {
    const result = KRDSLint.lint('input text');
    const issue = result.issues.find(i => i.match === '귀하');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
  });
});
```

### Important: jargon-dictionary.json phrase matching
When running under Node.js, `krds-lint.js` loads the extracted entries from `jargon-dictionary.json` (currently 149 entries) and then merges `INLINE_JARGON` entries at runtime, so the runtime dictionary count can be higher than the raw JSON file count.
Browser pages that call `KRDSLint` directly must load the generated `jargon-dictionary.js` bundle before `krds-lint.js`, or they will fall back to the smaller inline dictionary only.
The dictionary stores **full banned phrases** (e.g., `"명일까지 제출"`) and some placeholder-style entries with a leading `~` (e.g., `"~하여야 합니다"`).
`krds-lint.js` normalizes the placeholder marker before matching, so tests should assert against the runtime match text, not an abbreviated stem or the literal `~` form.

### Setup / Teardown
- No global setup/teardown needed — `KRDSLint.lint()` is stateless
- Each test creates its own input string and inspects the returned object

## Test Expectations

- When writing new functions in `krds-lint.js`, write a corresponding test
- When fixing a bug, write a regression test first, then fix
- When adding error handling, write a test that triggers the error
- When adding a conditional (if/else), write tests for BOTH paths
- Never commit code that makes existing tests fail
