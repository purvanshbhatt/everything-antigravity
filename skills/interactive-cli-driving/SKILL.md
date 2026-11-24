---
name: interactive-cli-driving
disable-model-invocation: true
description: >-
  Operates programs that need a live terminal (REPLs, debuggers such as pdb,
  gdb and lldb, database shells, interactive installers and full-screen TUIs)
  by running them in a named, detached tmux session or under pexpect, sending
  keys, capturing the screen and polling for prompts instead of sleeping. Use
  when a command waits for keyboard input, or when stepping through a
  debugger or REPL is the fastest way to an answer.
---

# Interactive CLI Driving

Commands started with `run_command` are not attached to a terminal you can watch and type into key by key, so a program that stops at a prompt simply waits until the call times out. The fix is to give the program a real terminal that you control: a detached tmux session for exploratory and full-screen work, or pexpect for repeatable scripted dialogues. Before any of that, look for a way to avoid the prompt altogether.

**Ground rules.** Name every session, put a timeout on every wait, never type a secret, never answer "yes" to a destructive prompt without the user's consent, and kill every session you start.

## When to use

- A REPL is the quickest way to probe a library, a data file or a live service: `python`, `node`, `psql`, `redis-cli`, `sqlite3`.
- Stepping through code in a debugger: `pdb`, `gdb`, `lldb`, `node inspect`, `dlv`.
- An installer, scaffolder or migration tool asks questions and has no flag to answer them.
- A full-screen terminal UI must be operated or read: `htop`, `k9s`, `lazygit`, a curses menu.

## When not to use

- Web pages and browser UIs: `browser-automation` or the browser agent.
- Designing a CLI that scripts well in the first place: `cli-development`.
- Writing ordinary shell scripts: `bash-scripting` or `powershell-scripting`.
- Editing files: use `write_to_file` and `replace_file_content`, never a terminal editor.
- Prompts for passwords, MFA codes or payment details: hand the session to the user (step 7).

## Workflow

1. **Try to avoid the prompt.** Read `<tool> --help` and prefer a non-interactive path:

   | Situation | Non-interactive form |
   | :--- | :--- |
   | Package installs | `DEBIAN_FRONTEND=noninteractive apt-get install -y <pkg>` · `npm init -y` |
   | Git editors and pagers | `git commit -m "..."` · `git merge --no-edit` · `GIT_EDITOR=true git rebase --continue` · `git --no-pager log` |
   | Git credential prompts | `GIT_TERMINAL_PROMPT=0` makes git fail instead of hanging |
   | Pagers in general | `PAGER=cat`, or pipe the output through `cat` |
   | One-off REPL work | `python -c "..."`, `node -e "..."`, or a script file |
   | Database shells | `psql -X -c "select 1"` or `-f query.sql`; `sqlite3 app.db "select 1"` |
   | Debugger backtrace | `gdb -batch -ex run -ex bt --args ./prog arg` · `lldb --batch -o run -o bt -- ./prog arg` |
   | Line-based yes/no prompts | `printf 'y\n' \| tool`, only for prompts that read stdin and only with the user's agreement |
   | Scaffolders | Many skip questions when `CI=true` is set or when every option is passed as a flag; check the help |

   **Check:** You confirmed from the help text that no flag or environment variable avoids the prompt before going interactive.

2. **Pick the driver.**

   | Driver | Best for | Platform |
   | :--- | :--- | :--- |
   | tmux | Exploratory sessions, debuggers, full-screen TUIs, handing control to the user | Linux, macOS, WSL |
   | pexpect (Python) | Repeatable scripted dialogues, tests of interactive programs | Linux, macOS, WSL; native Windows only via `PopenSpawn` |
   | expect (Tcl) | Existing expect scripts, environments without Python | Linux, macOS |

   On native Windows, pexpect's `PopenSpawn` uses pipes rather than a terminal: it works for programs that read lines from stdin, but not for TUIs or programs that refuse to run without a terminal. Use WSL for those.

   **Check:** The chosen driver is installed (`tmux -V`, `python -c "import pexpect"`).

3. **Start a named, sized, logged session.** Start a shell first and launch the program inside it, so the pane survives if the program exits and you can read its last words.

   ```bash
   S="agent-pdb-$$"
   LOG="${TMPDIR:-/tmp}/$S.log"
   tmux new-session -d -s "$S" -x 200 -y 50
   tmux pipe-pane -t "$S" -o "cat >> '$LOG'"
   tmux send-keys -t "$S" "python3 -m pdb app/report.py" Enter
   ```

   A wide pane avoids wrapped lines that break pattern matching. The log is a transcript; it can contain sensitive output, so keep it in a temp folder and delete it in step 8.

   **Check:** `tmux has-session -t "$S"` exits 0.

4. **Wait for the prompt by polling.** Never `sleep 5` and hope. Poll the last non-empty screen line for the prompt, with a deadline:

   ```bash
   wait_for() {   # usage: wait_for <session> <regex for last line> [timeout-seconds]
     local s=$1 re=$2 limit=${3:-30} ticks=0
     while [ "$ticks" -lt $((limit * 4)) ]; do
       if tmux capture-pane -p -J -t "$s" | sed '/^[[:space:]]*$/d' | tail -n 1 | grep -Eq "$re"; then
         return 0
       fi
       sleep 0.25
       ticks=$((ticks + 1))
     done
     echo "timeout after ${limit}s waiting for /$re/ in $s" >&2
     tmux capture-pane -p -J -t "$s" | tail -n 20 >&2
     return 1
   }
   wait_for "$S" '^\(Pdb\) ?$' 20
   ```

   Common prompts: Python `'^>>> ?$'`, pdb `'^\(Pdb\) ?$'`, gdb `'^\(gdb\) ?$'`, lldb `'^\(lldb\) ?$'`, Node `'^> ?$'`, psql `'=[#>] ?$'`. Full-screen TUIs have no prompt line: wait until two captures half a second apart are identical, with the same kind of deadline.

   **Check:** Every send in your session is preceded by a successful wait.

