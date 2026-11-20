'use strict';
/**
 * Programmatic API for Everything Antigravity.
 *
 *   const eag = require('everything-antigravity');
 *   eag.classifyCommand('git push --force').level;   // 'ask'
 *   eag.scanSecrets(fileText);                        // [{ id, severity, line, preview }]
 *   eag.validateRepo(eag.ROOT).errors;                // []
 */
const fs = require('node:fs');
const path = require('node:path');
const { classifyCommand, scanSecrets, scanInjection } = require('./scripts/lib/shield');
const { validateRepo } = require('./scripts/lib/validate');
const { parseFrontmatter } = require('./scripts/lib/frontmatter');
const installer = require('./scripts/lib/install');
const { runDoctor } = require('./scripts/lib/doctor');
const instincts = require('./scripts/lib/instincts');
const sessions = require('./scripts/lib/sessions');

const ROOT_DIR = __dirname;
const SKILLS_DIR = path.join(ROOT_DIR, 'skills');
const AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const RULES_DIR = path.join(ROOT_DIR, 'rules');
const MCP_DIR = path.join(ROOT_DIR, 'mcp-configs');

function listDir(dir, filter) {
  try {
    return fs.readdirSync(dir).filter(filter).sort();
  } catch {
    return [];
  }
}

/** Skill directory names. */
function getSkills() {
  return listDir(SKILLS_DIR, (f) => fs.existsSync(path.join(SKILLS_DIR, f, 'SKILL.md')));
}

/** Skills that are slash-command workflows (description ends with "Invoke with /name."). */
function getWorkflows() {
  return getSkills().filter((name) => {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(SKILLS_DIR, name, 'SKILL.md'), 'utf8'));
    return /Invoke with \//.test((data && data.description) || '');
  });
}

/** Agent file names (`*.md`). */
function getAgents() {
  return listDir(AGENTS_DIR, (f) => f.endsWith('.md'));
}

/** Rule file names (`*.md`). */
function getRules() {
  return listDir(RULES_DIR, (f) => f.endsWith('.md'));
}

/** Bundled MCP server catalog. */
function getMcpCatalog() {
  return JSON.parse(fs.readFileSync(path.join(MCP_DIR, 'catalog.json'), 'utf8'));
}

/** v1-compatible: shield scan without spawning Python. */
function runShieldScan(text) {
  const secrets = scanSecrets(text);
  const injection = scanInjection(text);
  const passed = secrets.length === 0 && injection.length === 0;
  return { exitCode: passed ? 0 : 1, passed, secrets, injection };
}

module.exports = {
  version: installer.readVersion(ROOT_DIR),
  ROOT: ROOT_DIR,
  ROOT_DIR,
  SKILLS_DIR,
  AGENTS_DIR,
  RULES_DIR,
  MCP_DIR,
  getSkills,
  getWorkflows,
  getAgents,
  getRules,
  getMcpCatalog,
  // v1 aliases
  getCommands: getWorkflows,
  getMcpConfig: getMcpCatalog,
  runShieldScan,
  // core libraries
  classifyCommand,
  scanSecrets,
  scanInjection,
  validateRepo,
  parseFrontmatter,
  install: installer.install,
  uninstall: installer.uninstall,
  planInstall: installer.plan,
  runDoctor,
  instincts,
  sessions,
};
