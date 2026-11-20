'use strict';
/** Cheap project-stack detection (existence checks only, no globbing). */
const fs = require('node:fs');
const path = require('node:path');

function readPkg(ws) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ws, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} ws workspace root
 * @returns {{languages: string[], packageManager: string|null, commands: Record<string,string>}}
 */
function detectStack(ws) {
  const has = (f) => {
    try { return fs.existsSync(path.join(ws, f)); } catch { return false; }
  };
  const out = { languages: [], packageManager: null, commands: {} };
  if (!ws) return out;

  const pkg = readPkg(ws);
  if (pkg) {
    const pm = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : (has('bun.lockb') || has('bun.lock')) ? 'bun' : 'npm';
    out.packageManager = pm;
    out.languages.push(has('tsconfig.json') ? 'TypeScript' : 'JavaScript');
    const scripts = pkg.scripts || {};
    const run = (s) => (pm === 'npm' ? (s === 'test' ? 'npm test' : `npm run ${s}`) : `${pm} ${s}`);
    for (const [key, names] of Object.entries({ test: ['test'], lint: ['lint'], typecheck: ['typecheck', 'type-check', 'tsc'], build: ['build'] })) {
      const hit = names.find((n) => scripts[n]);
      if (hit) out.commands[key] = run(hit);
    }
  }
  if (has('pyproject.toml') || has('requirements.txt') || has('setup.py')) {
    out.languages.push('Python');
    out.commands.test = out.commands.test || 'pytest';
  }
  if (has('go.mod')) {
    out.languages.push('Go');
    out.commands.test = out.commands.test || 'go test ./...';
  }
  if (has('Cargo.toml')) {
    out.languages.push('Rust');
    out.commands.test = out.commands.test || 'cargo test';
  }
  if (has('pubspec.yaml')) {
    out.languages.push('Dart/Flutter');
    out.commands.test = out.commands.test || 'flutter test';
  }
  if (has('build.gradle') || has('build.gradle.kts')) {
    out.languages.push('JVM (Gradle)');
    out.commands.test = out.commands.test || (process.platform === 'win32' ? 'gradlew.bat test' : './gradlew test');
  } else if (has('pom.xml')) {
    out.languages.push('JVM (Maven)');
    out.commands.test = out.commands.test || 'mvn test';
  }
  if (has('project.godot')) out.languages.push('Godot');
  return out;
}

function stackHint(ws) {
  const s = detectStack(ws);
  if (!s.languages.length) return '';
  const cmds = Object.entries(s.commands).map(([k, v]) => `${k}: \`${v}\``).join(' · ');
  return `Stack: ${s.languages.join(', ')}${s.packageManager ? ` (${s.packageManager})` : ''}${cmds ? ` · ${cmds}` : ''}`;
}

module.exports = { detectStack, stackHint };
