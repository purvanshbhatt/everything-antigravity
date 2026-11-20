#!/usr/bin/env node
'use strict';
/**
 * Everything Antigravity hook runner.
 *
 *   node scripts/hooks/run.js <event> [--harness antigravity|gemini]
 *
 * Events: pre-tool, post-tool, session-start, pre-invocation, stop, session-end.
 * Contract: ALWAYS exit 0 (a non-zero exit fails the tool call in Antigravity),
 * and for pre-tool print nothing unless we have a decision (`{}` means deny).
 */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

// Libraries are loaded inside the fail-open try/catch at the bottom: a broken or
// missing library must never turn into a non-zero exit (which fails the tool call).
let H;
let resolveConfig;
let classifyCommand;
let scanSecrets;
let S;
let saveSession;
let latestSession;
let relativeTime;
let topForInjection;
let stackHint;
let detectStack;
let logError = () => {};

function load() {
  H = require('../lib/harness');
  ({ resolveConfig } = require('../lib/config'));
  ({ classifyCommand, scanSecrets } = require('../lib/shield'));
  S = require('../lib/state');
  ({ saveSession, latestSession, relativeTime } = require('../lib/sessions'));
  ({ topForInjection } = require('../lib/instincts'));
  ({ stackHint, detectStack } = require('../lib/stack'));
  ({ logError } = require('../lib/paths'));
}

const argv = process.argv.slice(2);
const EVENT = argv[0] || '';
const hIdx = argv.indexOf('--harness');
const HARNESS = hIdx >= 0 && argv[hIdx + 1] === 'gemini' ? 'gemini' : 'antigravity';

function emit(obj) {
  if (obj === null || obj === undefined) return;
  process.stdout.write(JSON.stringify(obj));
}

function fallback() {
  return EVENT === 'pre-tool' && HARNESS === 'antigravity' ? null : {};
}

function rel(ws, p) {
  try {
    const r = path.relative(ws, p);
    return r && !r.startsWith('..') && !path.isAbsolute(r) ? r.replace(/\\/g, '/') : p;
  } catch {
    return p;
  }
}

// ---------------------------------------------------------------- pre-tool
function preTool(ev, cfg) {
  const f = cfg.features;
  if (H.isCommandTool(ev.tool)) {
    if (!f.guard) return fallback();
    const v = classifyCommand(H.commandOf(ev.args), { profile: f.ask ? cfg.profile : 'minimal' });
    if (v.level === 'ok') return H.renderPreTool(HARNESS, null);
    return H.renderPreTool(HARNESS, { level: v.level, reason: `${v.level === 'deny' ? 'blocked' : 'confirm'}: this command ${v.reasons.join('; ')}.` });
  }
  if (H.isWriteTool(ev.tool) && f.secrets) {
    const target = H.pathsOf(ev.args)[0] || '';
    const base = path.basename(target).toLowerCase();
    // Local .env files are the recommended home for secrets; committed templates are not.
    if (/^\.env(\..+)?$/.test(base) && !/\.(example|sample|template|dist|defaults)$/.test(base)) return H.renderPreTool(HARNESS, null);
    const findings = H.stringsOf(ev.args).flatMap((s) => scanSecrets(s));
    if (findings.length) {
      const where = target ? rel(ev.workspace, target) : 'a file';
      const list = findings.slice(0, 5).map((x) => `${x.id} (line ${x.line}, ${x.preview})`).join(', ');
      // force_ask is auto-approved in non-interactive runs (verified with `agy -p`), so high-confidence keys are denied.
      const high = findings.some((x) => x.severity === 'high' || x.severity === 'critical');
      return H.renderPreTool(HARNESS, high
        ? { level: 'deny', reason: `blocked: writing a real-looking credential into ${where}: ${list}. Read it from an environment variable instead (locally: a git-ignored .env file) or a secret manager. If the user explicitly wants this, they can turn the check off with EAG_DISABLED_HOOKS=secrets.` }
        : { level: 'ask', reason: `confirm: writing what may be a credential to ${where}: ${list}. Prefer an environment variable or a secret manager; never commit real secrets.` });
    }
  }
  return H.renderPreTool(HARNESS, null);
}

