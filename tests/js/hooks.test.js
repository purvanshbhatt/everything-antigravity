'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RUN = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'run.js');
const { googleKey: FAKE_KEY } = require('./fixtures');

function sandbox() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-home-'));
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-ws-'));
  return { home, ws };
}

function hook(event, payload, { home, harness = 'antigravity', env = {}, raw } = {}) {
  const args = [RUN, event];
  if (harness !== 'antigravity') args.push('--harness', harness);
  const res = spawnSync(process.execPath, args, {
    input: raw !== undefined ? raw : JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, EAG_HOME: home, EAG_HOOK_PROFILE: '', EAG_DISABLED_HOOKS: '', ...env },
    timeout: 15000,
  });
  const out = res.stdout.trim();
  return { code: res.status, out, json: out ? JSON.parse(out) : null, stderr: res.stderr };
}

const base = (ws, extra = {}) => ({
  conversationId: 'conv-1234-5678',
  workspacePaths: [ws],
  cwd: ws,
  lastUserInput: 'add a login form',
  ...extra,
});

test('pre-tool denies catastrophic commands', () => {
  const { home, ws } = sandbox();
  const r = hook('pre-tool', base(ws, { hookEventName: 'PreToolUse', toolCall: { name: 'run_command', args: { CommandLine: 'rm -rf /' } } }), { home });
  assert.equal(r.code, 0);
  assert.equal(r.json.decision, 'deny');
  assert.match(r.json.reason, /EAG/);
});

test('pre-tool force-asks on risky commands', () => {
  const { home, ws } = sandbox();
  const r = hook('pre-tool', base(ws, { toolCall: { name: 'run_command', args: { CommandLine: 'git push --force origin main' } } }), { home });
  assert.equal(r.json.decision, 'force_ask');
});

test('pre-tool stays silent for ordinary commands (no opinion, never {})', () => {
  const { home, ws } = sandbox();
  const r = hook('pre-tool', base(ws, { toolCall: { name: 'run_command', args: { CommandLine: 'npm test' } } }), { home });
  assert.equal(r.code, 0);
  assert.equal(r.out, '', 'printing {} would deny the tool in Antigravity');
});

test('pre-tool denies a real-looking key in a source file (force_ask is auto-approved in agy -p)', () => {
  const { home, ws } = sandbox();
  const secret = hook('pre-tool', base(ws, { toolCall: { name: 'write_file', args: { Path: path.join(ws, 'cfg.ts'), Content: `export const k = "${FAKE_KEY}";` } } }), { home });
  assert.equal(secret.json.decision, 'deny');
  assert.match(secret.json.reason, /google-api-key/);
  assert.match(secret.json.reason, /line 1\b/, 'line numbers are relative to the written content');
  assert.match(secret.json.reason, /environment variable|\.env/);
  assert.ok(!secret.json.reason.includes('KlMnOpQrStUvW'), 'reason must not echo the secret');
});

test('pre-tool asks (not denies) on medium-confidence secrets, and stays silent for .env files and normal code', () => {
  const { home, ws } = sandbox();
  const medium = hook('pre-tool', base(ws, { toolCall: { name: 'write_file', args: { Path: path.join(ws, 'config.py'), Content: 'password = "hunter2-correct-horse-battery"' } } }), { home });
  assert.equal(medium.json.decision, 'force_ask');
  const dotenv = hook('pre-tool', base(ws, { toolCall: { name: 'write_file', args: { Path: path.join(ws, '.env.local'), Content: `GEMINI_API_KEY=${FAKE_KEY}` } } }), { home });
  assert.equal(dotenv.out, '', '.env files are where secrets belong');
  const example = hook('pre-tool', base(ws, { toolCall: { name: 'write_file', args: { Path: path.join(ws, '.env.example'), Content: `GEMINI_API_KEY=${FAKE_KEY}` } } }), { home });
  assert.equal(example.json.decision, 'deny', '.env.example is committed, so real keys there are blocked');
  const clean = hook('pre-tool', base(ws, { toolCall: { name: 'write_to_file', args: { TargetFile: path.join(ws, 'a.ts'), CodeContent: 'export const x = 1;' } } }), { home });
  assert.equal(clean.out, '');
});

