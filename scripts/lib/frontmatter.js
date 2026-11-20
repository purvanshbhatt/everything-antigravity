'use strict';
/**
 * Minimal YAML-frontmatter parser for SKILL.md / agent / rule files.
 * Supports: `key: value`, quoted strings, booleans, numbers, folded/literal
 * blocks (`>-`, `>`, `|`, `|-`) and block lists (`- item`). That is the full
 * subset Antigravity customizations use; anything else is reported as an error.
 */

function scalar(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1).split(',').map((s) => scalar(s)).filter((s) => s !== '');
  return v;
}

/**
 * @param {string} text full file contents
 * @returns {{data: Record<string, unknown>|null, body: string, errors: string[]}}
 */
function parseFrontmatter(text) {
  const src = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!src.startsWith('---\n')) return { data: null, body: src, errors: [] };
  const end = src.indexOf('\n---', 4);
  if (end === -1) return { data: null, body: src, errors: ['frontmatter is not closed with ---'] };
  const block = src.slice(4, end);
  const body = src.slice(src.indexOf('\n', end + 1) + 1);
  const lines = block.split('\n');
  const data = {};
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = /^([A-Za-z_][\w-]*):(?:\s(.*)|)$/.exec(line);
    if (!m) {
      errors.push(`unparseable frontmatter line ${i + 1}: ${line.slice(0, 60)}`);
      continue;
    }
    const key = m[1];
    const rest = (m[2] || '').trim();
    if (/^[>|][+-]?$/.test(rest)) {
      const folded = rest.startsWith('>');
      const parts = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) {
        parts.push(lines[++i].trim());
      }
      data[key] = folded ? parts.join(' ').replace(/\s+/g, ' ').trim() : parts.join('\n').trim();
    } else if (rest === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        items.push(scalar(lines[++i].replace(/^\s*-\s+/, '')));
      }
      data[key] = items.length ? items : '';
    } else {
      data[key] = scalar(rest);
    }
  }
  return { data, body, errors };
}

module.exports = { parseFrontmatter };
