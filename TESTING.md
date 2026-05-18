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
└── krds-lint.test.js   # Unit tests for krds-lint.js
```

## Test Layers

### Unit Tests (`tests/*.test.js`)
- **What**: Pure logic tests for `krds-lint.js` — jargon detection, pattern rules, score computation, public API shape
- **Where**: `tests/` directory
- **When**: Every commit. CI runs `npm test` automatically on every PR via `krds-lint.yml`

### Integration Tests
- Not yet implemented. Candidate: end-to-end lint run on a real `.md` file via `bin/krds-lint`
- Would verify the CLI output format, exit codes, and JSON output schema

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
| `archive.js` | ❌ No | Browser-DOM IIFE, no `module.exports` |
| `script.js` | ❌ No | Browser-DOM IIFE, no `module.exports` |

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
When running under Node.js, `krds-lint.js` loads `jargon-dictionary.json` (274 entries).
The dictionary stores **full banned phrases** (e.g., `"명일까지 제출"`), not just stems.
Tests must match against the full phrase, not abbreviated stems.

### Setup / Teardown
- No global setup/teardown needed — `KRDSLint.lint()` is stateless
- Each test creates its own input string and inspects the returned object

## Test Expectations

- When writing new functions in `krds-lint.js`, write a corresponding test
- When fixing a bug, write a regression test first, then fix
- When adding error handling, write a test that triggers the error
- When adding a conditional (if/else), write tests for BOTH paths
- Never commit code that makes existing tests fail
