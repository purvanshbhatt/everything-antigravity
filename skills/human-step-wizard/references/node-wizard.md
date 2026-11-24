# Node wizard template

A zero-dependency wizard for Node 18 or later. Copy it to the path the user chose, then edit three things: `TASK`, the `STEPS` array, and the `store` and `validate` functions for each step. Keep these properties when you edit it:

- Secrets are read with `mask: true`, checked for shape, and piped on stdin to their destination. They are never stored in a variable that outlives the step, printed, or written to the progress file.
- Validation functions return `true` or `false` and send child-process output to `ignore` when that output could contain a value.
- The script refuses to run without an interactive terminal, so nobody pipes secrets into it from a file by accident.
- On Windows, CLI tools such as `gcloud` are `.cmd` shims, so `run` turns on the shell there.

Try it with `node <path>/wizard.mjs --dry-run` before handing it over.

```js
#!/usr/bin/env node
// Interactive setup wizard. Run it in your own terminal: node wizard.mjs [--dry-run] [--from <id>] [--reset]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TASK = 'oauth-staging';
// CLI tools such as gcloud are .cmd shims on Windows and need a shell there.
const run = (cmd, argv, opts) => spawnSync(cmd, argv, { shell: process.platform === 'win32', ...opts });
const PROGRESS = path.join('.wizard', `${TASK}.json`);

// Each step: id, title, url, actions[], optional secret prompt, optional validate().
// validate() returns true/false and must never print a secret.
const STEPS = [
  {
    id: 'consent',
    title: 'Configure the OAuth consent screen',
    url: 'https://console.cloud.google.com/apis/credentials/consent',
    actions: ['Choose the staging project.', 'Set the app name and support email.', 'Save.'],
  },
  {
    id: 'client',
    title: 'Create a web OAuth client and store its secret',
    url: 'https://console.cloud.google.com/apis/credentials',
    actions: ['Create credentials > OAuth client ID > Web application.', 'Copy the client ID and client secret.'],
    ask: { key: 'clientId', prompt: 'Client ID: ' },
    secret: {
      prompt: 'Client secret (hidden): ',
      shape: (v) => v.length >= 20,
      store: (v) => run('gcloud', ['secrets', 'versions', 'add', 'oauth-client-secret', '--data-file=-'], { input: v, stdio: ['pipe', 'ignore', 'inherit'] }).status === 0,
    },
    validate: () => run('gcloud', ['secrets', 'versions', 'list', 'oauth-client-secret', '--limit=1'], { stdio: 'ignore' }).status === 0,
  },
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const fromId = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;

function load() {
  if (flag('--reset') || !fs.existsSync(PROGRESS)) return { task: TASK, started: new Date().toISOString(), steps: {} };
  return JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
}
function save(state) {
  fs.mkdirSync(path.dirname(PROGRESS), { recursive: true });
  fs.writeFileSync(PROGRESS, JSON.stringify(state, null, 2) + '\n');
}

// One reader for both visible and masked input; it needs a real terminal.
function ask(question, { mask = false } = {}) {
  const stdin = process.stdin;
  return new Promise((resolve) => {
    let value = '';
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\nStopped. Progress is saved; run again to resume.\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            if (!mask) process.stdout.write('\b \b');
          }
          continue;
        }
        value += ch;
        if (!mask) process.stdout.write(ch);
      }
    };
    stdin.on('data', onData);
  });
}

function show(step, i) {
  console.log(`\n[${i + 1}/${STEPS.length}] ${step.title}`);
  if (step.url) console.log(`  Open: ${step.url}`);
  step.actions.forEach((a, n) => console.log(`  ${n + 1}. ${a}`));
}

async function main() {
  if (flag('--dry-run')) {
    STEPS.forEach(show);
    return;
  }
  if (!process.stdin.isTTY) {
    console.error('Run this wizard in an interactive terminal.');
    process.exit(2);
  }
  const state = load();
  let i = fromId ? STEPS.findIndex((s) => s.id === fromId) : STEPS.findIndex((s) => state.steps[s.id]?.status !== 'done');
  if (i < 0) {
    console.log('All steps are done.');
    return;
  }
  console.log(`${TASK}: ${STEPS.length} steps. Commands: done, skip, back, quit.`);
  while (i < STEPS.length) {
    const step = STEPS[i];
    show(step, i);
    const cmd = (await ask('  > ')).trim().toLowerCase();
    if (cmd === 'quit') break;
    if (cmd === 'back') { i = Math.max(0, i - 1); continue; }
    if (cmd === 'skip') { state.steps[step.id] = { status: 'skipped', at: new Date().toISOString() }; save(state); i++; continue; }
    if (cmd !== 'done') { console.log('  Type done, skip, back or quit.'); continue; }
    const entry = { status: 'done', at: new Date().toISOString() };
    if (step.ask) entry.values = { [step.ask.key]: (await ask(`  ${step.ask.prompt}`)).trim() };
    if (step.secret) {
      const value = await ask(`  ${step.secret.prompt}`, { mask: true });
      if (!step.secret.shape(value)) { console.log('  FAIL: that value does not look right. Try the step again.'); continue; }
      if (!step.secret.store(value)) { console.log('  FAIL: could not store the secret. Fix the error above and retry.'); continue; }
    }
    if (step.validate && !step.validate()) { console.log('  FAIL: validation did not pass. Check the step and retry.'); continue; }
    console.log('  PASS');
    state.steps[step.id] = entry;
    save(state);
    i++;
  }
  save(state);
  console.log(`\nProgress saved to ${PROGRESS}.`);
}

main();
```

## Adapting a step

| Destination | `store` body (value arrives as `v`) | `validate` body |
| :--- | :--- | :--- |
| Google Secret Manager | `run('gcloud', ['secrets', 'versions', 'add', NAME, '--data-file=-'], { input: v })` | `run('gcloud', ['secrets', 'versions', 'list', NAME, '--limit=1'], { stdio: 'ignore' })` |
| GitHub Actions secret | `run('gh', ['secret', 'set', NAME], { input: v })` | `run('gh', ['secret', 'list'], { encoding: 'utf8' }).stdout.includes(NAME)` |
| Local git-ignored `.env` | append `NAME=<value>` with `fs.appendFileSync` after `git check-ignore` confirms the file is ignored | read the file and test that the key exists, without printing the line |

Check the current flags with `gcloud secrets versions add --help` and `gh secret set --help` before relying on them; these tools change.

For steps with no value to collect (clicking through a consent screen, approving a quota), leave out `ask` and `secret`, and give `validate` a read-only check if one exists. If none exists, the user's `done` is the confirmation; say so in the step's actions.
