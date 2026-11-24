'use strict';
/**
 * Repository validator: enforces docs/AUTHORING.md mechanically.
 * Mirrors what Antigravity's loader accepts (see `agy plugin validate`) and adds
 * EAG-specific quality checks (stub detection, broken links, catalog cross-refs).
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('./frontmatter');

const BUILTIN_COMMANDS = ['plan', 'learn', 'goal', 'boost', 'swarm', 'teamwork', 'grill-me', 'schedule', 'hooks', 'skills', 'plugin', 'agents'];
const BUILTIN_AGENTS = ['self', 'browser', 'research', 'deepagent', 'review-agent'];
const AGENT_TOOLS = ['view_file', 'grep_search', 'find_by_name', 'list_dir', 'run_command', 'write_to_file', 'replace_file_content'];
const AGENT_KEYS = ['name', 'description', 'tools', 'mainAgent', 'subagent', 'model'];
const MODELS = ['inherit', 'flash', 'pro'];
const PLUGIN_KEYS = ['name', 'displayName', 'description', 'version', 'logo', 'suggestedPrompts', 'skills', 'disabled', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions'];
const RULE_TRIGGERS = ['always_on', 'glob', 'model_decision', 'manual'];
const AG_EVENTS = ['SessionStart', 'PreToolUse', 'PostToolUse', 'PreInvocation', 'PostInvocation', 'Stop'];
const GEMINI_EVENTS = ['SessionStart', 'SessionEnd', 'BeforeAgent', 'AfterAgent', 'BeforeModel', 'AfterModel', 'BeforeToolSelection', 'BeforeTool', 'AfterTool', 'PreCompress', 'Notification'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKILL_KEYS = ['name', 'description', 'disable-model-invocation', 'disable-slash-command'];

// Antigravity shares one 20,000-token customization budget across every plugin's model-visible
// skills, subagents and MCP tools, and cuts the most expensive skills first when it overflows.
// Costs below are fitted from GetTokenBase on a live install (±10 tokens).
const BUDGET = { total: 20000, eagShare: 6000, visibleDescChars: 220, agentDescChars: 160 };
const skillCost = (desc) => Math.round(31 + desc.length / 2.9);
const agentCost = (desc) => Math.round(6 + desc.length / 3.0);
const INDEX_PREFIX = 'eag-';

function readJson(file, errors) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push(`${path.basename(file)}: invalid JSON (${err.message})`);
    return null;
  }
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    return [];
  }
}

function relLinks(body) {
  const out = [];
  const re = /\]\(([^)\s]+)\)/g;
  // Example markdown inside fenced blocks or inline code is documentation, not a link.
  const prose = body.replace(/(^|\n)(`{3,}|~{3,})[\s\S]*?\n\2[^\n]*/g, '\n').replace(/`[^`\n]*`/g, '');
  let m;
  while ((m = re.exec(prose)) !== null) {
    const href = m[1];
    if (/^(https?:|mailto:|#|\/|[a-z]+:\/\/)/i.test(href) || href.startsWith('<')) continue;
    out.push(href.split('#')[0]);
  }
  return out.filter(Boolean);
}

/**
 * @param {string} root repository root
 * @returns {{errors: string[], warnings: string[], stats: Record<string, number>, skills: object[], agents: object[], rules: object[]}}
 */
function validateRepo(root) {
  const errors = [];
  const warnings = [];
  const stats = {};

  // ---- plugin.json
  const plugin = readJson(path.join(root, 'plugin.json'), errors) || {};
  for (const k of Object.keys(plugin)) if (!PLUGIN_KEYS.includes(k)) errors.push(`plugin.json: unknown field "${k}" (the loader silently drops it)`);
  if (!KEBAB.test(plugin.name || '')) errors.push('plugin.json: "name" must be kebab-case');
  if (Array.isArray(plugin.suggestedPrompts) && plugin.suggestedPrompts.length > 3) errors.push('plugin.json: at most 3 suggestedPrompts are shown');
  if (plugin.logo && (/^https?:/.test(plugin.logo) || !fs.existsSync(path.join(root, plugin.logo)))) errors.push('plugin.json: "logo" must be a relative path to an existing file (URLs are ignored)');

  // ---- versions
  const versions = {};
  for (const f of ['plugin.json', 'gemini-extension.json', 'package.json']) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) versions[f] = (readJson(p, errors) || {}).version;
  }
  if (new Set(Object.values(versions)).size > 1) errors.push(`version mismatch: ${JSON.stringify(versions)}`);

  // ---- skills
  const skillsDir = path.join(root, 'skills');
  const skills = [];
  for (const name of listDirs(skillsDir)) {
    const file = path.join(skillsDir, name, 'SKILL.md');
    const where = `skills/${name}`;
    if (!fs.existsSync(file)) {
      errors.push(`${where}: missing SKILL.md`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const size = Buffer.byteLength(text);
    const { data, body, errors: fmErr } = parseFrontmatter(text);
    fmErr.forEach((e) => errors.push(`${where}: ${e}`));
    if (!data) {
      errors.push(`${where}: SKILL.md must start with YAML frontmatter`);
      continue;
    }
    if (!KEBAB.test(name)) errors.push(`${where}: directory name must be kebab-case`);
    if (data.name !== name) errors.push(`${where}: frontmatter name "${data.name}" must equal the directory name`);
    if (BUILTIN_COMMANDS.includes(name)) errors.push(`${where}: "${name}" collides with a built-in Antigravity command`);
    const desc = typeof data.description === 'string' ? data.description : '';
    if (!desc) errors.push(`${where}: description is required`);
    else if (desc.length > 1024) errors.push(`${where}: description is ${desc.length} chars (max 1024)`);
    else if (desc.length > 500) warnings.push(`${where}: description is ${desc.length} chars (aim for ≤ 450)`);
    for (const k of Object.keys(data)) if (!SKILL_KEYS.includes(k)) warnings.push(`${where}: extra frontmatter key "${k}"`);
    const visible = data['disable-model-invocation'] !== true;
    if (visible && desc.length > BUDGET.visibleDescChars) {
      errors.push(`${where}: model-visible description is ${desc.length} chars (max ${BUDGET.visibleDescChars}; Antigravity drops the most expensive skills first). Shorten it or add "disable-model-invocation: true" and list it in an eag-* index`);
    }
    if (size < 3000 && !name.startsWith(INDEX_PREFIX)) warnings.push(`${where}: SKILL.md is ${size} bytes; looks like a stub`);
    if (size > 16000) warnings.push(`${where}: SKILL.md is ${size} bytes; move detail into references/`);
    for (const href of relLinks(body)) {
      if (!fs.existsSync(path.join(skillsDir, name, href))) errors.push(`${where}: broken relative link "${href}"`);
    }
    const workflow = /Invoke with \/[a-z0-9-]+\.?\s*$/.test(desc);
    skills.push({ name, description: desc, size, workflow, visible, index: name.startsWith(INDEX_PREFIX), body });
  }
  stats.skills = skills.length;
  stats.workflows = skills.filter((s) => s.workflow).length;
  stats.visibleSkills = skills.filter((s) => s.visible).length;

  // Slash-only skills cost no budget, so the model finds them through an eag-* index skill.
  const indexed = new Set();
  for (const s of skills.filter((x) => x.index)) {
    for (const href of relLinks(s.body)) {
      const m = /^\.\.\/([a-z0-9-]+)\/SKILL\.md$/.exec(href);
      if (m) indexed.add(m[1]);
    }
  }
  for (const s of skills) {
    if (!s.visible && !indexed.has(s.name)) errors.push(`skills/${s.name}: slash-only skill is not listed in any eag-* index, so the model can never find it`);
  }

  // ---- agents
  const agentsDir = path.join(root, 'agents');
  const agents = [];
  let agentFiles = [];
  try { agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort(); } catch { agentFiles = []; }
  for (const f of agentFiles) {
    const where = `agents/${f}`;
    const text = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    const { data, errors: fmErr } = parseFrontmatter(text);
    fmErr.forEach((e) => errors.push(`${where}: ${e}`));
    if (!data) {
      errors.push(`${where}: missing frontmatter (Antigravity skips agents without it)`);
      continue;
    }
    const base = f.replace(/\.md$/, '');
    if (data.name !== base) errors.push(`${where}: name "${data.name}" must equal the file name`);
    if (BUILTIN_AGENTS.includes(base)) errors.push(`${where}: collides with built-in agent "${base}"`);
    if (!data.description) errors.push(`${where}: description is required`);
    else if (String(data.description).length > BUDGET.agentDescChars) errors.push(`${where}: description is ${String(data.description).length} chars (max ${BUDGET.agentDescChars}; every subagent description is in every prompt)`);
    for (const k of Object.keys(data)) if (!AGENT_KEYS.includes(k)) errors.push(`${where}: unsupported key "${k}"`);
    if (data.model !== undefined && !MODELS.includes(data.model)) errors.push(`${where}: model must be one of ${MODELS.join('|')} (other values make the loader skip the agent)`);
    if (!Array.isArray(data.tools) || !data.tools.length) errors.push(`${where}: tools must be a non-empty list`);
    else for (const t of data.tools) if (!AGENT_TOOLS.includes(t)) errors.push(`${where}: unknown tool "${t}" (a misspelled tool can hang a subagent)`);
    for (const k of ['mainAgent', 'subagent']) if (data[k] !== undefined && typeof data[k] !== 'boolean') errors.push(`${where}: ${k} must be true or false`);
    const size = Buffer.byteLength(text);
    if (size < 1500) warnings.push(`${where}: ${size} bytes; looks like a stub`);
    agents.push({ name: base, description: data.description || '', model: data.model || 'inherit', tools: data.tools || [] });
  }
  stats.agents = agents.length;
  stats.budgetTokens = skills.filter((s) => s.visible).reduce((t, s) => t + skillCost(s.description), 0)
    + agents.reduce((t, a) => t + agentCost(String(a.description)), 0);
  if (stats.budgetTokens > BUDGET.eagShare) errors.push(`model-visible skills and subagents cost ~${stats.budgetTokens} tokens of Antigravity's ${BUDGET.total}-token customization budget (EAG's share is ${BUDGET.eagShare})`);

  // ---- rules
  const rulesDir = path.join(root, 'rules');
  const rules = [];
  let ruleFiles = [];
  try { ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md')).sort(); } catch { ruleFiles = []; }
  let alwaysOnBytes = 0;
  for (const f of ruleFiles) {
    const where = `rules/${f}`;
    const text = fs.readFileSync(path.join(rulesDir, f), 'utf8');
    const size = Buffer.byteLength(text);
    if (size > 24000) errors.push(`${where}: ${size} bytes exceeds the 24 KB rule cap`);
    if (f === 'AGENTS.md' || f === 'GEMINI.md') {
      if (text.startsWith('---')) errors.push(`${where}: AGENTS.md/GEMINI.md must not have frontmatter`);
      if (size > 6500) warnings.push(`${where}: ${size} bytes; always-on rules should stay under ~6 KB`);
      alwaysOnBytes += size;
      rules.push({ name: f, trigger: 'always_on', size });
      continue;
    }
    const { data, errors: fmErr } = parseFrontmatter(text);
    fmErr.forEach((e) => errors.push(`${where}: ${e}`));
    if (!data) {
      errors.push(`${where}: named rules need frontmatter with a trigger`);
      continue;
    }
    if (!RULE_TRIGGERS.includes(data.trigger)) errors.push(`${where}: trigger must be one of ${RULE_TRIGGERS.join('|')}`);
    if (data.trigger === 'glob' && (typeof data.globs !== 'string' || !data.globs.trim())) errors.push(`${where}: glob rules need "globs" as ONE comma-separated string`);
    if (data.trigger === 'model_decision' && !data.description) errors.push(`${where}: model_decision rules need a description`);
    if (data.trigger === 'always_on') alwaysOnBytes += size;
    if (size > 4500) warnings.push(`${where}: ${size} bytes; keep rules tight (≤ 4 KB)`);
    rules.push({ name: f, trigger: data.trigger, globs: data.globs || '', description: data.description || '', size });
  }
  stats.rules = rules.length;
  stats.alwaysOnTokens = Math.round(alwaysOnBytes / 4);
  if (stats.alwaysOnTokens > 6000) warnings.push(`always-on rules cost ~${stats.alwaysOnTokens} tokens per turn`);

  // ---- hooks
  const checkCommand = (where, cmd, base) => {
    const m = /^node\s+(?:"([^"]+)"|(\S+))/.exec(cmd || '');
    if (!m) return;
    const script = (m[1] || m[2]).replace(/\$\{extensionPath\}/g, root).replace(/\$\{\/\}/g, path.sep);
    if (!fs.existsSync(path.isAbsolute(script) ? script : path.join(base, script))) errors.push(`${where}: hook script not found: ${script}`);
  };
  const agHooks = path.join(root, 'hooks.json');
  if (fs.existsSync(agHooks)) {
    const h = readJson(agHooks, errors) || {};
    let n = 0;
    for (const [group, spec] of Object.entries(h)) {
      for (const [ev, list] of Object.entries(spec)) {
        if (ev === 'enabled') continue;
        if (!AG_EVENTS.includes(ev)) {
          errors.push(`hooks.json: ${group}: unknown event "${ev}"`);
          continue;
        }
        for (const entry of list) {
          const handlers = ['PreToolUse', 'PostToolUse'].includes(ev) ? entry.hooks || [] : [entry];
          if (['PreToolUse', 'PostToolUse'].includes(ev) && typeof entry.matcher !== 'string') errors.push(`hooks.json: ${group}.${ev} needs a matcher`);
          for (const hd of handlers) {
            n++;
            checkCommand(`hooks.json: ${group}.${ev}`, hd.command, root);
          }
        }
      }
    }
    stats.hooks = n;
  }
  const gHooks = path.join(root, 'hooks', 'hooks.json');
  if (fs.existsSync(gHooks)) {
    const h = (readJson(gHooks, errors) || {}).hooks || {};
    for (const [ev, list] of Object.entries(h)) {
      if (!GEMINI_EVENTS.includes(ev)) errors.push(`hooks/hooks.json: unknown Gemini event "${ev}"`);
      for (const entry of list) for (const hd of entry.hooks || []) checkCommand(`hooks/hooks.json: ${ev}`, hd.command, root);
    }
  }

  // ---- gemini extension
  const gext = path.join(root, 'gemini-extension.json');
  if (fs.existsSync(gext)) {
    const g = readJson(gext, errors) || {};
    if (g.contextFileName && !fs.existsSync(path.join(root, g.contextFileName))) errors.push(`gemini-extension.json: contextFileName "${g.contextFileName}" not found`);
  }

  // ---- cross references in "Related" sections
  const known = new Set([...skills.map((s) => s.name), ...agents.map((a) => a.name)]);
  for (const s of skills) {
    const related = s.body.split(/^## Related\s*$/m)[1];
    if (!related) continue;
    const section = related.split(/^## /m)[0];
    const refs = new Set();
    for (const m of section.matchAll(/`\/?([a-z0-9]+(?:-[a-z0-9]+)+|[a-z]{4,})`/g)) refs.add(m[1]);
    for (const m of section.matchAll(/(?:^|[\s(,])\/([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)) refs.add(m[1]);
    for (const r of refs) if (!known.has(r) && !BUILTIN_COMMANDS.includes(r)) warnings.push(`skills/${s.name}: Related references unknown "${r}"`);
  }

  return { errors, warnings, stats, skills, agents, rules };
}

module.exports = { validateRepo, BUILTIN_COMMANDS, AGENT_TOOLS, MODELS, BUDGET, skillCost, agentCost };
