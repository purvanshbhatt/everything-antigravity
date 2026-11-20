#!/usr/bin/env node
'use strict';
/**
 * Cross-version test runner. `node --test` only expands glob patterns on Node 21+,
 * so list the test files explicitly; this works on every supported Node version.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const dir = path.join(__dirname, '..', 'tests', 'js');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(dir, f));
if (!files.length) {
  console.error(`No test files found in ${dir}`);
  process.exit(1);
}
const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(res.status === null ? 1 : res.status);
