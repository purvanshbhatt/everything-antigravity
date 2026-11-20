# Hooks reference

Paraphrased from Antigravity's built-in customization guide, plus behaviour
EAG verified with `agy` on 2026-11-19 (marked **verified**).

## Events

| Event | Fires | Shape in `hooks.json` | stdout |
| :--- | :--- | :--- | :--- |
| `SessionStart` | Once per new conversation | Flat list of handlers | Optional `injectSteps` |
| `PreInvocation` | Before each model call | Flat list | Optional `injectSteps`, `terminationBehavior` |
| `PreToolUse` | Before a tool runs | Groups: `matcher` + `hooks` | Decision object, or nothing |
| `PostToolUse` | After a tool finishes | Groups: `matcher` + `hooks` | `{}` |
| `PostInvocation` | After the model's tool calls finish | Flat list | Optional `injectSteps`, `terminationBehavior` |
| `Stop` | When the loop is about to end | Flat list | `{"decision": "continue", "reason": ...}` to keep going |

Handler fields: `type` (only `"command"`), `command` (run with `sh -c` on
Unix and `cmd /c` on Windows; `~` expands), `timeout` in seconds (default 30).
A named hook can set `"enabled": false`. Hooks from different plugins for the
same event are merged and run in sequence, synchronously, blocking the agent:
keep them fast.

Matchers are regexes on the tool name: `"*"` or `""` match all,
`"run_command|view_file"` matches either, `"browser_.*"` a prefix.

## Payload (stdin, camelCase)

Common: `conversationId`, `workspacePaths`, `transcriptPath`,
`artifactDirectoryPath`, `modelName`, `lastUserInput`, `hookEventName`, `cwd`
(the agent's working directory, not the hook's). The transcript and artifact
directories are named `antigravity-cli/`, `antigravity/` or `antigravity-ide/`
depending on the product.

- PreToolUse / PostToolUse add `toolCall` (`id`, `name`, `args`) and `stepIdx`;
  PostToolUse adds `error` when the tool failed.
- PreInvocation / PostInvocation add `invocationNum`, `initialNumSteps`.
- Stop adds `executionNum`, `terminationReason` (`NO_TOOL_CALL`,
  `MAX_INVOCATIONS`, `ERROR`, `USER_CANCELED`, ...), `error`, `fullyIdle`,
  `continuationActive`.

**Verified** CLI tool names and args: `run_command` (`args.CommandLine`),
`write_file` (`args.Path`, `args.Content`), `read_file` (`args.Path`). IDE
names such as `write_to_file` and `replace_file_content` use different
argument keys: capture a payload with the logger below before matching on them.

## Output contracts

PreToolUse:

```json
{ "decision": "ask", "reason": "Shown to the user and agent",
  "permissionOverrides": ["command(npm test)"],
  "overwrite": { "CommandLine": "npm test -- --runInBand" } }
```

- `decision`: `allow`, `deny`, `ask` (respects cached "always allow"),
  `force_ask` (always prompts).
- `overwrite` is a shallow merge into the tool arguments; the agent is told
  which keys a hook rewrote.
- **Verified:** printing nothing with exit 0 is "no opinion"; printing `{}`
  denies; a non-zero exit fails the tool call.

SessionStart / PreInvocation / PostInvocation `injectSteps` items:
`{"systemMessage": {"systemMessage": "...", "metadata": {...}}}` (nested
object, **verified** for SessionStart), `{"userMessage": "..."}`, or
`{"errorMessage": {"userMessage": "..."}}` (shown to the user only).
`metadata.user_markdown` renders markdown for the user that the model never
sees. `terminationBehavior`: `"terminate"` stops the turn (pair it with an
`errorMessage`); PostInvocation also accepts `"force_continue"`.

Stop: `{"decision": "continue", "reason": "Run the tests first."}`. Always
check `continuationActive` so the hook cannot loop forever.

## Plugin environment

Plugin hooks get `PLUGIN_ROOT` and, for installed plugins, `PLUGIN_DATA` as
environment variables. They are not substituted into `command`, and shells
differ (`$VAR` in sh, `%VAR%` in cmd), so read them inside the script.

## Example `hooks.json` (plugin root)

```json
{
  "guard": {
    "PreToolUse": [
      {
        "matcher": "run_command|write_file|write_to_file|replace_file_content",
        "hooks": [{ "type": "command", "command": "node ./hooks/guard.js", "timeout": 10 }]
      }
    ],
    "SessionStart": [
      { "type": "command", "command": "node ./hooks/session-start.js", "timeout": 10 }
    ]
  }
}
```

## `hooks/guard.js` (zero dependencies)

```js
// PreToolUse guard. Prints NOTHING for "no opinion"; printing {} would deny.
const DANGEROUS = [/\brm\s+-rf\s+\/(\s|$)/, /\bmkfs(\.\w+)?\b/, /\bformat\s+[a-z]:/i, /\bcurl\b[^|]*\|\s*(ba)?sh\b/];
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // unparseable payload: fail open (no opinion)
  }
  const call = payload.toolCall || {};
  const args = call.args || {};
  const reply = (obj) => process.stdout.write(JSON.stringify(obj));

  if (call.name === "run_command") {
    const cmd = String(args.CommandLine || "");
    if (DANGEROUS.some((re) => re.test(cmd))) {
      return reply({ decision: "deny", reason: `Blocked dangerous command: ${cmd.slice(0, 120)}` });
    }
  }
  if (/^(write_file|write_to_file|replace_file_content)$/.test(call.name)) {
    const target = String(args.Path || ""); // add IDE argument keys after capturing a payload
    if (/(^|[\\/])\.env(\.[\w-]+)?$/.test(target)) {
      return reply({ decision: "ask", reason: `Writing a secrets file: ${target}` });
    }
  }
  // no output: normal permission flow
});
```

## `hooks/session-start.js`

```js
process.stdin.resume();
process.stdin.on("end", () => {
  process.stdout.write(JSON.stringify({
    injectSteps: [{ systemMessage: { systemMessage: "This repo uses pnpm. Run `pnpm test` before claiming done." } }],
  }));
});
```

## Payload logger (discover real tool names)

```js
// hooks/log-payload.js: append each payload to a JSONL file; print nothing.
const fs = require("fs"), os = require("os"), path = require("path");
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  const dir = process.env.PLUGIN_DATA || os.tmpdir();
  fs.appendFileSync(path.join(dir, "agy-hook-payloads.jsonl"), raw.trim() + "\n");
});
```

Register it with `"matcher": "*"` temporarily, run one session, read the file,
then remove it: payloads include `lastUserInput` and file contents, so treat
the log as sensitive and delete it afterwards.

## Smoke test

```bash
echo '{"toolCall":{"name":"run_command","args":{"CommandLine":"rm -rf /"}}}' | node hooks/guard.js
# expect: {"decision":"deny",...}
echo '{"toolCall":{"name":"run_command","args":{"CommandLine":"npm test"}}}' | node hooks/guard.js
# expect: no output
```

```powershell
'{"toolCall":{"name":"run_command","args":{"CommandLine":"npm test"}}}' | node hooks/guard.js
$LASTEXITCODE   # expect 0
```
