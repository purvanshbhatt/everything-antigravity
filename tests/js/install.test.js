'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const EAG = path.join(ROOT, 'bin', 'eag.js');

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-inst-'));
  fs.mkdirSync(path.join(home, '.gemini', 'config', 'plugins'), { recursive: true });
  return home;
}

function eag(args, home, extraEnv = {}) {
  const res = spawnSync(process.execPath, [EAG, ...args, '--home', home], {
    encoding: 'utf8',
    env: { ...process.env, EAG_HOME: '', EAG_NO_AGY: '1', ...extraEnv },
    timeout: 60000,
  });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

function linkDir(target, linkPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

test('install copies a clean plugin bundle into ~/.gemini/config/plugins', () => {
  const home = fakeHome();
  const r = eag(['install', '--yes'], home);
  assert.equal(r.code, 0, r.out + r.err);
  const dest = path.join(home, '.gemini', 'config', 'plugins', 'everything-antigravity');
  const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'everything-antigravity');
  for (const p of ['hooks.json', 'rules/AGENTS.md', 'skills/code-review/SKILL.md', 'agents/code-reviewer.md', 'scripts/hooks/run.js', 'bin/eag.js', 'assets/logo.svg']) {
    assert.ok(fs.existsSync(path.join(dest, p)), `missing ${p}`);
  }
  for (const p of ['tests', 'src', 'marketing', 'commands', 'gemini-extension.json', 'hooks/hooks.json', 'node_modules']) {
    assert.ok(!fs.existsSync(path.join(dest, p)), `should not ship ${p}`);
  }
  const state = JSON.parse(fs.readFileSync(path.join(home, '.gemini', 'eag', 'install-state.json'), 'utf8'));
  assert.equal(state.targets.antigravity.path, dest);
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.gemini', 'eag', 'config.json'), 'utf8'));
  assert.equal(cfg.profile, 'standard');
});

test('install smoke-tests the hooks it just installed', () => {
  const home = fakeHome();
  const r = eag(['install', '--yes'], home);
  assert.match(r.out, /hook smoke test: pass/i);
});

test('install removes v1 links that point into an everything-antigravity checkout, and nothing else', () => {
  const home = fakeHome();
  const v1 = path.join(home, 'npm', 'node_modules', 'everything-antigravity', 'skills', 'agent-shield');
  fs.mkdirSync(v1, { recursive: true });
  fs.writeFileSync(path.join(v1, 'SKILL.md'), '---\nname: agent-shield\ndescription: v1\n---\n');
  const v1Link = path.join(home, '.gemini', 'config', 'skills', 'agent-shield');
  linkDir(v1, v1Link);
  const v1PluginTarget = path.join(home, 'npm', 'node_modules', 'everything-antigravity', 'plugins', 'everything-antigravity');
  fs.mkdirSync(v1PluginTarget, { recursive: true });
  fs.writeFileSync(path.join(v1PluginTarget, 'plugin.json'), '{"name":"everything-antigravity"}');
  linkDir(v1PluginTarget, path.join(home, '.gemini', 'config', 'plugins', 'everything-antigravity'));
  const mine = path.join(home, '.gemini', 'config', 'skills', 'my-own-skill');
  fs.mkdirSync(mine, { recursive: true });
  fs.writeFileSync(path.join(mine, 'SKILL.md'), 'keep me');

  const r = eag(['install', '--yes'], home);
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(!fs.existsSync(v1Link), 'v1 skill link should be removed');
  assert.ok(fs.existsSync(path.join(v1, 'SKILL.md')), 'link target must not be deleted');
  assert.ok(fs.existsSync(path.join(mine, 'SKILL.md')), 'user skill must be untouched');
  const dest = path.join(home, '.gemini', 'config', 'plugins', 'everything-antigravity');
  assert.ok(!fs.lstatSync(dest).isSymbolicLink(), 'v1 plugin link replaced by a real copy');
  assert.ok(fs.existsSync(path.join(dest, 'skills', 'code-review', 'SKILL.md')));
});

test('v1 links of other harnesses are only cleaned when that harness is a target', () => {
  const home = fakeHome();
  const v1 = path.join(home, 'npm', 'node_modules', 'everything-antigravity', 'skills', 'agent-shield');
  fs.mkdirSync(v1, { recursive: true });
  const cursorLink = path.join(home, '.cursor', 'skills', 'agent-shield');
  linkDir(v1, cursorLink);
  eag(['install', '--yes', '--target', 'antigravity'], home);
  assert.ok(fs.existsSync(cursorLink), 'antigravity-only install must not touch ~/.cursor/skills');
  eag(['install', '--yes', '--target', 'antigravity,cursor'], home);
  assert.ok(!fs.lstatSync(cursorLink).isSymbolicLink(), 'cursor target replaces the v1 link with a managed copy');
  assert.ok(fs.existsSync(path.join(cursorLink, '.eag-managed')));
});

test('reinstall works while the plugin folder is held open (Antigravity running) and drops stale files', () => {
  const home = fakeHome();
  assert.equal(eag(['install', '--yes', '--target', 'antigravity'], home).code, 0);
  const dest = path.join(home, '.gemini', 'config', 'plugins', 'everything-antigravity');
  fs.writeFileSync(path.join(dest, 'skills', 'stale-file.md'), 'left over from an older version');
  // A live process whose working directory is the plugin folder (as Antigravity's hook and
  // server processes are) makes Windows refuse to rename or delete that folder.
  const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { cwd: dest, stdio: 'ignore' });
  let r;
  try {
    r = eag(['install', '--yes', '--target', 'antigravity'], home);
  } finally {
    holder.kill();
  }
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(!fs.existsSync(path.join(dest, 'skills', 'stale-file.md')), 'files no longer shipped are removed');
  assert.ok(fs.existsSync(path.join(dest, 'skills', 'code-review', 'SKILL.md')));
  const backups = fs.readdirSync(path.join(home, '.gemini', 'eag', 'backups'));
  assert.ok(backups.length >= 1, 'previous copy is backed up');
});