test('pre-tool fails open on garbage input without blocking', () => {
  const { home } = sandbox();
  const r = hook('pre-tool', null, { home, raw: 'not json at all' });
  assert.equal(r.code, 0);
  assert.equal(r.out, '');
});

test('pre-tool fails open (exit 0, no output) even when its libraries cannot load', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-broken-'));
  fs.mkdirSync(path.join(dir, 'scripts', 'hooks'), { recursive: true });
  fs.copyFileSync(RUN, path.join(dir, 'scripts', 'hooks', 'run.js'));
  const res = spawnSync(process.execPath, [path.join(dir, 'scripts', 'hooks', 'run.js'), 'pre-tool'], {
    input: JSON.stringify({ toolCall: { name: 'run_command', args: { CommandLine: 'npm test' } } }),
    encoding: 'utf8',
    env: { ...process.env, EAG_HOME: dir },
  });
  assert.equal(res.status, 0, 'a non-zero exit would fail the tool call in Antigravity');
  assert.equal(res.stdout.trim(), '');
  const stop = spawnSync(process.execPath, [path.join(dir, 'scripts', 'hooks', 'run.js'), 'stop'], { input: '{}', encoding: 'utf8' });
  assert.equal(stop.status, 0);
  assert.equal(stop.stdout.trim(), '{}');
});

test('minimal profile only keeps catastrophic denies', () => {
  const { home, ws } = sandbox();
  const env = { EAG_HOOK_PROFILE: 'minimal' };
  const risky = hook('pre-tool', base(ws, { toolCall: { name: 'run_command', args: { CommandLine: 'git reset --hard' } } }), { home, env });
  assert.equal(risky.out, '');
  const deadly = hook('pre-tool', base(ws, { toolCall: { name: 'run_command', args: { CommandLine: 'rm -rf ~' } } }), { home, env });
  assert.equal(deadly.json.decision, 'deny');
});

test('gemini adapter: deny catastrophic, warn (not block) on risky', () => {
  const { home, ws } = sandbox();
  const deny = hook('pre-tool', { session_id: 's1', cwd: ws, hook_event_name: 'BeforeTool', tool_name: 'run_shell_command', tool_input: { command: 'mkfs.ext4 /dev/sda1' } }, { home, harness: 'gemini' });
  assert.equal(deny.json.decision, 'deny');
  const warn = hook('pre-tool', { session_id: 's1', cwd: ws, hook_event_name: 'BeforeTool', tool_name: 'run_shell_command', tool_input: { command: 'git reset --hard' } }, { home, harness: 'gemini' });
  assert.equal(warn.json.decision, undefined);
  assert.match(warn.json.systemMessage, /EAG/);
});

test('tracker + stop gate: nudges once after unverified code edits, then stays quiet', () => {
  const { home, ws } = sandbox();
  const file = path.join(ws, 'src', 'login.ts');
  hook('post-tool', base(ws, { toolCall: { name: 'write_file', args: { Path: file, Content: 'x' } } }), { home });
  const stop1 = hook('stop', base(ws, { terminationReason: 'NO_TOOL_CALL', continuationActive: false, fullyIdle: true }), { home });
  assert.equal(stop1.json.decision, 'continue');
  assert.match(stop1.json.reason, /login\.ts/);
  const stop2 = hook('stop', base(ws, { terminationReason: 'NO_TOOL_CALL', continuationActive: true, fullyIdle: true }), { home });
  assert.notEqual(stop2.json && stop2.json.decision, 'continue');
});

test('stop gate stays quiet once a verification command ran after the edit', () => {
  const { home, ws } = sandbox();
  hook('post-tool', base(ws, { toolCall: { name: 'replace_file_content', args: { TargetFile: path.join(ws, 'app.py') } } }), { home });
  hook('post-tool', base(ws, { toolCall: { name: 'run_command', args: { CommandLine: 'pytest -q' } } }), { home });
  const stop = hook('stop', base(ws, { terminationReason: 'NO_TOOL_CALL', continuationActive: false }), { home });
  assert.notEqual(stop.json && stop.json.decision, 'continue');
});

