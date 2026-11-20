'use strict';
/**
 * Harness adapters. Normalizes Antigravity (camelCase protojson) and Gemini CLI
 * (snake_case) hook payloads into one shape, and renders responses back.
 *
 * Antigravity contract facts verified empirically with `agy` (2026-11-19):
 *  - PreToolUse: printing NOTHING = no opinion; printing `{}` DENIES the tool;
 *    a non-zero exit fails the tool call. So hooks always exit 0.
 *  - SessionStart / PreInvocation `injectSteps[].systemMessage.systemMessage` is honoured.
 */
const fs = require('node:fs');

const PATH_KEYS = ['Path', 'TargetFile', 'AbsolutePath', 'FilePath', 'File', 'file_path', 'filePath', 'path', 'absolute_path', 'target_file'];
const COMMAND_KEYS = ['CommandLine', 'commandLine', 'command', 'Command', 'cmd'];

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parse(raw) {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return null;
  }
}

/** @returns {object|null} normalized event, or null when the payload is unusable */
function normalize(payload, harness) {
  if (!payload) return null;
  if (harness === 'gemini') {
    const ws = process.env.GEMINI_PROJECT_DIR || payload.cwd || process.cwd();
    const resp = payload.tool_response || {};
    return {
      harness,
      event: payload.hook_event_name || '',
      conversationId: payload.session_id || 'gemini-unknown',
      workspace: ws,
      cwd: payload.cwd || ws,
      lastUserInput: payload.prompt || '',
      tool: payload.tool_name || '',
      args: payload.tool_input || {},
      error: resp.error || (typeof resp.exit_code === 'number' && resp.exit_code !== 0 ? `exit ${resp.exit_code}` : ''),
      terminationReason: payload.hook_event_name === 'AfterAgent' ? 'NO_TOOL_CALL' : '',
      continuationActive: !!payload.stop_hook_active,
      transcriptPath: payload.transcript_path || '',
      invocationNum: 0,
    };
  }
  const ws = (Array.isArray(payload.workspacePaths) && payload.workspacePaths[0]) || payload.cwd || process.cwd();
  const call = payload.toolCall || {};
  return {
    harness: 'antigravity',
    event: payload.hookEventName || '',
    conversationId: payload.conversationId || 'antigravity-unknown',
    workspace: ws,
    cwd: payload.cwd || ws,
    lastUserInput: payload.lastUserInput || '',
    tool: call.name || '',
    args: call.args || {},
    error: payload.error || '',
    terminationReason: payload.terminationReason || '',
    continuationActive: !!payload.continuationActive,
    transcriptPath: payload.transcriptPath || '',
    invocationNum: Number(payload.invocationNum || 0),
  };
}

const isCommandTool = (name) => /(^|_)(run_command|run_shell_command|shell|bash|terminal|exec)(_|$)/i.test(name || '');
const isWriteTool = (name) => /(write|replace|edit|create_file|insert|patch)/i.test(name || '') && !/^(read|view)/i.test(name || '');

function commandOf(args) {
  for (const k of COMMAND_KEYS) if (typeof args[k] === 'string') return args[k];
  return '';
}

function pathsOf(args) {
  const out = [];
  for (const k of PATH_KEYS) if (typeof args[k] === 'string' && args[k]) out.push(args[k]);
  return [...new Set(out)];
}

/** All string content in the tool args (bounded), for secret scanning. */
function textOf(args, limit = 2_000_000) {
  const parts = [];
  let size = 0;
  const walk = (v) => {
    if (size > limit || v == null) return;
    if (typeof v === 'string') {
      parts.push(v);
      size += v.length;
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(args);
  return parts.join('\n');
}

/** Each string value in the tool args (excluding paths), so findings keep content-relative line numbers. */
function stringsOf(args, limit = 2_000_000) {
  const out = [];
  let size = 0;
  const walk = (v, key) => {
    if (size > limit || v == null) return;
    if (typeof v === 'string') {
      if (PATH_KEYS.includes(key)) return;
      out.push(v);
      size += v.length;
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(args, '');
  return out;
}

/** Render a PreToolUse verdict. Returns null for "no opinion" (print nothing). */
function renderPreTool(harness, verdict) {
  if (!verdict || verdict.level === 'ok') return harness === 'gemini' ? {} : null;
  const reason = `EAG AgentShield: ${verdict.reason}`;
  if (verdict.level === 'deny') return { decision: 'deny', reason };
  if (harness === 'gemini') return { systemMessage: `${reason} (review before approving).` };
  return { decision: 'force_ask', reason };
}

function renderInject(harness, eventName, text) {
  if (!text) return {};
  if (harness === 'gemini') return { hookSpecificOutput: { hookEventName: eventName, additionalContext: text } };
  return { injectSteps: [{ systemMessage: { systemMessage: text } }] };
}

function renderContinue(harness, reason) {
  if (harness === 'gemini') return { decision: 'deny', reason };
  return { decision: 'continue', reason };
}

module.exports = { readStdin, parse, normalize, isCommandTool, isWriteTool, commandOf, pathsOf, textOf, stringsOf, renderPreTool, renderInject, renderContinue };
