'use strict';
/** Filesystem layout of the EAG state directory (~/.gemini/eag by default). */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

function eagHome() {
  return process.env.EAG_HOME || path.join(os.homedir(), '.gemini', 'eag');
}

/** Stable, human-readable key for a project directory: `<basename>-<sha1[0:8]>`. */
function projectKey(dir) {
  const abs = path.resolve(dir || process.cwd());
  const norm = process.platform === 'win32' ? abs.toLowerCase() : abs;
  const hash = crypto.createHash('sha1').update(norm).digest('hex').slice(0, 8);
  const base = path.basename(abs).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'root';
  return `${base}-${hash}`;
}

function safeName(s) {
  return String(s || 'unknown').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
}

const sessionsDir = (key) => path.join(eagHome(), 'sessions', key);
const instinctsFile = (key) => path.join(eagHome(), 'instincts', `${key}.json`);
const stateFile = (conversationId) => path.join(eagHome(), 'state', `${safeName(conversationId)}.json`);
const configFile = () => path.join(eagHome(), 'config.json');
const logFile = () => path.join(eagHome(), 'logs', 'hooks.log');
const installStateFile = () => path.join(eagHome(), 'install-state.json');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err && err.code !== 'ENOENT') logError('readJson', err, file);
    return fallback;
  }
}

/** Atomic JSON write (write temp file, then rename). */
function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function logError(where, err, extra) {
  try {
    ensureDir(path.dirname(logFile()));
    const line = `${new Date().toISOString()} [${where}] ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err)}${extra ? ` (${extra})` : ''}\n`;
    fs.appendFileSync(logFile(), line, 'utf8');
  } catch {
    /* logging must never throw */
  }
}

module.exports = {
  eagHome, projectKey, safeName, sessionsDir, instinctsFile, stateFile, configFile, logFile,
  installStateFile, ensureDir, readJson, writeJson, logError,
};
