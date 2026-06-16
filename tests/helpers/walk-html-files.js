import fs from 'node:fs';
import path from 'node:path';

function walk(dir, baseDir, ignoredDirs) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name) || entry.name.indexOf('.tmp-krds-cli-') === 0) return [];
      return walk(fullPath, baseDir, ignoredDirs);
    }
    if (!entry.isFile() || path.extname(entry.name) !== '.html') return [];
    return [path.relative(baseDir, fullPath)];
  });
}

export function walkHtmlFiles(dir, options = {}) {
  const ignoredDirs = new Set([
    'node_modules',
    '.git',
    ...(options.ignoredDirs || []),
  ]);

  return walk(dir, dir, ignoredDirs);
}
