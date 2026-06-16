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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSnippets(libraryHtml, id) {
  const snippets = [];
  const re = new RegExp(
    `<(\\w+)[^>]*\\sdata-principle="${escapeRegExp(id)}"[^>]*>[\\s\\S]*?</\\1>`,
    'g'
  );
  let m;
  while ((m = re.exec(libraryHtml)) !== null) snippets.push(m[0]);
  return snippets;
}

function normalizeSyncBlock(block) {
  return block
    .replace(/\r\n/g, '\n')
    .replace(/<!-- auto-updated: \d{4}-\d{2}-\d{2} -->/g, '<!-- auto-updated: DATE -->');
}

function replaceSyncBlock(targetHtml, { id, snippets, date }) {
  const startTag = `<!-- sync:${id}:start -->`;
  const endTag = `<!-- sync:${id}:end -->`;

  if (!targetHtml.includes(startTag) || !targetHtml.includes(endTag)) {
    return { html: targetHtml, changed: false, reason: 'missing-markers' };
  }

  const inner = snippets.join('\n      ');
  const replacement = `${startTag}\n      <!-- auto-updated: ${date} -->\n      ${inner}\n      ${endTag}`;
  const blockRe = new RegExp(`${escapeRegExp(startTag)}[\\s\\S]*?${escapeRegExp(endTag)}`);
  const currentMatch = targetHtml.match(blockRe);

  if (!currentMatch) {
    return { html: targetHtml, changed: false, reason: 'missing-markers' };
  }

  if (normalizeSyncBlock(currentMatch[0]) === normalizeSyncBlock(replacement)) {
    return { html: targetHtml, changed: false, reason: 'no-change' };
  }

  return {
    html: targetHtml.replace(blockRe, replacement),
    changed: true,
    reason: 'updated',
  };
}

function syncPromptFiles({
  libraryHtml,
  date = new Date().toISOString().slice(0, 10),
  principles = PRINCIPLES,
  rootDir = path.resolve(__dirname, '..'),
  readFile = fs.readFileSync,
  writeFile = fs.writeFileSync,
  log = console.log,
  warn = console.warn,
}) {
  let updated = 0;

  for (const { id, file } of principles) {
    const filePath = path.resolve(rootDir, file);
    const snippets = extractSnippets(libraryHtml, id);

    if (!fs.existsSync(filePath)) {
      warn(`[${id}] target missing: ${file} — skipping`);
      continue;
    }

    const targetHtml = readFile(filePath, 'utf8');
    const result = replaceSyncBlock(targetHtml, { id, snippets, date });

    if (result.reason === 'missing-markers') {
      warn(`[${id}] sync markers missing in ${file} — skipping`);
      continue;
    }

    if (!result.changed) {
      log(`[${id}] no change`);
      continue;
    }

    writeFile(filePath, result.html, 'utf8');
    if (snippets.length) {
      log(`[${id}] updated ${file} (${snippets.length} snippet${snippets.length > 1 ? 's' : ''})`);
    } else {
      log(`[${id}] cleared synced snippets in ${file}`);
    }
    updated++;
  }

  log(`\nSync complete. ${updated} file(s) updated.`);
  return updated;
}

function main() {
  if (!fs.existsSync(LIBRARY)) {
    console.log('prompt-library.html not found — nothing to sync');
    return 0;
  }

  const libraryHtml = fs.readFileSync(LIBRARY, 'utf8');
  syncPromptFiles({ libraryHtml });
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  LIBRARY,
  PRINCIPLES,
  extractSnippets,
  replaceSyncBlock,
  syncPromptFiles,
  main,
};
