'use strict';
/**
 * One-stop installer for Antigravity (native plugin), Gemini CLI (extension)
 * and optional skill mirrors for Cursor and Codex.
 *
 * Safety properties (covered by tests/js/install.test.js):
 *  - only removes symlinks/junctions whose target is an everything-antigravity checkout;
 *    never deletes a link target or a real directory it does not own;
 *  - refuses to overwrite a foreign plugin/extension with the same directory name;
 *  - backs up a previous EAG copy before replacing it;
 *  - `--dry-run` performs no writes;
 *  - records everything it created in install-state.json so uninstall is exact.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const NAME = 'everything-antigravity';

const ANTIGRAVITY_PAYLOAD = ['plugin.json', 'hooks.json', 'README.md', 'LICENSE', 'assets', 'skills', 'agents', 'rules', 'scripts/hooks', 'scripts/lib', 'bin/eag.js', 'mcp-configs'];
const GEMINI_PAYLOAD = ['gemini-extension.json', 'README.md', 'LICENSE', 'skills', 'rules', 'hooks/hooks.json', 'scripts/hooks', 'scripts/lib', 'bin/eag.js', 'mcp-configs'];
const SKIP = new Set(['node_modules', '__pycache__', '.DS_Store', '.git', 'Thumbs.db']);

// Where v1 left symlinks/junctions, per harness. Only the harnesses being installed are cleaned.
const V1_LINK_DIRS = {
  antigravity: ['.gemini/config/skills', '.gemini/antigravity/skills', '.gemini/config/rules', '.gemini/config/plugins', '.agents/skills', '.agents/rules', '.agents/workflows'],
  cursor: ['.cursor/skills'],
};

const MIRRORS = { cursor: '.cursor/skills', codex: '.codex/skills' };
const MARKER = '.eag-managed';

function which(cmd) {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext.toLowerCase());
      const q = path.join(dir, cmd + ext);
      if (dir && fs.existsSync(p)) return p;
      if (dir && fs.existsSync(q)) return q;
    }
  }
  return null;
}

function findAgy(home) {
  if (process.env.EAG_NO_AGY) return null;
  const local = path.join(home, '.gemini', 'bin', process.platform === 'win32' ? 'agy.exe' : 'agy');
  return fs.existsSync(local) ? local : which('agy');
}

function isLink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function linkTarget(p) {
  try {
    return path.resolve(path.dirname(p), fs.readlinkSync(p));
  } catch {
    return '';
  }
}

function removeLink(p) {
  try {
    fs.unlinkSync(p);
  } catch {
    fs.rmdirSync(p);
  }
}

function readName(manifest) {
  try {
    return JSON.parse(fs.readFileSync(manifest, 'utf8')).name || null;
  } catch {
    return null;
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Find v1-style links (into any everything-antigravity checkout) in the given targets' folders. */
function findV1Links(home, targets = ['antigravity']) {
  const found = [];
  const groups = new Set(targets.map((t) => (t === 'gemini' ? 'antigravity' : t)));
  const dirs = [...groups].flatMap((g) => V1_LINK_DIRS[g] || []);
  for (const rel of dirs) {
    const dir = path.join(home, ...rel.split('/'));
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(dir, e);
      if (!isLink(p)) continue;
      const t = linkTarget(p);
      if (/everything-antigravity/i.test(t) && path.resolve(t) !== REPO_ROOT) found.push({ path: p, target: t });
    }
  }
  return found;
}

function copyPayload(items, src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const rel of items) {
    const from = path.join(src, ...rel.split('/'));
    if (!fs.existsSync(from)) continue;
    const to = path.join(dest, ...rel.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true, dereference: true, filter: (s) => !SKIP.has(path.basename(s)) && !s.endsWith('.pyc') });
  }
}

