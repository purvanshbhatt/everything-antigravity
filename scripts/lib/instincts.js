'use strict';
/**
 * Continuous learning: "instincts" are small, confidence-weighted lessons
 * (when <trigger> → do <action>) learned from corrections and outcomes.
 * Stored per project in ~/.gemini/eag/instincts/<project-key>.json, plus global.json.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { instinctsFile, projectKey, readJson, writeJson, ensureDir } = require('./paths');

const clamp = (n) => Math.max(0, Math.min(1, Math.round(n * 100) / 100));
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

function fileFor(scope, project) {
  return instinctsFile(scope === 'global' ? 'global' : projectKey(project));
}

function load(file) {
  const data = readJson(file, null);
  return data && Array.isArray(data.instincts) ? data : { version: 1, instincts: [] };
}

function save(file, data) {
  writeJson(file, data);
}

/**
 * Add an instinct, or reinforce an identical existing one.
 * @returns {{id: string, created: boolean, confidence: number}}
 */
function addInstinct({ trigger, action, confidence = 0.5, scope = 'project', evidence, project }) {
  if (!trigger || !action) throw new Error('Both --trigger and --action are required.');
  const file = fileFor(scope, project);
  const data = load(file);
  const existing = data.instincts.find((i) => norm(i.trigger) === norm(trigger) && norm(i.action) === norm(action));
  const now = new Date().toISOString();
  if (existing) {
    existing.confidence = clamp(existing.confidence + 0.1);
    existing.seen = (existing.seen || 1) + 1;
    if (evidence) existing.evidence = [...(existing.evidence || []), String(evidence)].slice(-10);
    existing.updated = now;
    save(file, data);
    return { id: existing.id, created: false, confidence: existing.confidence };
  }
  const id = `inst-${crypto.randomBytes(3).toString('hex')}`;
  data.instincts.push({
    id, trigger: String(trigger).trim(), action: String(action).trim(), confidence: clamp(Number(confidence) || 0.5),
    scope: scope === 'global' ? 'global' : 'project', evidence: evidence ? [String(evidence)] : [], seen: 1, created: now, updated: now,
  });
  save(file, data);
  return { id, created: true, confidence: clamp(Number(confidence) || 0.5) };
}

/** Project + global instincts, highest confidence first. */
function listInstincts({ project, min = 0, includeGlobal = true } = {}) {
  const items = load(fileFor('project', project)).instincts.map((i) => ({ ...i, scope: 'project' }));
  if (includeGlobal) items.push(...load(fileFor('global')).instincts.map((i) => ({ ...i, scope: 'global' })));
  return items.filter((i) => i.confidence >= min).sort((a, b) => b.confidence - a.confidence || (b.seen || 1) - (a.seen || 1));
}

function locate(id, project) {
  for (const scope of ['project', 'global']) {
    const file = fileFor(scope, project);
    const data = load(file);
    const item = data.instincts.find((i) => i.id === id);
    if (item) return { file, data, item };
  }
  throw new Error(`No instinct with id "${id}" for this project or globally.`);
}

function adjust(id, delta, project) {
  const { file, data, item } = locate(id, project);
  item.confidence = clamp(item.confidence + delta);
  if (delta > 0) item.seen = (item.seen || 1) + 1;
  item.updated = new Date().toISOString();
  save(file, data);
  return item;
}

const reinforce = (id, project) => adjust(id, 0.1, project);
const weaken = (id, project) => adjust(id, -0.15, project);

function removeInstinct(id, project) {
  const { file, data } = locate(id, project);
  data.instincts = data.instincts.filter((i) => i.id !== id);
  save(file, data);
}

function prune({ below = 0.3, project } = {}) {
  let removed = 0;
  const files = [fileFor('global')];
  if (project) files.unshift(fileFor('project', project));
  for (const file of files) {
    const data = load(file);
    const keep = data.instincts.filter((i) => i.confidence >= below);
    removed += data.instincts.length - keep.length;
    if (keep.length !== data.instincts.length) save(file, { ...data, instincts: keep });
  }
  return removed;
}

function topForInjection(project, { min = 0.7, max = 6 } = {}) {
  return listInstincts({ project, min }).slice(0, max);
}

/** Scaffold a project skill from an instinct. @returns {string} SKILL.md path */
function promote(id, skillName, project) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(skillName || '')) throw new Error('Skill name must be kebab-case, e.g. "api-input-validation".');
  const { item } = locate(id, project);
  const dir = path.join(path.resolve(project || process.cwd()), '.agents', 'skills', skillName);
  const file = path.join(dir, 'SKILL.md');
  if (fs.existsSync(file)) throw new Error(`${file} already exists; refusing to overwrite.`);
  ensureDir(dir);
  const body = `---
name: ${skillName}
description: >-
  ${item.action.replace(/\n/g, ' ')} Use ${item.trigger.replace(/^when\s+/i, 'when ')}.
---

# ${skillName.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}

Promoted from EAG instinct \`${item.id}\` (confidence ${item.confidence}, seen ${item.seen || 1}x).

## When to use

- ${item.trigger}

## Workflow

1. ${item.action}

   **Check:** <how to confirm it worked>

## Evidence

${(item.evidence || []).map((e) => `- ${e}`).join('\n') || '- (none recorded)'}

## Related

- /instincts
`;
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

module.exports = { addInstinct, listInstincts, reinforce, weaken, removeInstinct, prune, topForInjection, promote };