5. **Send input precisely.** Send text literally with `-l`, then the key separately, one command at a time:

   ```bash
   tmux send-keys -t "$S" -l 'b app/report.py:42'
   tmux send-keys -t "$S" Enter
   wait_for "$S" '^\(Pdb\) ?$' 10
   ```

   Key names: `Enter`, `Escape`, `Tab`, `BSpace`, `Up`, `Down`, `PageDown`, `F10`, `C-c` (interrupt), `C-d` (end of input). For multi-line code in a REPL, write it to a file with `write_to_file` and load it (`exec(open("snippet.py").read())`) rather than typing indented blocks.

   **Check:** The echoed command on screen matches what you meant to send.

6. **Read the output.** Capture the screen plus scrollback, and strip terminal escape codes before reasoning over the log:

   ```bash
   tmux capture-pane -p -J -t "$S" -S -200
   eag compact --file "$LOG"          # or: node <plugin-root>/bin/eag.js compact --file "$LOG"
   ```

   To isolate one command's output, note the log size before sending (`wc -c < "$LOG"`) and read only the bytes after it (`tail -c +<size+1> "$LOG"`).

   **Check:** You quote output from the capture, not from what you expected to see.

7. **Hand control to the user when a human must type.** Password, passphrase, MFA, licence acceptance or confirmation of a destructive step: stop, tell the user the session name, and let them answer.

   ```text
   The installer is waiting for a password. Run `tmux attach -t agent-setup-4121`,
   type it there, then detach with Ctrl-b d and tell me to continue.
   ```

   Never send secrets with `send-keys`: they land in the scrollback and the log. If one was typed by mistake, run `tmux clear-history -t "$S"` and delete the log.

   **Check:** No secret value appears in any command you ran or any log you kept.

8. **Clean up.** Exit the program properly (`q`, `exit()`, `\q`, `C-d`), then remove the session and the transcript:

   ```bash
   tmux kill-session -t "$S"
   rm -f "$LOG"
   tmux ls 2>/dev/null | grep '^agent-' || echo "no agent sessions left"
   ```

   In scripts, register cleanup up front: `trap 'tmux kill-session -t "$S" 2>/dev/null; rm -f "$LOG"' EXIT`.

   **Check:** `tmux ls` shows no session started by this task, and the log is gone.

## Scripted dialogues with pexpect

Use pexpect when the same dialogue must run again, for example in a test:

```python
import sys

import pexpect

child = pexpect.spawn("python3", ["-q"], encoding="utf-8", timeout=15, dimensions=(50, 200))
child.logfile_read = sys.stdout              # transcript; omit if output may be sensitive
child.expect(r">>> ")
child.sendline("import json; print(json.dumps({'ok': True}))")
child.expect(r">>> ")
print("echo and output:", child.before.strip())
child.sendline("exit()")
child.expect(pexpect.EOF)
```

`expect` raises `pexpect.TIMEOUT` or `pexpect.EOF`; catch them and print `child.before` so the failure shows what the program said. Pass a list such as `child.expect([r"\(y/N\)", r">>> "])` to branch on whichever prompt appears.

## Debugger quick reference

| Action | pdb | gdb | lldb |
| :--- | :--- | :--- | :--- |
| Break at a line | `b file.py:42` | `break file.c:42` | `b file.c:42` |
| Run or continue | `c` | `run`, then `continue` | `run`, then `continue` |
| Step over, step into | `n`, `s` | `next`, `step` | `next`, `step` |
| Show a value | `p expr` | `print expr` | `p expr` |
| Stack | `w` | `bt` | `bt` |
| Quit | `q` | `quit` | `quit` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `sleep 5` before reading the screen | Poll for the prompt with a deadline | Too short flakes; too long wastes minutes |
| Fire several commands without waiting | Wait for the prompt after each one | Keystrokes land in the wrong program state |
| Type passwords or tokens with `send-keys` | Let the user attach and type them | Secrets persist in scrollback and logs |
| Unnamed or leftover sessions | `agent-<purpose>-<pid>` names and a cleanup trap | Orphans keep processes, locks and ports alive |
| Drive vim or nano to change a file | Use `write_to_file` or `replace_file_content` | Editors are slow and error-prone to script |
| Auto-confirm destructive prompts | Show the prompt to the user and ask | "Are you sure?" exists for a reason |
| Parse raw escape sequences | `capture-pane -p` or `eag compact` first | Color codes break regexes |

## Verification checklist

- [ ] A non-interactive alternative was checked and ruled out first.
- [ ] Every session had a unique `agent-` name and a fixed size.
- [ ] Every send was preceded by a successful wait with a timeout.
- [ ] Results quoted to the user come from captured output.
- [ ] No secret was typed by the agent; human-only prompts were handed to the user.
- [ ] Sessions were killed and transcripts deleted at the end.

## Related

- Knowledge: `bash-scripting`, `powershell-scripting`, `cli-development`, `browser-automation`, `sandbox-isolation`, `agent-shield`, `linux-admin`.
- Workflows: `/root-cause` (debugger-driven investigation).
- Agents: `test-engineer` (turning a scripted dialogue into a regression test).
