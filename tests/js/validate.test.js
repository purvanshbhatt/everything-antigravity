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

test('the repository fits inside the Antigravity customization budget', () => {
  // Antigravity shares a 20,000-token budget across every plugin's model-visible skills,
  // subagents and MCP tools, and cuts the most expensive skills first when it overflows.
  const r = validateRepo(ROOT);
  assert.ok(r.stats.budgetTokens <= 6000, `EAG costs ~${r.stats.budgetTokens} tokens of the 20,000-token budget`);
  assert.ok(r.stats.visibleSkills <= 30, `${r.stats.visibleSkills} model-visible skills`);
  for (const s of r.skills.filter((x) => x.visible)) assert.ok(s.description.length <= 220, `${s.name}: ${s.description.length} chars`);
  for (const a of r.agents) assert.ok(a.description.length <= 160, `${a.name}: ${a.description.length} chars`);
});

function tinyRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eag-budget-'));
  for (const [rel, text] of Object.entries({ 'plugin.json': '{"name":"tiny","version":"1.0.0"}', ...files })) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

test('validator rejects model-visible skills that Antigravity would cut first', () => {
  const long = 'Explains a topic in depth. '.repeat(12);
  const { errors } = validateRepo(tinyRepo({ 'skills/wordy/SKILL.md': `---\nname: wordy\ndescription: ${long}\n---\n# W\n` }));
  assert.ok(errors.some((e) => /skills\/wordy: model-visible description is \d+ chars/.test(e)), errors.join('\n'));
});

test('slash-only skills must be reachable from an eag index skill', () => {
  const hidden = '---\nname: deep-topic\ndisable-model-invocation: true\ndescription: A long playbook.\n---\n# D\n';
  const orphan = validateRepo(tinyRepo({ 'skills/deep-topic/SKILL.md': hidden }));
  assert.ok(orphan.errors.some((e) => /skills\/deep-topic: slash-only skill is not listed in any eag-\* index/.test(e)), orphan.errors.join('\n'));
  assert.ok(!orphan.warnings.some((w) => /extra frontmatter key "disable-model-invocation"/.test(w)), orphan.warnings.join('\n'));

  const index = '---\nname: eag-topics\ndescription: Index of topic playbooks.\n---\n# Index\n\n| [deep-topic](../deep-topic/SKILL.md) |\n';
  const ok = validateRepo(tinyRepo({ 'skills/deep-topic/SKILL.md': hidden, 'skills/eag-topics/SKILL.md': index }));
  assert.ok(!ok.errors.some((e) => /not listed in any eag-/.test(e)), ok.errors.join('\n'));
  assert.equal(ok.stats.visibleSkills, 1);
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