/** Remove entries in `dst` that do not exist in `src` (recursively). */
function pruneExtraneous(src, dst) {
  for (const entry of fs.readdirSync(dst, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (!fs.existsSync(s)) {
      fs.rmSync(d, { recursive: true, force: true });
    } else if (entry.isDirectory() !== fs.statSync(s).isDirectory()) {
      fs.rmSync(d, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      pruneExtraneous(s, d);
    }
  }
}

/**
 * Install a payload into `dest`. When `dest` already exists it is updated in place
 * (overwrite + prune) instead of being replaced, because a running Antigravity keeps
 * processes inside its plugin folders and Windows refuses to rename or delete them (EBUSY).
 */
function installPayload(items, dest) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-stage-'));
  try {
    copyPayload(items, REPO_ROOT, staging);
    if (fs.existsSync(dest) && !isLink(dest)) {
      pruneExtraneous(staging, dest);
      fs.cpSync(staging, dest, { recursive: true, force: true });
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(staging, dest, { recursive: true });
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function defaultTargets(home) {
  const t = ['antigravity'];
  if (fs.existsSync(path.join(home, '.gemini', 'extensions')) || (!process.env.EAG_NO_AGY && which('gemini'))) t.push('gemini');
  return t;
}

/** Ownership-checked destination preparation. Returns actions or throws. */
function planDest(dest, manifestName, opts, actions) {
  if (isLink(dest)) {
    const t = linkTarget(dest);
    if (!/everything-antigravity/i.test(t) && !opts.force) throw new Error(`${dest} is a link to ${t}, which is not Everything Antigravity. Re-run with --force to replace it.`);
    actions.push({ type: 'remove-link', path: dest, detail: `previous link → ${t}` });
  } else if (fs.existsSync(dest)) {
    const owner = readName(path.join(dest, manifestName));
    if (owner !== NAME && !opts.force) throw new Error(`${dest} exists and belongs to "${owner || 'unknown'}". Refusing to overwrite; move it or re-run with --force.`);
    actions.push({ type: 'backup', path: dest, detail: path.join(opts.eagHome, 'backups', stamp(), path.basename(dest)) });
  }
}

/**
 * Compute the install plan.
 * @returns {{actions: object[], targets: string[], agy: string|null}}
 */
function plan(opts) {
  const { home } = opts;
  const targets = opts.targets && opts.targets.length ? opts.targets : defaultTargets(home);
  const unknown = targets.filter((t) => !['antigravity', 'gemini', ...Object.keys(MIRRORS)].includes(t));
  if (unknown.length) throw new Error(`Unknown target(s): ${unknown.join(', ')}. Use antigravity, gemini, cursor, codex.`);
  const actions = [];
  const agDest = path.join(home, '.gemini', 'config', 'plugins', NAME);
  const v1Paths = new Set();
  for (const l of findV1Links(home, targets)) {
    if (path.resolve(l.path) === path.resolve(agDest) && targets.includes('antigravity')) continue; // handled by planDest
    actions.push({ type: 'remove-link', path: l.path, detail: `v1 link → ${l.target}` });
    v1Paths.add(path.resolve(l.path));
  }
  if (targets.includes('antigravity')) {
    if (path.resolve(agDest) !== REPO_ROOT) {
      planDest(agDest, 'plugin.json', opts, actions);
      actions.push(opts.link
        ? { type: 'link', path: agDest, detail: REPO_ROOT, target: 'antigravity' }
        : { type: 'copy', path: agDest, detail: 'Antigravity plugin', items: ANTIGRAVITY_PAYLOAD, target: 'antigravity' });
    }
  }
  if (targets.includes('gemini')) {
    const gDest = path.join(home, '.gemini', 'extensions', NAME);
    planDest(gDest, 'gemini-extension.json', opts, actions);
    actions.push(opts.link
      ? { type: 'link', path: gDest, detail: REPO_ROOT, target: 'gemini' }
      : { type: 'copy', path: gDest, detail: 'Gemini CLI extension', items: GEMINI_PAYLOAD, target: 'gemini' });
  }
  for (const [t, rel] of Object.entries(MIRRORS)) {
    if (!targets.includes(t)) continue;
    const base = path.join(home, ...rel.split('/'));
    for (const skill of fs.readdirSync(path.join(REPO_ROOT, 'skills'))) {
      const dest = path.join(base, skill);
      if (fs.existsSync(dest) && !fs.existsSync(path.join(dest, MARKER)) && !v1Paths.has(path.resolve(dest))) {
        actions.push({ type: 'skip', path: dest, detail: 'a skill with this name already exists and is not managed by EAG' });
        continue;
      }
      actions.push({ type: 'mirror', path: dest, detail: `${t} skill`, skill, target: t });
    }
  }
  return { actions, targets, agy: findAgy(home) };
}

function smokeTest(pluginDir, eagHome) {
  const run = path.join(pluginDir, 'scripts', 'hooks', 'run.js');
  const call = (payload) => spawnSync(process.execPath, [run, 'pre-tool'], {
    input: JSON.stringify(payload), encoding: 'utf8', timeout: 15000, env: { ...process.env, EAG_HOME: eagHome, EAG_HOOK_PROFILE: '' },
  });
  const base = { conversationId: 'eag-smoke', workspacePaths: [os.tmpdir()], cwd: os.tmpdir() };
  const bad = call({ ...base, toolCall: { name: 'run_command', args: { CommandLine: 'rm -rf /' } } });
  const good = call({ ...base, toolCall: { name: 'run_command', args: { CommandLine: 'echo ok' } } });
  let deny = false;
  try { deny = JSON.parse(bad.stdout).decision === 'deny'; } catch { deny = false; }
  return { pass: bad.status === 0 && good.status === 0 && deny && good.stdout.trim() === '', detail: { badOut: bad.stdout, goodOut: good.stdout, stderr: bad.stderr + good.stderr } };
}

/**
 * Execute the plan.
 * @param {object} opts {home, eagHome, targets, link, dryRun, force, profile, log}
 */
function install(opts) {
  const log = opts.log || console.log;
  const p = plan(opts);
  log(`Everything Antigravity installer · targets: ${p.targets.join(', ')}${opts.link ? ' · mode: link (development)' : ''}`);
  for (const a of p.actions) log(`  ${a.type.padEnd(11)} ${a.path}${a.detail ? `  (${a.detail})` : ''}`);
  if (opts.dryRun) {
    log('Dry run: no changes made.');
    return { ...p, dryRun: true };
  }

  const state = { name: NAME, version: readVersion(), installedAt: new Date().toISOString(), source: REPO_ROOT, targets: {}, removedLinks: [], mirrors: [] };
  for (const a of p.actions) {
    if (a.type === 'remove-link') {
      removeLink(a.path);
      state.removedLinks.push(a.path);
    } else if (a.type === 'backup') {
      // Copy, never move: a running Antigravity can hold the folder open (EBUSY on Windows).
      fs.mkdirSync(path.dirname(a.detail), { recursive: true });
      fs.cpSync(a.path, a.detail, { recursive: true });
    } else if (a.type === 'copy') {
      installPayload(a.items, a.path);
      state.targets[a.target] = { path: a.path, mode: 'copy' };
    } else if (a.type === 'link') {
      if (fs.existsSync(a.path) && !isLink(a.path)) fs.rmSync(a.path, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(a.path), { recursive: true });
      fs.symlinkSync(REPO_ROOT, a.path, process.platform === 'win32' ? 'junction' : 'dir');
      state.targets[a.target] = { path: a.path, mode: 'link' };
    } else if (a.type === 'mirror') {
      if (fs.existsSync(a.path)) fs.rmSync(a.path, { recursive: true, force: true });
      fs.cpSync(path.join(REPO_ROOT, 'skills', a.skill), a.path, { recursive: true });
      fs.writeFileSync(path.join(a.path, MARKER), `${NAME}\n`);
      state.mirrors.push(a.path);
      state.targets[a.target] = { path: path.dirname(a.path), mode: 'mirror' };
    }
  }

  const cfgFile = path.join(opts.eagHome, 'config.json');
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch { cfg = {}; }
  if (opts.profile || !cfg.profile) cfg.profile = opts.profile || 'standard';
  fs.mkdirSync(opts.eagHome, { recursive: true });
  fs.writeFileSync(cfgFile, `${JSON.stringify(cfg, null, 2)}\n`);
  fs.writeFileSync(path.join(opts.eagHome, 'install-state.json'), `${JSON.stringify(state, null, 2)}\n`);

  const pluginDir = (state.targets.antigravity || state.targets.gemini || {}).path;
  let smoke = null;
  if (pluginDir) {
    smoke = smokeTest(pluginDir, opts.eagHome);
    log(`Hook smoke test: ${smoke.pass ? 'pass' : 'FAIL'}${smoke.pass ? '' : ` ${JSON.stringify(smoke.detail)}`}`);
  }
  if (p.agy && state.targets.antigravity) {
    const v = spawnSync(p.agy, ['plugin', 'validate', state.targets.antigravity.path], { encoding: 'utf8', timeout: 60000 });
    const summary = (v.stdout || '').split('\n').filter((l) => /skills \d+|✔|✗|⚠|Error/.test(l)).join('\n');
    log(`agy plugin validate:\n${summary || (v.stderr || '').trim()}`);
  }
  log(`Profile: ${cfg.profile} (change with: eag profile set minimal|standard|strict)`);
  log(state.targets.antigravity ? 'Done. Antigravity loads the plugin on its next turn; open Customizations to review or toggle it.' : 'Done.');
  return { ...p, state, smoke };
}

function uninstall(opts) {
  const log = opts.log || console.log;
  const stateFile = path.join(opts.eagHome, 'install-state.json');
  let state;
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    throw new Error(`No install record at ${stateFile}; nothing to uninstall.`);
  }
  const removals = [];
  for (const [target, t] of Object.entries(state.targets || {})) {
    if (t.mode === 'mirror') continue;
    removals.push({ target, path: t.path, link: t.mode === 'link' });
  }
  for (const m of state.mirrors || []) removals.push({ target: 'mirror', path: m });
  for (const r of removals) log(`  remove ${r.path}`);
  if (opts.dryRun) {
    log('Dry run: no changes made.');
    return removals;
  }
  for (const r of removals) {
    if (!fs.existsSync(r.path) && !isLink(r.path)) continue;
    if (isLink(r.path)) {
      removeLink(r.path);
      continue;
    }
    const manifest = r.target === 'gemini' ? 'gemini-extension.json' : r.target === 'mirror' ? MARKER : 'plugin.json';
    const owned = r.target === 'mirror' ? fs.existsSync(path.join(r.path, MARKER)) : readName(path.join(r.path, manifest)) === NAME;
    if (!owned) {
      log(`  skipped ${r.path} (no longer owned by Everything Antigravity)`);
      continue;
    }
    fs.rmSync(r.path, { recursive: true, force: true });
  }
  fs.rmSync(stateFile, { force: true });
  if (opts.purge) {
    fs.rmSync(opts.eagHome, { recursive: true, force: true });
    log('Purged learned data (sessions, instincts, config).');
  } else {
    log(`Kept learned data in ${opts.eagHome} (use --purge to delete it).`);
  }
  return removals;
}

function readVersion(root = REPO_ROOT) {
  for (const f of ['plugin.json', 'gemini-extension.json', 'package.json']) {
    try {
      const v = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).version;
      if (v) return v;
    } catch { /* try next */ }
  }
  return '0.0.0';
}

module.exports = { REPO_ROOT, NAME, ANTIGRAVITY_PAYLOAD, GEMINI_PAYLOAD, plan, install, uninstall, findV1Links, findAgy, which, smokeTest, readVersion, isLink };
