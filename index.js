const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = __dirname;
const SKILLS_DIR = path.join(ROOT_DIR, 'skills');
const AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const COMMANDS_DIR = path.join(ROOT_DIR, 'commands');
const RULES_DIR = path.join(ROOT_DIR, 'rules');
const MCP_DIR = path.join(ROOT_DIR, 'mcp-configs');

function listDir(dir, filter = () => true) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(filter);
  } catch (err) {
    return [];
  }
}

function getSkills() {
  return listDir(SKILLS_DIR, (f) => fs.statSync(path.join(SKILLS_DIR, f)).isDirectory());
}

function getAgents() {
  return listDir(AGENTS_DIR, (f) => f.endsWith('.md'));
}

function getCommands() {
  return listDir(COMMANDS_DIR, (f) => f.endsWith('.md'));
}

function getRules() {
  return listDir(RULES_DIR, (f) => f.endsWith('.md'));
}

function getMcpConfig() {
  const mcpPath = path.join(MCP_DIR, 'antigravity-mcp.json');
  if (fs.existsSync(mcpPath)) {
    return JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
  }
  return null;
}

function runShieldScan(text, options = {}) {
  const pythonCmd = options.python || (process.platform === 'win32' ? 'python' : 'python3');
  const cliScript = path.join(ROOT_DIR, 'src', 'cli.py');
  const result = spawnSync(pythonCmd, [cliScript, 'shield', '--text', text], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { PYTHONPATH: ROOT_DIR })
  });
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

module.exports = {
  version: require('./package.json').version,
  ROOT_DIR,
  SKILLS_DIR,
  AGENTS_DIR,
  COMMANDS_DIR,
  RULES_DIR,
  MCP_DIR,
  getSkills,
  getAgents,
  getCommands,
  getRules,
  getMcpConfig,
  runShieldScan
};