test('install refuses to overwrite a foreign plugin with the same directory name', () => {
  const home = fakeHome();
  const dest = path.join(home, '.gemini', 'config', 'plugins', 'everything-antigravity');
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'plugin.json'), '{"name":"somebody-else"}');
  const r = eag(['install', '--yes'], home);
  assert.notEqual(r.code, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, 'plugin.json'), 'utf8')).name, 'somebody-else');
});

test('dry-run writes nothing', () => {
  const home = fakeHome();
  const r = eag(['install', '--dry-run'], home);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /dry run/i);
  assert.ok(!fs.existsSync(path.join(home, '.gemini', 'config', 'plugins', 'everything-antigravity')));
  assert.ok(!fs.existsSync(path.join(home, '.gemini', 'eag', 'install-state.json')));
});

test('gemini target installs an extension without agents and with Gemini hooks', () => {
  const home = fakeHome();
  const r = eag(['install', '--yes', '--target', 'gemini'], home);
  assert.equal(r.code, 0, r.out + r.err);
  const ext = path.join(home, '.gemini', 'extensions', 'everything-antigravity');
  assert.ok(fs.existsSync(path.join(ext, 'gemini-extension.json')));
  assert.ok(fs.existsSync(path.join(ext, 'hooks', 'hooks.json')));
  assert.ok(fs.existsSync(path.join(ext, 'skills', 'code-review', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(ext, 'rules', 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(ext, 'agents')));
  assert.ok(!fs.existsSync(path.join(home, '.gemini', 'config', 'plugins', 'everything-antigravity')), 'only the requested target');
});

test('uninstall removes exactly what install created and keeps learned data', () => {
  const home = fakeHome();
  eag(['install', '--yes', '--target', 'antigravity,gemini'], home);
  const dataFile = path.join(home, '.gemini', 'eag', 'instincts', 'global.json');
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, '{"version":1,"instincts":[]}');
  const r = eag(['uninstall', '--yes'], home);
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(!fs.existsSync(path.join(home, '.gemini', 'config', 'plugins', 'everything-antigravity')));
  assert.ok(!fs.existsSync(path.join(home, '.gemini', 'extensions', 'everything-antigravity')));
  assert.ok(fs.existsSync(dataFile), 'instincts survive uninstall');
});

test('doctor reports a healthy install as JSON', () => {
  const home = fakeHome();
  eag(['install', '--yes'], home);
  const r = eag(['doctor', '--json'], home);
  assert.equal(r.code, 0, r.out + r.err);
  const report = JSON.parse(r.out);
  assert.ok(Array.isArray(report.checks));
  const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
  assert.equal(byId['antigravity-plugin'], 'pass');
  assert.equal(byId['hooks-smoke'], 'pass');
  assert.equal(byId['v1-leftovers'], 'pass');
});