// ---------------------------------------------------------------- post-tool
function tryFormat(ws, file) {
  const ext = path.extname(file).toLowerCase();
  const bin = (name) => path.join(ws, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
  let cmd = null;
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.json', '.md', '.vue', '.svelte', '.html', '.yaml', '.yml'].includes(ext) && fs.existsSync(bin('prettier'))) cmd = [bin('prettier'), ['--write', file]];
  else if (ext === '.py') cmd = ['ruff', ['format', file]];
  else if (ext === '.go') cmd = ['gofmt', ['-w', file]];
  else if (ext === '.rs') cmd = ['rustfmt', [file]];
  if (!cmd) return;
  spawnSync(cmd[0], cmd[1], { cwd: ws, timeout: 15000, stdio: 'ignore', shell: process.platform === 'win32' && cmd[0].endsWith('.cmd') });
}

function postTool(ev, cfg) {
  if (!cfg.features.tracker) return {};
  const st = S.loadState(ev.conversationId);
  st.workspace = st.workspace || ev.workspace;
  if (ev.lastUserInput) st.lastUserInput = ev.lastUserInput;
  if (H.isCommandTool(ev.tool)) {
    S.recordCommand(st, H.commandOf(ev.args), !ev.error);
  } else if (H.isWriteTool(ev.tool)) {
    for (const p of H.pathsOf(ev.args)) {
      const abs = path.isAbsolute(p) ? p : path.join(ev.workspace, p);
      S.recordEdit(st, abs);
      if (cfg.features.autoFormat && !ev.error) tryFormat(ev.workspace, abs);
    }
  }
  S.saveState(st);
  return {};
}

// ---------------------------------------------------------------- session-start
function sessionStart(ev, cfg) {
  if (!cfg.features.memory && !cfg.features.instincts) return {};
  S.pruneStates(7);
  const parts = [];
  if (cfg.features.memory) {
    const last = latestSession(ev.workspace, { excludeConversation: ev.conversationId });
    if (last) {
      const body = last.content.length > 1500 ? `${last.content.slice(0, 1500)}\n…(truncated; run /session-resume for the full summary)` : last.content;
      parts.push(`Previous session (${relativeTime(last.mtime)}, ${last.kind}):\n${body.trim()}`);
    }
  }
  if (cfg.features.instincts) {
    const top = topForInjection(ev.workspace);
    if (top.length) parts.push(`Learned instincts (apply when relevant):\n${top.map((i) => `- ${i.trigger} → ${i.action} (${i.confidence.toFixed(2)}${i.scope === 'global' ? ', global' : ''})`).join('\n')}`);
  }
  if (!parts.length) return {};
  const hint = stackHint(ev.workspace);
  if (hint) parts.push(hint);
  const text = `[Everything Antigravity] Context restored for ${path.basename(ev.workspace)}. Treat it as background, re-check against the repo before acting.\n\n${parts.join('\n\n')}\n\n(/session-resume for details · /instincts to manage instincts)`;
  return H.renderInject(HARNESS, 'SessionStart', text);
}

// ---------------------------------------------------------------- pre-invocation
function preInvocation(ev, cfg) {
  if (!cfg.features.compactionNudge) return {};
  const st = S.loadState(ev.conversationId);
  st.workspace = st.workspace || ev.workspace;
  st.modelCalls += 1;
  const n = cfg.compactNudgeAt;
  let text = '';
  if (st.modelCalls % n === 0 && !st.nudges.includes(st.modelCalls)) {
    st.nudges.push(st.modelCalls);
    text = `[EAG] This conversation has made ${st.modelCalls} model calls. Long contexts cost more and lose precision: at the next logical milestone (tests green, a slice finished) run /checkpoint to save a summary, then continue in a fresh conversation. Do not interrupt work mid-step for this.`;
  }
  S.saveState(st);
  return text ? H.renderInject(HARNESS, 'BeforeModel', text) : {};
}

// ---------------------------------------------------------------- stop / session-end
function summarize(ev, st) {
  const ws = st.workspace || ev.workspace;
  const edits = st.edits.slice(-15).map((e) => `  - ${rel(ws, e.path)}`);
  const cmds = st.commands.slice(-8).map((c) => `  - ${c.ok ? 'ok ' : 'ERR'} \`${c.cmd.slice(0, 120)}\``);
  const unverified = S.unverifiedCodeEdits(st);
  return [
    `# Session ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (auto)`,
    '',
    `- Project: ${ws}`,
    `- Conversation: ${String(ev.conversationId).slice(0, 12)}`,
    `- Last request: ${(ev.lastUserInput || st.lastUserInput || '(unknown)').replace(/\s+/g, ' ').slice(0, 300)}`,
    `- Files changed (${st.edits.length}):`,
    ...(edits.length ? edits : ['  - (none)']),
    '- Recent commands:',
    ...(cmds.length ? cmds : ['  - (none)']),
    `- Verification: ${unverified.length ? `${unverified.length} code file(s) changed since the last passing check` : st.lastVerifyOkSeq >= 0 ? 'passing checks ran after the last code edit' : 'no code edits'}`,
  ].join('\n');
}

function consoleLeftovers(files) {
  const hits = [];
  for (const f of files) {
    if (!/\.(t|j)sx?$|\.m?[jt]s$/.test(f)) continue;
    try {
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((l, i) => {
        if (/^\s*(console\.(log|debug)\(|debugger;)/.test(l)) hits.push(`${path.basename(f)}:${i + 1}`);
      });
    } catch { /* file may be deleted */ }
  }
  return hits.slice(0, 8);
}

function stop(ev, cfg) {
  const st = S.loadState(ev.conversationId);
  st.workspace = st.workspace || ev.workspace;
  if (ev.lastUserInput) st.lastUserInput = ev.lastUserInput;

  if (cfg.features.memory && (st.edits.length || st.commands.length || ev.lastUserInput)) {
    try {
      saveSession({ project: st.workspace, body: summarize(ev, st), kind: 'auto', conversationId: ev.conversationId });
    } catch (err) {
      logError('stop.saveSession', err);
    }
  }

  let out = {};
  const unverified = S.unverifiedCodeEdits(st);
  const eligible = cfg.features.verifyGate
    && ev.event !== 'SessionEnd'
    && (ev.terminationReason === 'NO_TOOL_CALL' || HARNESS === 'gemini')
    && !ev.continuationActive
    && unverified.length > 0
    && st.gateNudgedAtEditSeq !== st.lastCodeEditSeq;
  if (eligible) {
    st.gateNudgedAtEditSeq = st.lastCodeEditSeq;
    const ws = st.workspace;
    const names = unverified.slice(-6).map((e) => rel(ws, e.path)).join(', ');
    const s = detectStack(ws);
    const cmds = ['test', 'typecheck', 'lint'].map((k) => s.commands[k]).filter(Boolean);
    const leftovers = cfg.features.consoleCheck ? consoleLeftovers(unverified.map((e) => e.path)) : [];
    const failed = st.commands.filter((c) => c.verify && !c.ok && c.seq > st.lastVerifyOkSeq).slice(-1)[0];
    out = H.renderContinue(HARNESS, [
      `EAG verify gate: you changed ${unverified.length} code file(s) (${names}) and no passing test/typecheck/lint/build has run since${failed ? ` (last check failed: \`${failed.cmd.slice(0, 80)}\`)` : ''}.`,
      cmds.length ? `Run ${cmds.map((c) => `\`${c}\``).join(', ')} now, fix what fails, then finish.` : 'Run the project\'s tests/type-check now (see /verify), fix what fails, then finish.',
      leftovers.length ? `Also remove debug leftovers: ${leftovers.join(', ')}.` : '',
      'If checks genuinely cannot run here, say so explicitly in your final answer instead.',
    ].filter(Boolean).join(' '));
  }
  S.saveState(st);
  return out;
}

// ---------------------------------------------------------------- main
function main() {
  const raw = H.readStdin();
  const ev = H.normalize(H.parse(raw), HARNESS);
  if (!ev) return fallback();
  const cfg = resolveConfig();
  switch (EVENT) {
    case 'pre-tool': return preTool(ev, cfg);
    case 'post-tool': return postTool(ev, cfg);
    case 'session-start': return sessionStart(ev, cfg);
    case 'pre-invocation': return preInvocation(ev, cfg);
    case 'stop': return stop(ev, cfg);
    case 'session-end': stop({ ...ev, event: 'SessionEnd' }, cfg); return {};
    default: return fallback();
  }
}

try {
  load();
  emit(main());
} catch (err) {
  try {
    logError(`hook:${EVENT}`, err);
  } catch {
    /* never let logging break the fail-open path */
  }
  emit(fallback());
}
process.exitCode = 0;
