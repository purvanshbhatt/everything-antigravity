#!/usr/bin/env node
'use strict';
/**
 * eag: the Everything Antigravity command-line tool.
 * Zero dependencies; Node.js 18+. Run `eag help` for usage.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// ------------------------------------------------------------------ args
function parseArgs(argv) {
  const BOOL = new Set(['yes', 'y', 'dry-run', 'json', 'link', 'force', 'purge', 'help', 'h', 'version', 'v', 'strict', 'summary-only', 'all']);
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') || (a.startsWith('-') && a.length === 2)) {
      const key = a.replace(/^--?/, '');
      const [k, inline] = key.split('=');
      if (inline !== undefined) out[k] = inline;
      else if (BOOL.has(k)) out[k] = true;
      else out[k] = argv[++i];
    } else {
      out._.push(a);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const HOME = path.resolve(args.home || os.homedir());
if (!process.env.EAG_HOME) process.env.EAG_HOME = path.join(HOME, '.gemini', 'eag');
const EAG_HOME = process.env.EAG_HOME;

// Libraries read EAG_HOME at call time, so require after setting it.
const install = require('../scripts/lib/install');
const { runDoctor } = require('../scripts/lib/doctor');
const instincts = require('../scripts/lib/instincts');
const sessions = require('../scripts/lib/sessions');
const { classifyCommand, scanSecrets, scanInjection } = require('../scripts/lib/shield');
const { resolveConfig, setProfile, PROFILES } = require('../scripts/lib/config');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const VERSION = install.readVersion(ROOT);
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const ok = (s) => c(32, s);
const warn = (s) => c(33, s);
const bad = (s) => c(31, s);
const dim = (s) => c(2, s);

class UsageError extends Error {}

const project = () => path.resolve(args.project || process.cwd());

const HELP = `Everything Antigravity ${VERSION}: skills, agents, rules and hooks for Antigravity and Gemini CLI

Usage: eag <command> [options]

Setup
  install [--target antigravity,gemini,cursor,codex] [--profile minimal|standard|strict]
          [--link] [--dry-run] [--force] [--yes] [--home <dir>]
  uninstall [--dry-run] [--purge] [--yes]
  doctor [--json]                     Health check of the installation
  budget [--json]                     Live context budget per plugin, and which skills Antigravity is dropping
  status                              Version, profile and component counts
  update                              How to update for your install method
  validate [--json] [--strict]        Validate this repository (contributors)

Daily use
  list [skills|workflows|agents|rules]
  profile get | profile set <minimal|standard|strict>
  sessions list|latest|save [--project <dir>] [--title <t>]   (save reads markdown from stdin or --text)
  instincts list [--min 0.7] [--json] | add --trigger "<when>" --action "<do>" [--confidence 0.5]
            [--scope project|global] [--evidence "<why>"] | reinforce <id> | weaken <id> | remove <id>
            | promote <id> --skill <name> | prune [--below 0.3] | export [--out file] | import <file>
            (all accept --project <dir>)
  shield --text "<s>" | --file <path> | --cmd "<command>" [--json]   (exit 1 on findings)
  compact --file <log> | --text "<s>" [--summary-only]               Strip ANSI, collapse repeated lines
  mcp list | show <name> | add <name> [--yes] [--force]

Environment: EAG_HOME (state dir, default ~/.gemini/eag), EAG_HOOK_PROFILE, EAG_DISABLED_HOOKS
Docs: https://github.com/purvanshbhatt/everything-antigravity`;

// ------------------------------------------------------------------ helpers
function confirm(question) {
  if (args.yes || args.y || !process.stdin.isTTY) return true;
  process.stdout.write(`${question} [y/N] `);
  const buf = Buffer.alloc(16);
  let n = 0;
  try { n = fs.readSync(0, buf, 0, 16, null); } catch { n = 0; }
  return /^y/i.test(buf.toString('utf8', 0, n).trim());
}

function readStdinText() {
  if (process.stdin.isTTY) return '';
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function listSkillsFast() {
  const dir = path.join(ROOT, 'skills');
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SKILL.md'))).sort().map((name) => {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(dir, name, 'SKILL.md'), 'utf8'));
    const desc = (data && data.description) || '';
    return { name, description: desc, workflow: /Invoke with \//.test(desc) };
  });
}

function listAgentsFast() {
  const dir = path.join(ROOT, 'agents');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { name: f.replace(/\.md$/, ''), description: (data && data.description) || '', model: (data && data.model) || 'inherit' };
  });
}

const firstSentence = (s) => String(s).split(/(?<=\.)\s/)[0].slice(0, 110);

// ------------------------------------------------------------------ commands
const commands = {
  help() {
    console.log(HELP);
    return 0;
  },

  install() {
    const targets = args.target ? String(args.target).split(',').map((s) => s.trim()).filter(Boolean) : null;
    if (args.profile && !PROFILES.includes(args.profile)) throw new UsageError(`Unknown profile "${args.profile}"`);
    const opts = { home: HOME, eagHome: EAG_HOME, targets, link: !!args.link, dryRun: !!args['dry-run'], force: !!args.force, profile: args.profile };
    if (!opts.dryRun && !(args.yes || args.y) && process.stdin.isTTY) {
      const preview = install.plan(opts);
      const dests = [...new Set(preview.actions.filter((a) => ['copy', 'link'].includes(a.type)).map((a) => a.path))];
      console.log(`Will install to:\n  ${dests.join('\n  ')}`);
      if (!confirm('Proceed?')) {
        console.log('Cancelled.');
        return 1;
      }
    }
    install.install(opts);
    return 0;
  },

  uninstall() {
    if (!args['dry-run'] && !confirm(`Remove Everything Antigravity${args.purge ? ' AND all learned data' : ''}?`)) return 1;
    install.uninstall({ home: HOME, eagHome: EAG_HOME, dryRun: !!args['dry-run'], purge: !!args.purge });
    return 0;
  },

  budget() {
    // Async: sets process.exitCode itself so main() stays synchronous for every other command.
    const { readBudget } = require('../scripts/lib/budget');
    readBudget(HOME).then((b) => {
      if (args.json) {
        console.log(JSON.stringify(b, null, 2));
      } else {
        const pct = Math.round((b.used / b.budget) * 100);
        console.log(`Antigravity customization budget: ${b.used.toLocaleString()} / ${b.budget.toLocaleString()} tokens (${pct}%)  ${b.overBudget ? bad(`OVER by ${(-b.remaining).toLocaleString()}`) : ok(`${b.remaining.toLocaleString()} left`)}\n`);
        for (const g of b.groups.filter((x) => x.name !== 'Rules')) {
          console.log(`  ${g.name.padEnd(10)} ${String(g.tokens).padStart(7)} tokens  ${String(g.items).padStart(4)} items${g.cutItems ? bad(`  ${g.cutItems} dropped (${g.cutTokens} tokens)`) : ''}`);
        }
        console.log('\n  Skills by plugin (most expensive first):');
        for (const p of b.byPlugin.slice(0, 12)) console.log(`    ${String(p.tokens).padStart(7)}  ${p.plugin.padEnd(34)} ${String(p.skills).padStart(4)} skills${p.cut ? warn(`  ${p.cut} dropped`) : ''}`);
        if (b.overBudget) {
          console.log(`\n  ${warn('Antigravity silently drops the most expensive skills when over budget.')}`);
          console.log('  Disable plugins you do not use on the Customizations page, or shorten skill descriptions.');
        }
      }
      process.exitCode = b.overBudget ? 1 : 0;
    }).catch((err) => {
      console.error(`eag budget: ${err.message}`);
      process.exitCode = 1;
    });
    return undefined;
  },

  doctor() {
    const report = runDoctor({ home: HOME, eagHome: EAG_HOME });
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`Everything Antigravity doctor (v${report.version})\n`);
      for (const ch of report.checks) {
        const mark = { pass: ok('PASS'), warn: warn('WARN'), fail: bad('FAIL'), skip: dim('SKIP') }[ch.status];
        console.log(`  ${mark}  ${ch.id.padEnd(19)} ${ch.message}${ch.fix ? `\n        ${dim(`fix: ${ch.fix}`)}` : ''}`);
      }
    }
    return report.checks.some((ch) => ch.status === 'fail') ? 1 : 0;
  },

  status() {
    const skills = listSkillsFast();
    const agents = listAgentsFast();
    const rules = fs.readdirSync(path.join(ROOT, 'rules')).filter((f) => f.endsWith('.md'));
    const cfg = resolveConfig();
    let state = null;
    try { state = JSON.parse(fs.readFileSync(path.join(EAG_HOME, 'install-state.json'), 'utf8')); } catch { state = null; }
    console.log(`Everything Antigravity ${VERSION}
  skills      ${skills.length} (${skills.filter((s) => s.workflow).length} slash-command workflows)
  agents      ${agents.length}
  rules       ${rules.length}
  profile     ${cfg.profile}  (${Object.entries(cfg.features).filter(([, v]) => v).map(([k]) => k).join(', ')})
  state dir   ${EAG_HOME}
  installed   ${state ? Object.entries(state.targets).map(([t, v]) => `${t} → ${v.path}`).join('\n              ') : 'no (run: eag install)'}`);
    return 0;
  },

  update() {
    const viaNpm = ROOT.includes(`${path.sep}node_modules${path.sep}`);
    console.log(viaNpm
      ? 'Installed from npm. Update with:\n  npm install -g everything-antigravity@latest\n  eag install'
      : `Running from ${ROOT}. Update with:\n  git -C "${ROOT}" pull\n  node "${path.join(ROOT, 'bin', 'eag.js')}" install`);
    return 0;
  },

  validate() {
    const { validateRepo } = require('../scripts/lib/validate');
    const r = validateRepo(ROOT);
    if (args.json) {
      console.log(JSON.stringify({ errors: r.errors, warnings: r.warnings, stats: r.stats }, null, 2));
    } else {
      for (const e of r.errors) console.log(`${bad('error')}  ${e}`);
      for (const w of r.warnings) console.log(`${warn('warn ')}  ${w}`);
      console.log(`\n${r.errors.length ? bad('FAILED') : ok('OK')}  ${JSON.stringify(r.stats)}  (${r.errors.length} errors, ${r.warnings.length} warnings)`);
    }
    return r.errors.length || (args.strict && r.warnings.length) ? 1 : 0;
  },

  list() {
    const what = args._[1] || 'skills';
    if (what === 'skills' || what === 'workflows') {
      const all = listSkillsFast().filter((s) => what === 'skills' || s.workflow);
      for (const s of all) console.log(`  ${(s.workflow ? `/${s.name}` : s.name).padEnd(30)} ${dim(firstSentence(s.description))}`);
      console.log(`\n${all.length} ${what}`);
    } else if (what === 'agents') {
      const all = listAgentsFast();
      for (const a of all) console.log(`  ${a.name.padEnd(24)} ${a.model.padEnd(8)} ${dim(firstSentence(a.description))}`);
      console.log(`\n${all.length} agents`);
    } else if (what === 'rules') {
      for (const f of fs.readdirSync(path.join(ROOT, 'rules')).filter((x) => x.endsWith('.md')).sort()) {
        const { data } = parseFrontmatter(fs.readFileSync(path.join(ROOT, 'rules', f), 'utf8'));
        console.log(`  ${f.padEnd(24)} ${data ? `${data.trigger}${data.globs ? `  ${data.globs}` : ''}` : 'always_on'}`);
      }
    } else {
      throw new UsageError('list what? skills | workflows | agents | rules');
    }
    return 0;
  },

  profile() {
    const sub = args._[1] || 'get';
    if (sub === 'get') {
      console.log(resolveConfig().profile);
      return 0;
    }
    if (sub === 'set') {
      const p = args._[2];
      if (!PROFILES.includes(p)) throw new UsageError(`Unknown profile "${p}". Use one of: ${PROFILES.join(', ')}`);
      setProfile(p);
      console.log(`Hook profile set to ${p}. Takes effect on the next hook call; no reinstall needed.`);
      return 0;
    }
    throw new UsageError('profile get | profile set <minimal|standard|strict>');
  },

  sessions() {
    const sub = args._[1] || 'list';
    if (sub === 'list') {
      const all = sessions.listSessions(project());
      if (!all.length) console.log(`No saved sessions for ${project()}`);
      for (const s of all.slice(0, 20)) console.log(`  ${sessions.relativeTime(s.mtime).padEnd(12)} ${s.kind.padEnd(6)} ${s.title}  ${dim(s.file)}`);
      return 0;
    }
    if (sub === 'latest') {
      const s = sessions.latestSession(project());
      console.log(s ? s.content : `No saved sessions for ${project()}`);
      return 0;
    }
    if (sub === 'save') {
      const body = args.text !== undefined ? String(args.text) : readStdinText();
      if (!body.trim()) throw new UsageError('Pipe the summary markdown on stdin, or pass --text "<markdown>".');
      console.log(sessions.saveSession({ project: project(), body, title: args.title || (body.match(/^#\s+(.+)$/m) || [])[1] || 'session', kind: 'manual' }));
      return 0;
    }
    throw new UsageError('sessions list | latest | save');
  },

  instincts() {
    const sub = args._[1] || 'list';
    const proj = project();
    if (sub === 'list') {
      const items = instincts.listInstincts({ project: proj, min: Number(args.min || 0) });
      if (args.json) console.log(JSON.stringify(items, null, 2));
      else if (!items.length) console.log('No instincts yet. Capture one with /instinct-capture or `eag instincts add`.');
      else for (const i of items) console.log(`  ${i.id}  ${i.confidence.toFixed(2)}  ${i.scope.padEnd(7)} ${i.trigger} → ${i.action}${i.seen > 1 ? dim(` (seen ${i.seen}x)`) : ''}`);
      return 0;
    }
    if (sub === 'add') {
      const r = instincts.addInstinct({ trigger: args.trigger, action: args.action, confidence: args.confidence !== undefined ? Number(args.confidence) : 0.5, scope: args.scope || 'project', evidence: args.evidence, project: proj });
      console.log(r.created ? `Added ${r.id} (confidence ${r.confidence})` : `Reinforced existing ${r.id} (confidence ${r.confidence})`);
      return 0;
    }
    if (sub === 'export') {
      const data = JSON.stringify({ version: 1, exported: new Date().toISOString(), instincts: instincts.listInstincts({ project: proj }) }, null, 2);
      if (args.out) {
        fs.writeFileSync(path.resolve(args.out), `${data}\n`);
        console.log(`Exported to ${path.resolve(args.out)}`);
      } else {
        console.log(data);
      }
      return 0;
    }
    if (sub === 'import') {
      const file = args._[2];
      if (!file) throw new UsageError('instincts import <file>');
      const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
      let added = 0;
      let merged = 0;
      for (const i of data.instincts || []) {
        const r = instincts.addInstinct({ trigger: i.trigger, action: i.action, confidence: i.confidence, scope: i.scope, evidence: (i.evidence || [])[0], project: proj });
        if (r.created) added++;
        else merged++;
      }
      console.log(`Imported ${added} new, reinforced ${merged} existing instinct(s).`);
      return 0;
    }
    const id = args._[2];
    if (['reinforce', 'weaken', 'remove', 'promote'].includes(sub) && !id) throw new UsageError(`instincts ${sub} <id>`);
    if (sub === 'reinforce' || sub === 'weaken') {
      const i = instincts[sub](id, proj);
      console.log(`${i.id} confidence → ${i.confidence}`);
      return 0;
    }
    if (sub === 'remove') {
      instincts.removeInstinct(id, proj);
      console.log(`Removed ${id}`);
      return 0;
    }
    if (sub === 'promote') {
      if (!args.skill) throw new UsageError('instincts promote <id> --skill <kebab-name>');
      console.log(`Scaffolded ${instincts.promote(id, args.skill, proj)}. Flesh it out following docs/AUTHORING.md.`);
      return 0;
    }
    if (sub === 'prune') {
      const below = Number(args.below || 0.3);
      console.log(`Pruned ${instincts.prune({ below, project: proj })} instinct(s) below ${below}`);
      return 0;
    }
    throw new UsageError('instincts list | add | reinforce | weaken | remove | promote | prune | export | import');
  },

  shield() {
    const result = { command: null, secrets: [], injection: [] };
    if (args.cmd) result.command = classifyCommand(args.cmd, { profile: resolveConfig().profile });
    const text = args.text !== undefined ? String(args.text) : args.file ? fs.readFileSync(path.resolve(args.file), 'utf8') : '';
    if (text) {
      result.secrets = scanSecrets(text);
      result.injection = scanInjection(text);
    }
    if (!args.cmd && !text) throw new UsageError('shield --text "<s>" | --file <path> | --cmd "<command>"');
    const findings = (result.command && result.command.level !== 'ok' ? 1 : 0) + result.secrets.length + result.injection.length;
    if (args.json) {
      console.log(JSON.stringify({ passed: findings === 0, ...result }, null, 2));
    } else {
      if (result.command) console.log(`command: ${result.command.level === 'ok' ? ok('ok') : result.command.level === 'deny' ? bad('DENY') : warn('ASK')}${result.command.reasons.length ? `: ${result.command.reasons.join('; ')}` : ''}`);
      for (const s of result.secrets) console.log(`${bad('secret')}    ${s.id} (${s.severity}) line ${s.line}: ${s.preview}`);
      for (const i of result.injection) console.log(`${warn('injection')} ${i.id} line ${i.line}`);
      console.log(findings ? bad(`${findings} finding(s)`) : ok('clean'));
    }
    return findings ? 1 : 0;
  },

  compact() {
    const raw = args.text !== undefined ? String(args.text) : args.file ? fs.readFileSync(path.resolve(args.file), 'utf8') : readStdinText();
    if (!raw) throw new UsageError('compact --file <log> | --text "<s>" (or pipe stdin)');
    // eslint-disable-next-line no-control-regex
    const clean = raw.replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g, '').replace(/\r(?!\n)/g, '\n');
    const out = [];
    let prev = null;
    let count = 0;
    const flush = () => { if (prev !== null) out.push(count > 1 ? `${prev}  [x${count}]` : prev); };
    for (const line of clean.split('\n').map((l) => l.trimEnd())) {
      if (line === prev) {
        count++;
        continue;
      }
      flush();
      prev = line;
      count = 1;
    }
    flush();
    const text = out.join('\n').replace(/\n{3,}/g, '\n\n');
    if (!args['summary-only']) console.log(text);
    console.log(`Compacted: ${raw.length} → ${text.length} chars (${raw.length ? Math.round((1 - text.length / raw.length) * 100) : 0}% smaller)`);
    return 0;
  },

  mcp() {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'mcp-configs', 'catalog.json'), 'utf8'));
    const sub = args._[1] || 'list';
    if (sub === 'list') {
      let last = '';
      for (const [name, s] of Object.entries(cat.servers)) {
        if (s.category && s.category !== last) console.log(`\n${s.category}`);
        last = s.category || last;
        console.log(`  ${name.padEnd(28)} ${s.official === false ? warn('community ') : ''}${dim(s.description)}`);
      }
      console.log(`\n${dim(cat.note)}`);
      return 0;
    }
    const name = args._[2];
    const entry = cat.servers[name];
    if (!entry) throw new UsageError(`Unknown server "${name || ''}". Run: eag mcp list`);
    if (sub === 'show') {
      console.log(JSON.stringify({ [name]: entry.config }, null, 2));
      console.log(`\nWhen: ${entry.when}${entry.requiresSecret ? `\nNeeds: ${entry.requiresSecret}; set it in Antigravity's MCP settings, never in a committed file.` : ''}`);
      return 0;
    }
    if (sub === 'add') {
      const file = path.join(HOME, '.gemini', 'config', 'mcp_config.json');
      let current = { mcpServers: {} };
      if (fs.existsSync(file)) current = JSON.parse(fs.readFileSync(file, 'utf8'));
      current.mcpServers = current.mcpServers || {};
      if (current.mcpServers[name] && !args.force) throw new UsageError(`"${name}" already exists in ${file}. Use --force to replace it.`);
      const next = { ...current, mcpServers: { ...current.mcpServers, [name]: entry.config } };
      if (!args.yes) {
        console.log(`Preview (not written). Would add to ${file}:\n${JSON.stringify({ [name]: entry.config }, null, 2)}\nRe-run with --yes to apply.`);
        return 0;
      }
      if (fs.existsSync(file)) {
        const backup = path.join(EAG_HOME, 'backups', `mcp_config.${Date.now()}.json`);
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.copyFileSync(file, backup);
        console.log(`Backed up previous config to ${backup}`);
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
      console.log(`Added "${name}" to ${file}.${entry.requiresSecret ? ` Provide ${entry.requiresSecret} through Antigravity's MCP settings before enabling it.` : ''}`);
      return 0;
    }
    throw new UsageError('mcp list | show <name> | add <name> [--yes]');
  },
};

// ------------------------------------------------------------------ main
function main() {
  if (args.version || args.v) {
    console.log(VERSION);
    return 0;
  }
  const cmd = args._[0] || 'help';
  if (args.help || args.h || cmd === 'help') return commands.help();
  const fn = commands[cmd];
  if (!fn) {
    console.error(`Unknown command "${cmd}". Run: eag help`);
    return 2;
  }
  return fn();
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(err instanceof UsageError ? err.message : `eag: ${err.message}`);
  process.exitCode = err instanceof UsageError ? 2 : 1;
}
