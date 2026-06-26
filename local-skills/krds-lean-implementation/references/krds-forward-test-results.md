# KRDS Forward Test Results

This file records the completed A/B runs for the KRDS-local forward-test set.

## Overall Readout

- **Task 1**: skill win — narrower edge-only helper extraction kept runtime boundaries clearer.
- **Task 2**: skill win — smaller DOM cleanup preserved the same UX contracts with less helper churn.
- **Task 3**: tie / intentional no-change — no safe native-first substitution was worth forcing.
- **Task 4**: skill win — the explicit bold-design brief justified a larger but more intentional hero redesign.
- **Task 5**: skill win — intro guidance improved clarity without flattening the document’s public-sector voice.

## Task 1

Task: API Handler Simplification  
Run type: baseline  
Files touched: `server.js`, `api/generate.js`, `functions/api/generate.js`, `shared/anthropic-config.js`  
Approx diff size: ~59 insertions / 140 deletions  
New dependency added: no  
Checks run: `node --check server.js`, `node --check api/generate.js`, `node --check functions/api/generate.js`, `./node_modules/.bin/vitest run tests/server-config.test.js tests/generate-api.test.js`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: n/a  
Notes: Passed `50/50` tests. Valid result, but it introduced a helper shared across local CommonJS and edge runtimes.

Task: API Handler Simplification  
Run type: skill  
Files touched: `api/generate.js`, `functions/api/generate.js`, `api/shared/anthropic-edge.js`  
Approx diff size: ~46 insertions / 90 deletions  
New dependency added: no  
Checks run: `node --check server.js`, `node --check api/generate.js`, `node --check functions/api/generate.js`, `./node_modules/.bin/vitest run tests/server-config.test.js tests/generate-api.test.js`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: n/a  
Notes: Passed `50/50` tests. Preferred because it kept the shared logic inside the edge runtime boundary and left `server.js` alone.

## Task 2

Task: Vanilla DOM Simplification  
Run type: baseline  
Files touched: `generator/app.js`  
Approx diff size: ~42 insertions / 32 deletions  
New dependency added: no  
Checks run: `node --check generator/app.js`, `./node_modules/.bin/vitest run tests/generator-app.test.js tests/page-script-contracts.test.js`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: n/a  
Notes: Passed `19/19` tests. Safe, but it introduced a wider layer of small convenience helpers than the task really needed.

Task: Vanilla DOM Simplification  
Run type: skill  
Files touched: `generator/app.js`  
Approx diff size: ~27 insertions / 23 deletions  
New dependency added: no  
Checks run: `node --check generator/app.js`, `./node_modules/.bin/vitest run tests/generator-app.test.js tests/page-script-contracts.test.js`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: n/a  
Notes: Passed `19/19` tests. Preferred because it only removed obvious repetition: status-timer cleanup, plaintext fallback reuse, and repeated menu-Tab focus handling.

## Task 3

Task: Native-First HTML Behavior  
Run type: baseline  
Files touched: none  
Approx diff size: none  
New dependency added: no  
Checks run: `./node_modules/.bin/vitest run tests/index-inline-ui.test.js tests/index-v2-ui.test.js tests/script-ui.test.js tests/before-after-ui.test.js tests/page-script-contracts.test.js`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: n/a  
Notes: After inspecting the FAQ accordions, mobile menus, and tab systems, no native substitution was safer than the current custom interaction contracts.

Task: Native-First HTML Behavior  
Run type: skill  
Files touched: none  
Approx diff size: none  
New dependency added: no  
Checks run: `./node_modules/.bin/vitest run tests/index-inline-ui.test.js tests/index-v2-ui.test.js tests/script-ui.test.js tests/before-after-ui.test.js tests/page-script-contracts.test.js`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: n/a  
Notes: Same conclusion as baseline. This counted as the correct outcome because forcing `<details>`, `<dialog>`, or another native control would have traded away intentional focus and state behavior for little gain.

## Task 4

Task: Design-Brief Override Check  
Run type: baseline  
Files touched: `prompt-library.html`  
Approx diff size: ~121 insertions / 17 deletions  
New dependency added: no  
Checks run: `./node_modules/.bin/vitest run tests/prompt-library-ui.test.js`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: no  
Notes: Passed `6/6` tests. The redesign became more structured, but it still undershot the explicit “intentional and visually bold” brief.

Task: Design-Brief Override Check  
Run type: skill  
Files touched: `prompt-library.html`  
Approx diff size: ~293 insertions / 18 deletions  
New dependency added: no  
Checks run: `./node_modules/.bin/vitest run tests/prompt-library-ui.test.js`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: yes  
Notes: Passed `6/6` tests in the sandbox and `9/9` related tests in the main workspace (`tests/prompt-library-ui.test.js`, `tests/html-inline-safety.test.js`). Preferred because it followed the explicit brief instead of collapsing back into a safe minimal hero.

## Task 5

Task: Content And Tone Preservation  
Run type: baseline  
Files touched: `voice-tone-guide.md`  
Approx diff size: ~4 insertions / 3 deletions  
New dependency added: no  
Checks run: heading / cross-reference inspection with `rg` and `sed`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: no  
Notes: Kept the document intact, but the shorter intro removed too much of the “where to decide / where to defer to `principles.md`” guidance.

Task: Content And Tone Preservation  
Run type: skill  
Files touched: `voice-tone-guide.md`  
Approx diff size: ~11 insertions / 3 deletions  
New dependency added: no  
Checks run: heading / cross-reference inspection with `rg` and `sed`  
Accessibility preserved: yes  
CSP / DOM safety preserved: yes  
Resilience preserved: yes  
Design quality preserved: yes  
Notes: Preferred because it kept the original document structure, reinforced the `principles.md` handoff, and added a short “quick decision” sequence without turning the guide into generic summary copy.

## Workspace State

The main KRDS workspace currently reflects the preferred outcomes for:

- Task 1 (`api/shared/anthropic-edge.js`, `api/generate.js`, `functions/api/generate.js`)
- Task 2 (`generator/app.js`)
- Task 4 (`prompt-library.html`)
- Task 5 (`voice-tone-guide.md`)

Task 3 intentionally made no code change.
