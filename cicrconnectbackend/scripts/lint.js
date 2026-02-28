#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

const files = [];
const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
};

walk(ROOT);

let failed = false;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failed = true;
    // eslint-disable-next-line no-console
    console.error(`Syntax error: ${path.relative(ROOT, file)}`);
    // eslint-disable-next-line no-console
    console.error(String(error.stderr || error.message || '').trim());
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  // eslint-disable-next-line no-console
  console.log(`Lint passed: ${files.length} JS files checked.`);
}
