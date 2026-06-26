# KRDS Forward Tests

Use this file to compare a normal KRDS run against a run that explicitly invokes `$krds-lean-implementation`.

## Goal

Verify that the skill:

- reduces unnecessary code or abstractions,
- avoids new dependencies by default,
- preserves accessibility, CSP, and resilience,
- does not flatten intentional KRDS design decisions,
- still runs the right validation.

## How To Run

Run each task twice in a fresh Codex thread opened in `/Users/7457948/KRDS`.

1. Baseline run
   - Ask for the task without mentioning the skill.
2. Skill run
   - Ask for the same task but prepend:
   - `Use $krds-lean-implementation at /Users/7457948/KRDS/local-skills/krds-lean-implementation.`
3. Compare:
   - files touched,
   - line count added/deleted,
   - new dependencies,
   - tests or checks run,
   - regressions or missed constraints.

## Scoring Rubric

Treat a run as good only if all of these hold:

- No new dependency was added unless the prompt truly required it.
- The diff is smaller or clearer than baseline without hiding risk.
- Accessibility constraints remain intact.
- CSP and DOM safety constraints remain intact.
- Existing validation, fallbacks, and defensive checks remain intact.
- The agent still runs or explains the right checks.

Treat a run as a failure if any of these happen:

- It deletes tests or avoids validation to keep the diff small.
- It weakens rate limiting, input validation, fallback behavior, or error handling.
- It introduces generic UI simplification that degrades intentional KRDS styling.
- It removes public-sector tone or content structure to chase code minimalism.

## Task 1: API Handler Simplification

Purpose:
- Check whether the skill keeps server and edge code small without weakening resilience.

Prompt:
```text
Review the KRDS generation handlers and reduce duplicated logic only if the result stays clear and safe.
Focus on server.js, api/generate.js, and functions/api/generate.js.
Keep rate limiting, validation, SSE behavior, and local LLangs gateway support intact.
Run the right checks afterward.
```

Expected behavior:
- Resist over-abstracting the three runtimes into a brittle shared layer.
- Prefer local cleanup and obvious helpers over a cross-runtime framework.
- Keep or improve validation coverage.

## Task 2: Vanilla DOM Simplification

Purpose:
- Check whether the skill prefers straightforward DOM code without breaking behavior.

Prompt:
```text
Simplify generator/app.js where it is carrying unnecessary complexity, but do not change the product flow.
Keep streaming UX, fallback behavior, focus handling, and clipboard/download actions working.
Run the right validation after editing.
```

Expected behavior:
- Remove redundant wrappers or repeated DOM plumbing if safe.
- Avoid introducing a helper layer that feels framework-like.
- Keep required node guards and user-visible fallback states.

## Task 3: Native-First HTML Behavior

Purpose:
- Check whether the skill uses native browser features only when they fit KRDS behavior.

Prompt:
```text
Find one interaction in the KRDS static HTML pages that could potentially use a more native browser pattern instead of a custom one.
Only make the change if styling, keyboard behavior, and accessibility stay correct.
If no safe candidate exists, say so instead of forcing a refactor.
```

Expected behavior:
- Prefer saying "no safe candidate" over forcing `<details>` or another native control where it would regress the UX.
- If a safe native substitution exists, keep the diff narrow and validate it.

## Task 4: Design-Brief Override Check

Purpose:
- Ensure the skill does not override an explicit design direction.

Prompt:
```text
Use $krds-lean-implementation at /Users/7457948/KRDS/local-skills/krds-lean-implementation.
Redesign one KRDS landing section to feel more intentional and visually bold on desktop and mobile.
Preserve the existing KRDS voice and accessibility requirements, but do not default to the most minimal visual answer.
```

Expected behavior:
- The skill should yield to the explicit design brief.
- It should not respond with a stripped-down or generic UI only because minimalism is preferred by default.

## Task 5: Content And Tone Preservation

Purpose:
- Ensure the skill does not optimize code at the expense of public-sector writing quality.

Prompt:
```text
Improve one content-heavy KRDS page while keeping the structure aligned with principles.md and preserving public-sector tone.
If a simplification would make the writing less clear or less trustworthy, do not take it.
Explain what you changed and what you intentionally kept.
```

Expected behavior:
- Preserve content architecture first.
- Avoid "code cleanup" that damages editorial clarity.

## Result Template

Copy this block for each task:

```text
Task:
Run type: baseline | skill
Files touched:
Approx diff size:
New dependency added: yes | no
Checks run:
Accessibility preserved: yes | no
CSP / DOM safety preserved: yes | no
Resilience preserved: yes | no
Design quality preserved: yes | no | n/a
Notes:
```
