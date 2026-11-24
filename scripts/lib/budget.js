'use strict';
/**
 * Reads Antigravity's live customization budget from the local language server.
 *
 * Antigravity shares one token budget (20,000 by default) across every plugin's model-visible
 * skills, subagents and MCP tools. When it overflows, the most expensive skills are dropped from
 * the agent's view without any message, so installed skills silently stop being used.
 * `eag budget` makes that visible.
 *
 * Only talks to 127.0.0.1. The CSRF token is read from Antigravity's own daemon file (or the
 * ANTIGRAVITY_CSRF_TOKEN variable inside an Antigravity terminal) and is never printed.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const SERVICE = '/exa.language_server_pb.LanguageServerService/';

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * @param {string} home user home directory
 * @param {Record<string, string|undefined>} env environment (defaults to process.env)
 * @returns {{host: string, httpPort: number, csrfToken: string, pid: number|null, source: string}|null}
 */
function findHub(home, env = process.env) {
  if (env.ANTIGRAVITY_LS_ADDRESS && env.ANTIGRAVITY_CSRF_TOKEN) {
    const [host, port] = String(env.ANTIGRAVITY_LS_ADDRESS).replace(/^https?:\/\//, '').split(':');
    return { host: host === 'localhost' ? '127.0.0.1' : host, httpPort: Number(port), csrfToken: env.ANTIGRAVITY_CSRF_TOKEN, pid: null, source: 'environment' };
  }
  const dir = path.join(home, '.gemini', 'antigravity', 'daemon');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /^hub_\d+\.json$/.test(f)).map((f) => path.join(dir, f));
  } catch {
    return null;
  }
  const hubs = [];
  for (const file of files) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (alive(j.pid) && j.httpPort && j.csrfToken) hubs.push({ ...j, mtime: fs.statSync(file).mtimeMs, file });
    } catch {
      // A half-written or stale daemon file is not an error worth reporting.
    }
  }
  hubs.sort((a, b) => b.mtime - a.mtime);
  const h = hubs[0];
  return h ? { host: '127.0.0.1', httpPort: h.httpPort, csrfToken: h.csrfToken, pid: h.pid, source: h.file } : null;
}

/** POST a Connect JSON request to the local language server. */
function rpc(hub, method, body = {}, timeoutMs = 15000) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(hub.host)) return Promise.reject(new Error(`refusing to contact non-local host ${hub.host}`));
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: hub.host,
      port: hub.httpPort,
      path: SERVICE + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'x-codeium-csrf-token': hub.csrfToken },
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error(`${method} returned HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
        try {
          resolve(JSON.parse(text));
        } catch (err) {
          reject(new Error(`${method} returned invalid JSON: ${err.message}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`${method} timed out after ${timeoutMs} ms`)));
    req.on('error', reject);
    req.end(data);
  });
}

/** Skill name → plugin directory, from GetAllPlugins (full SKILL.md bodies are discarded). */
function skillOwners(allPlugins) {
  const owners = {};
  for (const p of (allPlugins && allPlugins.plugins) || []) {
    const dir = String(p.path || '').split(/[\\/]/).pop();
    for (const s of p.skills || []) owners[s.name] = dir;
  }
  return owners;
}

/**
 * @param {object} tb GetTokenBase response
 * @param {Record<string, string>} owners skill name → plugin
 */
function summarize(tb, owners = {}) {
  const full = ((tb && tb.customizationTokenBase) || {}).groups || [];
  const trunc = ((tb && tb.truncatedCustomizationTokenBase) || {}).groups || [];
  const budget = Number(tb.customizationBudget) || 20000;
  const cutNames = new Map();
  for (const g of trunc) for (const c of g.children || []) cutNames.set(`${g.name}\u0000${c.name}`, c.numTokens || 0);
  const groups = full.map((g) => {
    const cut = (g.children || []).filter((c) => cutNames.has(`${g.name}\u0000${c.name}`));
    return { name: g.name, tokens: g.numTokens || 0, items: (g.children || []).length, cutItems: cut.length, cutTokens: cut.reduce((t, c) => t + (c.numTokens || 0), 0) };
  });
  const used = groups.filter((g) => g.name !== 'Rules').reduce((t, g) => t + g.tokens, 0);
  const skills = (full.find((g) => g.name === 'Skills') || {}).children || [];
  const plugins = new Map();
  for (const c of skills) {
    const plugin = owners[c.name] || '(loose skills)';
    const p = plugins.get(plugin) || { plugin, tokens: 0, skills: 0, cut: 0 };
    p.tokens += c.numTokens || 0;
    p.skills += 1;
    if (cutNames.has(`Skills\u0000${c.name}`)) p.cut += 1;
    plugins.set(plugin, p);
  }
  const remaining = tb.remainingBudget !== undefined ? Number(tb.remainingBudget) : budget - used;
  return {
    budget,
    used,
    remaining,
    overBudget: remaining < 0,
    groups,
    cut: [...cutNames.keys()].filter((k) => k.startsWith('Skills\u0000')).map((k) => k.split('\u0000')[1]),
    byPlugin: [...plugins.values()].sort((a, b) => b.tokens - a.tokens),
  };
}

/** Fetches and summarizes the live budget. Throws when no Antigravity language server is running. */
async function readBudget(home, env = process.env) {
  const hub = findHub(home, env);
  if (!hub) throw new Error('No running Antigravity language server found. Open Antigravity and try again.');
  const tb = await rpc(hub, 'GetTokenBase', {});
  let owners = {};
  try {
    owners = skillOwners(await rpc(hub, 'GetAllPlugins', {}, 30000));
  } catch {
    owners = {};
  }
  return { hub: { pid: hub.pid, port: hub.httpPort, source: hub.source }, ...summarize(tb, owners) };
}

module.exports = { findHub, summarize, skillOwners, readBudget, rpc };
