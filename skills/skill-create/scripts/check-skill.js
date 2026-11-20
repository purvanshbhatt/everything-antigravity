#!/usr/bin/env node
'use strict';
/**
 * Checks a SKILL.md against the EAG authoring rules (docs/AUTHORING.md).
 *
 * Usage:
 *   node check-skill.js <skill-dir | path/to/SKILL.md> [--workflow] [--json]
 *
 * --workflow  also require the description to end with "Invoke with /<name>."
 * --json      print { file, errors, warnings } as JSON
 *
 * Exit code 0 when there are no errors (warnings allowed), 1 otherwise.
 * Zero dependencies.
 */

const fs = require('fs');
const path = require('path');

const BUILT_INS = [
  'plan', 'learn', 'goal', 'boost', 'swarm', 'teamwork', 'grill-me',
  'schedule', 'hooks', 'skills', 'plugin', 'agents',
];
const SECTIONS = [
  '## When to use', '## When not to use', '## Workflow',
  '## Anti-patterns', '## Verification checklist', '## Related',
];

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
const isWorkflow = args.includes('--workflow');

function fail(message) {
  process.stderr.write(`check-skill: ${message}\n`);
  process.exit(1);
}

if (!target) fail('usage: node check-skill.js <skill-dir | SKILL.md> [--workflow] [--json]');

const file = fs.existsSync(target) && fs.statSync(target).isDirectory()
  ? path.join(target, 'SKILL.md')
  : target;
if (!fs.existsSync(file)) fail(`not found: ${file}`);

const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
const lines = text.split(/\r?\n/);
const errors = [];
const warnings = [];

/** Parses the simple YAML subset used in skill frontmatter. */
function parseFrontmatter(all) {
  if (all[0] !== '---') return null;
  const end = all.indexOf('---', 1);
  if (end === -1) return null;
  const data = {};
  const body = all.slice(1, end);
  for (let i = 0; i < body.length; i += 1) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(body[i]);
    if (!m) continue;
    const [, key, rest] = m;
    if (/^[>|][-+]?$/.test(rest)) {
      const block = [];
      while (i + 1 < body.length && (/^\s+\S/.test(body[i + 1]) || body[i + 1] === '')) {
        i += 1;
        block.push(body[i].trim());
      }
      data[key] = rest.startsWith('>') ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n').trim();
    } else {
      data[key] = rest.replace(/^(['"])(.*)\1$/, '$2').trim();
    }
  }
  return { data, endLine: end };
}

const fm = parseFrontmatter(lines);
if (!fm) {
  errors.push('frontmatter missing: the file must start with --- and close with ---');
} else {
  const keys = Object.keys(fm.data);
  const extra = keys.filter((k) => k !== 'name' && k !== 'description');
  if (extra.length) errors.push(`frontmatter has extra keys: ${extra.join(', ')} (only name and description allowed)`);
  const { name, description } = fm.data;
  const dirName = path.basename(path.dirname(path.resolve(file)));
  if (!name) errors.push('frontmatter: name is missing');
  else {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) errors.push(`name "${name}" is not kebab-case`);
    if (name !== dirName) errors.push(`name "${name}" does not match directory "${dirName}"`);
    if (BUILT_INS.includes(name)) errors.push(`name "${name}" collides with an Antigravity built-in command`);
  }
  if (!description) errors.push('frontmatter: description is missing');
  else {
    if (description.length > 450) errors.push(`description is ${description.length} chars (max 450)`);
    if (isWorkflow && name && !description.endsWith(`Invoke with /${name}.`)) {
      errors.push(`description must end with "Invoke with /${name}."`);
    }
    if (/^(I|We|You)\b/.test(description)) warnings.push('description should be third person ("Reviews...", "Creates...")');
  }
}

const bytes = Buffer.byteLength(text, 'utf8');
if (bytes < 4096 || bytes > 12288) warnings.push(`size ${bytes} bytes is outside 4-12 KB; move bulk to references/ or add substance`);
for (const s of SECTIONS) {
  if (!lines.some((l) => l.trim() === s || l.trim().startsWith(`${s} `))) warnings.push(`section missing: ${s}`);
}
if (!lines.some((l) => /^#\s+\S/.test(l))) warnings.push('no "# Title" heading');
if (!text.includes('**Check:**')) warnings.push('workflow steps have no **Check:** lines');
if (/^##\s.*[\u{1F300}-\u{1FAFF}☀-➿]/mu.test(text)) warnings.push('emoji in a heading');

for (const m of text.matchAll(/\]\((references\/[^)#\s]+)\)/g)) {
  if (!fs.existsSync(path.join(path.dirname(file), m[1]))) errors.push(`broken reference link: ${m[1]}`);
}

if (asJson) {
  process.stdout.write(`${JSON.stringify({ file, bytes, errors, warnings }, null, 2)}\n`);
} else {
  process.stdout.write(`${file} (${bytes} bytes)\n`);
  for (const e of errors) process.stdout.write(`  ERROR  ${e}\n`);
  for (const w of warnings) process.stdout.write(`  WARN   ${w}\n`);
  if (!errors.length && !warnings.length) process.stdout.write('  OK\n');
}
process.exit(errors.length ? 1 : 0);
