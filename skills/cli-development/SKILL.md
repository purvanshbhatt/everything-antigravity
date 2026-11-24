---
name: cli-development
disable-model-invocation: true
description: >-
  Builds command-line tools people and scripts can rely on: argument parsing
  in Node, Python, Go and Rust, help text, stdout versus stderr, JSON output,
  exit codes, config and env precedence, TTY and NO_COLOR handling, safe
  destructive commands, signal handling, testing, and packaging for npm, PyPI,
  Go and Cargo. Use when creating a CLI, adding commands or flags, or fixing a
  CLI that is hard to script or behaves differently on Windows.
---

# CLI Development

A good CLI is predictable for humans and machines: clear help, data on stdout,
diagnostics on stderr, honest exit codes, stable machine-readable output, and
no surprises in CI or on Windows. Design the interface before writing code.

## When to use

- Creating a new CLI or adding subcommands, flags or config files.
- The tool is hard to script: mixed output streams, exit code 0 on failure, prompts in CI.
- Packaging a CLI for npm, PyPI, `go install` or Cargo.
- A command misbehaves on Windows paths, colours or Ctrl-C.

## When not to use

- Generating an API client library: use `sdk-generation`.
- Repo task aliases (`test`, `lint`): use `task-runners`.
- Shell scripts for one-off automation: use `bash-scripting` or `powershell-scripting`.
- Cutting the release itself: use `/release-management`.

## Workflow

1. **Write the help text first.** Draft `tool --help` and each `tool <cmd> --help` as plain text: usage line, one-sentence purpose, arguments, flags with defaults, two examples. Pattern: `tool <noun> <verb>` for many resources (`tool user create`), `tool <verb>` for small tools. Every flag has a long form; frequent ones get a short alias. Keep positional arguments to one or two.

   **Check:** A teammate can predict what three example commands do from the help alone.

2. **Pick a parser.**

   | Language | Built in | Full-featured |
   | :--- | :--- | :--- |
   | Node | `util.parseArgs` | commander, yargs, oclif |
   | Python | `argparse` | click, typer |
   | Go | `flag` | cobra, urfave/cli |
   | Rust | (none) | clap with derive |

   ```js
   #!/usr/bin/env node
   import { parseArgs } from 'node:util';

   let parsed;
   try {
     parsed = parseArgs({
       allowPositionals: true,
       options: {
         json: { type: 'boolean', default: false },
         output: { type: 'string', short: 'o' },
         help: { type: 'boolean', short: 'h' },
       },
     });
   } catch (err) {
     console.error(`error: ${err.message}\nRun "tool --help" for usage.`);
     process.exit(2);                                  // usage error
   }
   ```

   **Check:** Unknown flags and missing arguments print a one-line error plus a usage hint to stderr and exit 2.

3. **Separate streams and formats.** Results go to stdout; progress, warnings and logs go to stderr. Offer `--json` with a documented, stable schema; human output may change between versions, JSON output must not. Disable colour and spinners when stdout is not a TTY or `NO_COLOR` is set; offer `--quiet` and `--verbose`.

   **Check:** `tool list --json | jq .` parses, and `tool list > out.txt` contains no escape codes or spinner frames.

4. **Return honest exit codes.** `0` success, `1` runtime failure, `2` usage error, `130` interrupted by Ctrl-C (128 + SIGINT). Document any others. Never exit 0 after printing an error.

   **Check:** Tests assert the exit code for success, failure, bad usage and interrupt.

5. **Layer configuration.** Precedence: flags > environment (`TOOL_*`) > project file (`./tool.toml`) > user file > defaults. User config lives in `$XDG_CONFIG_HOME/tool` (fallback `~/.config/tool`) and `%APPDATA%\tool` on Windows. Tokens come from env vars or the OS keychain, never plaintext config written by default. Provide `tool config get|set|path`.

   **Check:** `tool config path` prints the resolved file, and a flag overrides an env var in a test.

6. **Make destructive commands safe.** Prompt only when stdin is a TTY; otherwise require `--yes` or `--force`, and offer `--dry-run`. On SIGINT, stop work, clean temp files, restore the terminal and exit 130.

   **Check:** In CI (non-TTY), a destructive command without `--yes` fails fast with a clear message instead of hanging.

7. **Test as a black box.** Run the built binary as a subprocess: snapshot `--help`, assert stdout, stderr and exit code, and use temp directories for files. Include Windows in the CI matrix (paths with spaces, backslashes, CRLF).

   **Check:** CI runs the black-box suite on Linux and Windows.

8. **Package and distribute (publishing needs user confirmation).**

   | Ecosystem | Entry point | Install |
   | :--- | :--- | :--- |
   | Node | `"bin": { "tool": "dist/cli.js" }` plus shebang | `npm i -g tool`, `npx tool`; npm creates Windows shims |
   | Python | `[project.scripts] tool = "tool.cli:main"` | `uv tool install tool`, `pipx install tool` |
   | Go | `main` package | `go install example.com/tool@latest`; GoReleaser for binaries |
   | Rust | `[[bin]]` or `src/main.rs` | `cargo install tool`; cargo-dist for installers |

   **Check:** A clean install on a fresh machine or container runs `tool --version`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Print logs and results to stdout together | Results to stdout, everything else to stderr | Pipes and `--json` consumers break |
| Exit 0 after an error message | Non-zero exit for every failure | Scripts and CI miss failures |
| Interactive prompts with no bypass | `--yes`, env vars, TTY detection | Hangs CI and agent runs |
| Colour codes in redirected output | Check TTY and `NO_COLOR` | Garbage in files and logs |
| Breaking flag renames in a minor release | Keep old flags as hidden aliases with a deprecation warning | Users' scripts break silently |
| Secrets in config files by default | Env vars or OS keychain | Plaintext tokens leak via dotfile repos |

## Verification checklist

- [ ] Help text covers every command with examples; `--version` works.
- [ ] stdout carries only results; `--json` is stable and documented.
- [ ] Exit codes are tested for success, failure, usage error and interrupt.
- [ ] Config precedence is documented and tested.
- [ ] Destructive commands require confirmation or `--yes` and support `--dry-run`.
- [ ] Black-box tests pass on Linux and Windows; a clean install works.

## Related

- Workflows: `/tdd`, `/release-management`.
- Knowledge: `nodejs-patterns`, `python-packaging`, `golang-services`, `rust-systems`, `sdk-generation`, `task-runners`.
- Agents: `code-reviewer`, `typescript-reviewer`, `python-reviewer`, `go-reviewer`.
