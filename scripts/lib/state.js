'use strict';
/** Per-conversation scratch state shared between hook invocations. */
const fs = require('node:fs');
const path = require('node:path');
const { stateFile, readJson, writeJson, eagHome, logError } = require('./paths');

const CODE_EXT = new Set([
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro',
  '.py', '.pyi', '.go', '.rs', '.java', '.kt', '.kts', '.scala', '.dart', '.swift', '.m', '.mm',
  '.cs', '.fs', '.c', '.cc', '.cpp', '.cxx', '.h', '.hpp', '.rb', '.php', '.ex', '.exs', '.erl',
  '.gd', '.lua', '.sql', '.sh', '.bash', '.ps1', '.psm1', '.tf', '.proto', '.graphql', '.zig',
]);

const VERIFY_RE = new RegExp([
  String.raw`\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|tests|lint|typecheck|type-check|check|build|verify|ci|e2e)\b`,
  String.raw`\b(npx|pnpm\s+exec|bunx)\s+(vitest|jest|mocha|playwright|tsc|eslint|biome)\b`,
  String.raw`\b(vitest|jest|mocha|ava|playwright\s+test|tsc|eslint|biome\s+(check|lint)|deno\s+(test|check|lint))\b`,
  String.raw`\b(pytest|tox|nox|mypy|pyright|ruff\s+check|flake8|pylint|python\d?(\.\d+)?\s+-m\s+(pytest|unittest|mypy))\b`,
  String.raw`\bgo\s+(test|vet|build)\b|\bgolangci-lint\b|\bstaticcheck\b`,
  String.raw`\bcargo\s+(test|check|clippy|build|nextest)\b`,
  String.raw`\b(\.\/)?gradlew?(\.bat)?\s+(\S+\s+)*(test|check|build|assemble)\b|\bmvnw?\s+(\S+\s+)*(test|verify|package)\b`,
  String.raw`\b(flutter|dart)\s+(test|analyze)\b|\bdotnet\s+(build|test)\b|\bswift\s+(build|test)\b|\bxcodebuild\b.*\btest\b`,
  String.raw`\bmake\s+(test|check|lint|build|ci)\b|\bjust\s+(test|check|lint)\b|\bbazel\s+(test|build)\b`,
  String.raw`\b(rspec|bundle\s+exec\s+(rspec|rake\s+test)|phpunit|composer\s+test|mix\s+test|godot\b.*--headless.*(test|gut))\b`,
].join('|'), 'i');

function emptyState(conversationId) {
  return {
    v: 1,
    conversationId,
    created: new Date().toISOString(),
    seq: 0,
    workspace: null,
    lastUserInput: '',
    edits: [],
    commands: [],
    lastCodeEditSeq: -1,
    lastVerifyOkSeq: -1,
    gateNudgedAtEditSeq: -1,
    modelCalls: 0,
    nudges: [],
  };
}

function loadState(conversationId) {
  const s = readJson(stateFile(conversationId), null);
  return s && s.v === 1 ? s : emptyState(conversationId);
}

function saveState(state) {
  state.updated = new Date().toISOString();
  if (state.edits.length > 200) state.edits = state.edits.slice(-200);
  if (state.commands.length > 100) state.commands = state.commands.slice(-100);
  writeJson(stateFile(state.conversationId), state);
}

function isCodeFile(p) {
  return CODE_EXT.has(path.extname(String(p || '')).toLowerCase());
}

function isVerifyCommand(cmd) {
  return VERIFY_RE.test(String(cmd || ''));
}

function recordEdit(state, filePath) {
  state.seq += 1;
  state.edits = state.edits.filter((e) => e.path !== filePath);
  state.edits.push({ path: filePath, seq: state.seq });
  if (isCodeFile(filePath)) state.lastCodeEditSeq = state.seq;
}

function recordCommand(state, command, ok) {
  state.seq += 1;
  const verify = isVerifyCommand(command);
  state.commands.push({ cmd: String(command).slice(0, 300), ok: !!ok, verify, seq: state.seq });
  if (verify && ok) state.lastVerifyOkSeq = state.seq;
}

/** Code files edited after the last passing verification command. */
function unverifiedCodeEdits(state) {
  return state.edits.filter((e) => isCodeFile(e.path) && e.seq > state.lastVerifyOkSeq);
}

/** Delete state files older than `days`. Best effort. */
function pruneStates(days = 7) {
  const dir = path.join(eagHome(), 'state');
  let removed = 0;
  try {
    const cutoff = Date.now() - days * 86400000;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.mtimeMs < cutoff) {
        fs.unlinkSync(p);
        removed++;
      }
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') logError('pruneStates', err);
  }
  return removed;
}

module.exports = {
  CODE_EXT, VERIFY_RE, loadState, saveState, isCodeFile, isVerifyCommand, recordEdit, recordCommand,
  unverifiedCodeEdits, pruneStates, emptyState,
};
