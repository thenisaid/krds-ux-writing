#!/usr/bin/env node
'use strict';

/**
 * Sync prompt snippets from prompt-library.html into principles pages.
 *
 * Source:  prompt-library.html — elements with data-principle="<id>"
 * Targets: principles/<id>/index.html — between sync marker comments
 *
 * Markers in target files:
 *   <!-- sync:<id>:start -->
 *   <!-- sync:<id>:end -->
 *
 * Run: node scripts/sync-prompts.js
 */

const fs   = require('fs');
const path = require('path');

const LIBRARY = path.resolve(__dirname, '..', 'prompt-library.html');

const PRINCIPLES = [
  { id: 'no-translation', file: 'principles/no-translation/index.html' },
  { id: 'core-info',      file: 'principles/core-info/index.html'      },
  { id: 'safety-net',     file: 'principles/safety-net/index.html'     },
];

if (!fs.existsSync(LIBRARY)) {
  console.log('prompt-library.html not found — nothing to sync');
  process.exit(0);
}

const libraryHtml = fs.readFileSync(LIBRARY, 'utf8');
let updated = 0;

for (const { id, file } of PRINCIPLES) {
  const filePath = path.resolve(__dirname, '..', file);

  // Extract outerHTML of elements marked data-principle="<id>"
  // Matches: <TAG ... data-principle="<id>" ...>...</TAG>
  const snippets = [];
  const re = new RegExp(
    `<(\\w+)[^>]*\\sdata-principle="${id}"[^>]*>[\\s\\S]*?</\\1>`,
    'g'
  );
  let m;
  while ((m = re.exec(libraryHtml)) !== null) snippets.push(m[0]);

  if (!snippets.length) {
    console.log(`[${id}] no snippets found in prompt-library.html`);
    continue;
  }

  const target     = fs.readFileSync(filePath, 'utf8');
  const startTag   = `<!-- sync:${id}:start -->`;
  const endTag     = `<!-- sync:${id}:end -->`;

  if (!target.includes(startTag)) {
    console.warn(`[${id}] sync markers missing in ${file} — skipping`);
    continue;
  }

  const date        = new Date().toISOString().slice(0, 10);
  const inner       = snippets.join('\n      ');
  const replacement = `${startTag}\n      <!-- auto-updated: ${date} -->\n      ${inner}\n      ${endTag}`;

  const newHtml = target.replace(
    new RegExp(`${startTag}[\\s\\S]*?${endTag}`),
    replacement
  );

  if (newHtml === target) {
    console.log(`[${id}] no change`);
    continue;
  }

  fs.writeFileSync(filePath, newHtml, 'utf8');
  console.log(`[${id}] updated ${file} (${snippets.length} snippet${snippets.length > 1 ? 's' : ''})`);
  updated++;
}

console.log(`\nSync complete. ${updated} file(s) updated.`);
