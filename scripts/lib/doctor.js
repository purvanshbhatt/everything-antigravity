'use strict';
/** `eag doctor`: health checks for an Everything Antigravity installation. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { NAME, REPO_ROOT, findV1Links, findAgy, smokeTest, readVersion, isLink } = require('./install');

function size(file) {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/**
 * @param {{home: string, eagHome: string}} opts
 * @returns {{version: string, checks: {id: string, status: 'pass'|'warn'|'fail'|'skip', message: string, fix?: string}[]}}
 */
function runDoctor({ home, eagHome }) {
  const checks = [];
  const add = (id, status, message, fix) => checks.push({ id, status, message, ...(fix ? { fix } : {}) });

  const major = Number(process.versions.node.split('.')[0]);
  add('node', major >= 18 ? 'pass' : 'fail', `Node.js ${process.versions.node}`, major >= 18 ? undefined : 'Install Node.js 18 or newer; hooks run on Node.');

  const plugin = path.join(home, '.gemini', 'config', 'plugins', NAME);
  let installedVersion = null;
  if (fs.existsSync(path.join(plugin, 'plugin.json'))) {
    try { installedVersion = JSON.parse(fs.readFileSync(path.join(plugin, 'plugin.json'), 'utf8')).version; } catch { installedVersion = null; }
  }
  const repoVersion = readVersion(REPO_ROOT);
  if (!installedVersion) add('antigravity-plugin', 'fail', 'Antigravity plugin is not installed', 'Run: eag install');
  else if (installedVersion !== repoVersion && !isLink(plugin)) add('antigravity-plugin', 'warn', `Installed ${installedVersion}, this copy is ${repoVersion}`, 'Run: eag install (from the newer copy)');
  else add('antigravity-plugin', 'pass', `Installed ${installedVersion}${isLink(plugin) ? ' (development link)' : ''} at ${plugin}`);

  const v1 = findV1Links(home);
  add('v1-leftovers', v1.length ? 'warn' : 'pass', v1.length ? `${v1.length} v1 link(s) still present, e.g. ${v1[0].path}` : 'No v1 leftovers', v1.length ? 'Run: eag install (it removes v1 links safely)' : undefined);

  const pluginSkills = new Set();
  try { for (const d of fs.readdirSync(path.join(plugin, 'skills'))) pluginSkills.add(d); } catch { /* not installed */ }
  const loose = [];
  try {
    for (const d of fs.readdirSync(path.join(home, '.gemini', 'config', 'skills'))) {
      const p = path.join(home, '.gemini', 'config', 'skills', d);
      if (pluginSkills.has(d) && !isLink(p)) loose.push(d);
    }
  } catch { /* none */ }
  add('duplicate-skills', loose.length ? 'warn' : 'pass', loose.length ? `Loose global skills shadow plugin skills: ${loose.slice(0, 5).join(', ')}` : 'No duplicate skill names', loose.length ? 'Remove or rename the loose copies in ~/.gemini/config/skills (workspace and global skills take precedence over plugin skills).' : undefined);

  const alwaysOn = [path.join(plugin, 'rules', 'AGENTS.md'), path.join(home, '.gemini', 'GEMINI.md')];
  try {
    for (const f of fs.readdirSync(path.join(home, '.gemini', 'config', 'rules'))) alwaysOn.push(path.join(home, '.gemini', 'config', 'rules', f));
  } catch { /* none */ }
  const tokens = Math.round(alwaysOn.reduce((n, f) => n + size(f), 0) / 4);
  add('rules-budget', tokens > 20000 ? 'fail' : tokens > 12000 ? 'warn' : 'pass', `~${tokens} tokens of always-on/global rules (budget 20,000)`, tokens > 12000 ? 'Move procedures into skills and scope rules with trigger: glob or model_decision.' : undefined);

  if (installedVersion) {
    const s = smokeTest(plugin, eagHome);
    add('hooks-smoke', s.pass ? 'pass' : 'fail', s.pass ? 'Guard denies `rm -rf /` and stays silent for `echo ok`' : `Hook smoke test failed: ${JSON.stringify(s.detail).slice(0, 200)}`, s.pass ? undefined : `Check ${path.join(eagHome, 'logs', 'hooks.log')}`);
  } else {
    add('hooks-smoke', 'skip', 'Plugin not installed');
  }

  try {
    fs.mkdirSync(eagHome, { recursive: true });
    const probe = path.join(eagHome, `.probe-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    add('state-dir', 'pass', `State directory writable: ${eagHome}`);
  } catch (err) {
    add('state-dir', 'fail', `Cannot write ${eagHome}: ${err.message}`, 'Fix permissions or set EAG_HOME to a writable directory.');
  }

  const cfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(eagHome, 'config.json'), 'utf8')); } catch { return {}; } })();
  add('profile', 'pass', `Hook profile: ${process.env.EAG_HOOK_PROFILE || cfg.profile || 'standard'}`);

  const ext = path.join(home, '.gemini', 'extensions', NAME);
  if (fs.existsSync(ext)) add('gemini-extension', 'pass', `Gemini CLI extension present at ${ext}`);
  else add('gemini-extension', 'skip', 'Gemini CLI extension not installed (optional: eag install --target gemini)');

  const agy = findAgy(home);
  if (!agy || !installedVersion) {
    add('agy-validate', 'skip', agy ? 'Plugin not installed' : 'agy CLI not found (optional)');
  } else {
    const r = spawnSync(agy, ['plugin', 'validate', plugin, '--json'], { encoding: 'utf8', timeout: 60000 });
    try {
      const rep = JSON.parse(r.stdout);
      const findings = rep.findings || [];
      const c = rep.components || {};
      add('agy-validate', findings.length ? 'warn' : 'pass', `agy sees skills ${c.skills} · agents ${c.agents} · rules ${c.rules} · hooks ${c.hooks}${findings.length ? ` · ${findings.length} finding(s)` : ''}`);
    } catch {
      add('agy-validate', 'warn', `agy plugin validate returned no JSON (exit ${r.status})`);
    }
  }

  return { version: repoVersion, checks };
}

module.exports = { runDoctor };
