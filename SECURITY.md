# Security Policy

## Supported versions

| Version | Supported |
| :--- | :--- |
| 2.x | Yes |
| 1.x | No. Upgrade with `eag install`, which migrates a v1 install safely. |

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/purvanshbhatt/everything-antigravity/security/advisories/new). Do not open a public issue for anything security-sensitive.

Include the following:

- the affected file or command;
- the hook profile (`eag profile get`);
- the agent surface: Antigravity App, IDE, `agy` CLI, or Gemini CLI;
- a minimal reproduction.

Guard bypasses are in scope. An example is a destructive command or a real credential that the pre-tool hook lets through under the `standard` profile.

## What EAG protects against, and what it doesn't

EAG's hooks are a safety net for agent mistakes, not a sandbox.

- **What they do.** They deny a short list of catastrophic commands, ask before risky ones, and block real-looking credentials from being written into source files.
- **What they can't do.** A determined process can bypass them, for example by encoding a command or writing through another tool.
- **Untrusted code.** For that, use isolation as well. See the `sandbox-isolation` skill and the `agy --sandbox` flag.

To check a command or a file yourself:

```bash
eag shield --cmd "<command>"
eag shield --file <path>
```

Both exit 1 on findings, so they can also gate CI or pre-commit hooks.