test('stop gate ignores docs-only edits and failed verification still counts as unverified', () => {
  const { home, ws } = sandbox();
  hook('post-tool', base(ws, { toolCall: { name: 'write_file', args: { Path: path.join(ws, 'README.md') } } }), { home });
  const docs = hook('stop', base(ws, { terminationReason: 'NO_TOOL_CALL' }), { home });
  assert.notEqual(docs.json && docs.json.decision, 'continue');

  const s2 = sandbox();
  hook('post-tool', base(s2.ws, { toolCall: { name: 'write_file', args: { Path: path.join(s2.ws, 'main.go') } } }), { home: s2.home });
  hook('post-tool', base(s2.ws, { toolCall: { name: 'run_command', args: { CommandLine: 'go test ./...' } }, error: 'exit status 1' }), { home: s2.home });
  const failed = hook('stop', base(s2.ws, { terminationReason: 'NO_TOOL_CALL' }), { home: s2.home });
  assert.equal(failed.json.decision, 'continue');
});

test('stop saves a session summary that session-start injects next time', () => {
  const { home, ws } = sandbox();
  hook('post-tool', base(ws, { toolCall: { name: 'write_file', args: { Path: path.join(ws, 'notes.md') } } }), { home });
  hook('stop', base(ws, { terminationReason: 'NO_TOOL_CALL' }), { home });
  const start = hook('session-start', { conversationId: 'conv-next', workspacePaths: [ws], cwd: ws }, { home });
  const text = start.json.injectSteps[0].systemMessage.systemMessage;
  assert.match(text, /add a login form/);
  assert.match(text, /notes\.md/);
});

test('session-start injects high-confidence instincts only', () => {
  const { home, ws } = sandbox();
  const { addInstinct } = require('../../scripts/lib/instincts');
  process.env.EAG_HOME = home;
  addInstinct({ trigger: 'when adding API routes', action: 'validate input with zod', confidence: 0.9, scope: 'project', project: ws });
  addInstinct({ trigger: 'when naming files', action: 'use kebab-case', confidence: 0.4, scope: 'project', project: ws });
  delete process.env.EAG_HOME;
  const start = hook('session-start', { conversationId: 'c2', workspacePaths: [ws], cwd: ws }, { home });
  const text = start.json.injectSteps[0].systemMessage.systemMessage;
  assert.match(text, /validate input with zod/);
  assert.doesNotMatch(text, /kebab-case/);
});

test('session-start outputs {} when there is nothing to inject', () => {
  const { home, ws } = sandbox();
  const start = hook('session-start', { conversationId: 'c3', workspacePaths: [ws], cwd: ws }, { home });
  assert.equal(start.code, 0);
  assert.deepEqual(start.json, {});
});

test('pre-invocation nudges compaction once per threshold', () => {
  const { home, ws } = sandbox();
  const env = { EAG_COMPACT_NUDGE_AT: '3' };
  let nudges = 0;
  for (let i = 0; i < 5; i++) {
    const r = hook('pre-invocation', base(ws, { invocationNum: i }), { home, env });
    if (r.json && r.json.injectSteps && r.json.injectSteps.length) nudges++;
  }
  assert.equal(nudges, 1);
});

test('gemini session-start uses additionalContext', () => {
  const { home, ws } = sandbox();
  hook('post-tool', base(ws, { toolCall: { name: 'write_file', args: { Path: path.join(ws, 'x.md') } } }), { home });
  hook('stop', base(ws, { terminationReason: 'NO_TOOL_CALL' }), { home });
  const r = hook('session-start', { session_id: 'g1', cwd: ws, hook_event_name: 'SessionStart', source: 'startup' }, { home, harness: 'gemini' });
  assert.equal(r.json.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(r.json.hookSpecificOutput.additionalContext, /x\.md/);
});
