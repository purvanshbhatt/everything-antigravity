'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findHub, summarize } = require('../../scripts/lib/budget');

const group = (name, children) => ({ name, numTokens: children.reduce((t, c) => t + c[1], 0), children: children.map(([n, t]) => ({ name: n, numTokens: t })) });

const tokenBase = {
  customizationBudget: 20000,
  remainingBudget: -1200,
  customizationTokenBase: { groups: [group('Skills', [['a', 9000], ['b', 7000], ['c', 300], ['d', 400]]), group('Subagents', [['x', 4000]]), group('Mcp Tools', [['m', 500]])] },
  truncatedCustomizationTokenBase: { groups: [group('Skills', [['a', 9000]])] },
};

test('summarize reports usage, overflow and what Antigravity dropped', () => {
  const owners = { a: 'big-plugin', b: 'big-plugin', c: 'everything-antigravity', d: 'everything-antigravity' };
  const s = summarize(tokenBase, owners);
  assert.equal(s.budget, 20000);
  assert.equal(s.used, 21200);
  assert.equal(s.remaining, -1200);
  assert.equal(s.overBudget, true);
  assert.deepEqual(s.groups.find((g) => g.name === 'Skills'), { name: 'Skills', tokens: 16700, items: 4, cutItems: 1, cutTokens: 9000 });
  assert.deepEqual(s.cut, ['a']);
  assert.deepEqual(s.byPlugin[0], { plugin: 'big-plugin', tokens: 16000, skills: 2, cut: 1 });
  assert.deepEqual(s.byPlugin.find((p) => p.plugin === 'everything-antigravity'), { plugin: 'everything-antigravity', tokens: 700, skills: 2, cut: 0 });
});

test('summarize tolerates a response with no truncation block', () => {
  const s = summarize({ customizationBudget: 20000, remainingBudget: 19000, customizationTokenBase: { groups: [group('Skills', [['a', 1000]])] } });
  assert.equal(s.overBudget, false);
  assert.deepEqual(s.cut, []);
});

test('findHub picks a live language server and never a dead one', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-hub-'));
  const dir = path.join(home, '.gemini', 'antigravity', 'daemon');
  fs.mkdirSync(dir, { recursive: true });
  const write = (port, pid) => fs.writeFileSync(path.join(dir, `hub_${port}.json`), JSON.stringify({ pid, httpPort: port, httpsPort: port - 1, csrfToken: 'not-a-real-token' }));
  write(40001, 999999999);
  assert.equal(findHub(home, {}), null);
  write(40002, process.pid);
  const hub = findHub(home, {});
  assert.equal(hub.httpPort, 40002);
  assert.equal(hub.pid, process.pid);
});

test('findHub prefers an explicit address and token from the environment', () => {
  const hub = findHub(os.tmpdir(), { ANTIGRAVITY_LS_ADDRESS: '127.0.0.1:5999', ANTIGRAVITY_CSRF_TOKEN: 'x' });
  assert.equal(hub.httpPort, 5999);
  assert.equal(hub.host, '127.0.0.1');
});
