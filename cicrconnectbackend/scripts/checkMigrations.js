#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const requiredScripts = [
  'scripts/migrateEncryptExistingData.js',
  'scripts/verifyEncryptedData.js',
];

let failed = false;
for (const relPath of requiredScripts) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    // eslint-disable-next-line no-console
    console.error(`Missing migration safety script: ${relPath}`);
    failed = true;
    continue;
  }
  try {
    execFileSync(process.execPath, ['--check', absPath], { stdio: 'pipe' });
    // eslint-disable-next-line no-console
    console.log(`OK ${relPath}`);
  } catch (error) {
    failed = true;
    // eslint-disable-next-line no-console
    console.error(`Invalid script syntax: ${relPath}`);
    // eslint-disable-next-line no-console
    console.error(String(error.stderr || error.message || '').trim());
  }
}

if (failed) {
  process.exitCode = 1;
}
