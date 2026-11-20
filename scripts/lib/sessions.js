'use strict';
/** Session summaries: ~/.gemini/eag/sessions/<project-key>/*.md */
const fs = require('node:fs');
const path = require('node:path');
const { sessionsDir, projectKey, ensureDir, logError } = require('./paths');

const MAX_AUTO = 30;

function slug(s) {
  return String(s || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'session';
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Save a summary. Auto summaries are one file per conversation (overwritten
 * each turn); manual summaries get a timestamped file.
 * @returns {string} absolute path written
 */
function saveSession({ project, body, title, kind = 'manual', conversationId }) {
  const dir = ensureDir(sessionsDir(projectKey(project)));
  const file = kind === 'auto'
    ? path.join(dir, `auto-${String(conversationId || 'unknown').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12)}.md`)
    : path.join(dir, `${stamp()}-${slug(title)}.md`);
  fs.writeFileSync(file, String(body).endsWith('\n') ? String(body) : `${body}\n`, 'utf8');
  if (kind === 'auto') pruneAuto(dir);
  return file;
}

function pruneAuto(dir) {
  try {
    const autos = fs.readdirSync(dir)
      .filter((f) => f.startsWith('auto-'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of autos.slice(MAX_AUTO)) fs.unlinkSync(path.join(dir, f));
  } catch (err) {
    logError('pruneAuto', err);
  }
}

/** @returns {{file: string, name: string, kind: 'auto'|'manual', mtime: Date, title: string}[]} newest first */
function listSessions(project) {
  const dir = sessionsDir(projectKey(project));
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch (err) {
    if (err.code !== 'ENOENT') logError('listSessions', err);
    return [];
  }
  return names
    .map((name) => {
      const file = path.join(dir, name);
      const st = fs.statSync(file);
      let title = name;
      try {
        const first = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith('# '));
        if (first) title = first.slice(2).trim();
      } catch { /* ignore */ }
      return { file, name, kind: name.startsWith('auto-') ? 'auto' : 'manual', mtime: st.mtime, title };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function latestSession(project, { excludeConversation } = {}) {
  const tag = excludeConversation ? `auto-${String(excludeConversation).replace(/[^A-Za-z0-9-]/g, '').slice(0, 12)}.md` : null;
  const item = listSessions(project).find((s) => s.name !== tag);
  if (!item) return null;
  return { ...item, content: fs.readFileSync(item.file, 'utf8') };
}

function relativeTime(date, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

module.exports = { saveSession, listSessions, latestSession, relativeTime, stamp, slug };
