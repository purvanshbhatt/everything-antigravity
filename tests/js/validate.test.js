'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateRepo } = require('../../scripts/lib/validate');
const { parseFrontmatter } = require('../../scripts/lib/frontmatter');

const ROOT = path.join(__dirname, '..', '..');

test('the repository itself validates with zero errors', () => {
  const r = validateRepo(ROOT);
  assert.deepEqual(r.errors, []);
  assert.ok(r.stats.skills >= 75, `skills: ${r.stats.skills}`);
  assert.ok(r.stats.agents >= 20, `agents: ${r.stats.agents}`);
  assert.ok(r.stats.alwaysOnTokens < 3000, `always-on rules cost ${r.stats.alwaysOnTokens} tokens`);
});

test('frontmatter parser handles folded blocks, lists and booleans', () => {
  const { data, errors } = parseFrontmatter('---\nname: x\ndescription: >-\n  line one\n  line two\ntools:\n  - view_file\n  - run_command\nsubagent: true\n---\nbody');
  assert.deepEqual(errors, []);
  assert.equal(data.description, 'line one line two');
  assert.deepEqual(data.tools, ['view_file', 'run_command']);
  assert.equal(data.subagent, true);
});

function brokenRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-bad-'));
  const w = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  w('plugin.json', JSON.stringify({ name: 'bad-plugin', version: '1.0.0', logo: 'https://example.com/x.png', unknownField: 1 }));
  w('package.json', JSON.stringify({ name: 'bad', version: '1.0.1' }));
  w('skills/wrong-dir/SKILL.md', '---\nname: other-name\ndescription: Does a thing.\n---\n# X\nSee [ref](references/missing.md).\n');
  w('skills/plan/SKILL.md', '---\nname: plan\ndescription: Shadows a built-in.\n---\n# Plan\n');
  w('agents/bad-agent.md', '---\nname: bad-agent\ndescription: d\ntools:\n  - view_file\n  - teleport\nmodel: gemini-ultra\ncolor: red\n---\n# A\n');
  w('rules/AGENTS.md', '# core\n');
  w('rules/py.md', '---\ntrigger: glob\nglobs:\n  - "**/*.py"\n---\n# py\n');
  w('rules/sec.md', '---\ntrigger: model_decision\n---\n# sec\n');
  w('hooks.json', JSON.stringify({ g: { PreToolUse: [{ matcher: 'run_command', hooks: [{ command: 'node scripts/missing.js' }] }], OnMagic: [] } }));
  return dir;
}

test('validator catches every class of mistake the loader would silently drop', () => {
  const { errors } = validateRepo(brokenRepo());
  const has = (re) => assert.ok(errors.some((e) => re.test(e)), `expected an error matching ${re}\n${errors.join('\n')}`);
  has(/unknown field "unknownField"/);
  has(/logo/);
  has(/version mismatch/);
  has(/frontmatter name "other-name" must equal/);
  has(/broken relative link "references\/missing.md"/);
  has(/"plan" collides with a built-in/);
  has(/unknown tool "teleport"/);
  has(/model must be one of/);
  has(/unsupported key "color"/);
  has(/globs.*ONE comma-separated string/);
  has(/model_decision rules need a description/);
  has(/hook script not found/);
  has(/unknown event "OnMagic"/);
});

test('validator ignores example links inside code', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-code-'));
  fs.mkdirSync(path.join(dir, 'skills', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({ name: 'demo', version: '1.0.0' }));
  fs.writeFileSync(path.join(dir, 'skills', 'demo', 'SKILL.md'), '---\nname: demo\ndescription: d\n---\n# D\n\n```md\n![x](docs/demo.gif)\n```\n\nInline `[label](path)` too.\n');
  const { errors } = validateRepo(dir);
  assert.deepEqual(errors.filter((e) => /broken relative link/.test(e)), []);
});
