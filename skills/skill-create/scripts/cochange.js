#!/usr/bin/env node
'use strict';
/**
 * Prints the file pairs most often changed in the same commit.
 *
 * Input (stdin): the output of
 *   git log --no-merges --name-only --pretty=format:@@@ -n 300
 *
 * Usage:
 *   git log --no-merges --name-only --pretty=format:@@@ -n 300 | node cochange.js [--top 20] [--max-files 30]
 *
 * Commits touching more than --max-files files (mass renames, formatting sweeps)
 * are ignored for pairing because they hide real coupling. Zero dependencies.
 */

const args = process.argv.slice(2);

function intOption(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const value = Number.parseInt(args[i + 1], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const TOP = intOption('--top', 20);
const MAX_FILES = intOption('--max-files', 30);

function parseCommits(text) {
  const commits = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '@@@') {
      current = new Set();
      commits.push(current);
    } else if (line && current) {
      current.add(line);
    }
  }
  return commits;
}

function analyze(commits) {
  const fileCount = new Map();
  const pairCount = new Map();
  let paired = 0;
  for (const files of commits) {
    for (const f of files) fileCount.set(f, (fileCount.get(f) || 0) + 1);
    if (files.size < 2 || files.size > MAX_FILES) continue;
    paired += 1;
    const list = [...files].sort();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const key = `${list[i]}\u0000${list[j]}`;
        pairCount.set(key, (pairCount.get(key) || 0) + 1);
      }
    }
  }
  const pairs = [...pairCount.entries()]
    .filter(([, n]) => n >= 2)
    .map(([key, n]) => {
      const [a, b] = key.split('\u0000');
      const rarer = Math.min(fileCount.get(a), fileCount.get(b));
      return { a, b, together: n, coupling: Math.round((100 * n) / rarer) };
    })
    .sort((x, y) => y.together - x.together || y.coupling - x.coupling)
    .slice(0, TOP);
  return { commits: commits.length, paired, pairs };
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  const commits = parseCommits(input);
  if (commits.length === 0) {
    process.stderr.write(
      'cochange: no commits on stdin. Pipe in: git log --no-merges --name-only --pretty=format:@@@ -n 300\n',
    );
    process.exit(1);
  }
  const result = analyze(commits);
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`commits read: ${result.commits}, used for pairing: ${result.paired}\n`);
  process.stdout.write('together  coupling  files\n');
  for (const p of result.pairs) {
    process.stdout.write(`${String(p.together).padStart(8)}  ${String(p.coupling).padStart(7)}%  ${p.a}  <->  ${p.b}\n`);
  }
  if (result.pairs.length === 0) process.stdout.write('(no pair changed together in 2 or more commits)\n');
});
