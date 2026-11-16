#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const cliScript = path.join(rootDir, 'src', 'cli.py');
const pythonCmd = process.env.PYTHON_BIN || (os.platform() === 'win32' ? 'python' : 'python3');

const env = Object.assign({}, process.env, {
  PYTHONPATH: rootDir + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '')
});

const child = spawn(pythonCmd, [cliScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: env
});

child.on('error', (err) => {
  console.error(`[everything-antigravity] Error executing ${pythonCmd}: ${err.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code || 0);
});
