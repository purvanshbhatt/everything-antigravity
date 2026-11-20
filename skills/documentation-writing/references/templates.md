# Documentation Templates

Companion to the `documentation-writing` skill. Replace every `<PLACEHOLDER>`;
delete sections that would be empty rather than leaving stubs.

## README

````markdown
# <project-name>

<One sentence: what it is and who it is for.>

## Why

- <The problem it solves, in the reader's words.>
- <What is different about this approach.>

## Quickstart

Prerequisites: <runtime> <min version>, <tool> <min version>.

```bash
git clone https://github.com/<org>/<repo>.git
cd <repo>
<install command>
<run command>
```

PowerShell: <only the lines that differ>.

Expected output:

```text
<real output captured from a clean run>
```

## Usage

### <Most common task>

```bash
<command or code that runs exactly as shown>
```

### <Second most common task>

...

## Configuration

| Name | Default | Required | Description |
| :--- | :--- | :--- | :--- |
| `<ENV_VAR>` | `<default>` | yes/no | <what it controls; units> |

## Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `<exact error message>` | <cause> | <command or change> |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run the tests with `<test command>`.

## License

<License name>. See [LICENSE](LICENSE).
````

## How-to guide

````markdown
# <Verb> <object> (for example: Rotate API keys)

<One sentence: what you will achieve and when you need this.>

**Before you start:** <prerequisites, permissions, versions>.

1. <Imperative step.>

   ```bash
   <command>
   ```

2. <Imperative step with the expected result.>

## Verify

<How the reader confirms it worked: a command and its expected output.>

## Related

- Reference: <link>
- Explanation: <link>
````

## Architecture decision record

```markdown
# <NNNN>. <Decision as a short noun phrase>

- Status: Proposed | Accepted | Superseded by [<NNNN>](<NNNN>-<slug>.md)
- Date: <YYYY-MM-DD>
- Deciders: <names or team>

## Context

<The forces at play: requirements, constraints, what is true today. Neutral, factual.>

## Options considered

1. <Option A>: <pros> / <cons>
2. <Option B>: <pros> / <cons>
3. <Do nothing>: <pros> / <cons>

## Decision

We will <decision>, because <the deciding reasons>.

## Consequences

- Positive: <what gets easier>
- Negative: <what gets harder, new risks, costs>
- Follow-ups: <work this decision creates>
```

Number ADRs sequentially and never reuse a number. To change a decision, write a
new ADR, set the old one's status to `Superseded by`, and link both ways.

## CHANGELOG (Keep a Changelog + SemVer)

```markdown
# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- <User-visible capability, in user terms.> (#<PR>)

### Fixed
- <Bug as the user experienced it.> (#<PR>)

## [1.4.0] - 2026-11-20

### Changed
- **Breaking:** <what changed>. Migration: <exact steps>. (#<PR>)

### Security
- <Vulnerability fixed, with advisory ID if public.>

[Unreleased]: https://github.com/<org>/<repo>/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/<org>/<repo>/compare/v1.3.2...v1.4.0
```

| Change | SemVer bump (1.0.0 and later) |
| :--- | :--- |
| Breaking change to public API, CLI, config or output format | MAJOR |
| New backward-compatible functionality, or a deprecation | MINOR |
| Backward-compatible bug fix | PATCH |

Before 1.0.0, anything may change; say so in the README. Tools such as
release-please, changesets and git-cliff can draft entries from Conventional
Commits; a human still edits them into user language.

## Troubleshooting entry

````markdown
### `<exact error text as printed>`

**Cause:** <one sentence>.

**Fix:**

```bash
<command>
```

If that does not help, <next diagnostic step or where to ask>.
````

## Docs CI job

```yaml
docs:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v4          # pin to a full SHA
      with:
        persist-credentials: false
    - uses: actions/setup-python@v5      # pin to a full SHA
      with:
        python-version: "3.13"
        cache: pip
    - run: pip install -r docs/requirements.txt
    - run: mkdocs build --strict
    - run: npx --yes markdownlint-cli2 "**/*.md" "#node_modules"
    # Install a pinned lychee release as its README describes, then:
    - run: lychee --no-progress "**/*.md"
```

Pin every action and tool version; see `ci-cd-github-actions`.

## PR template lines

```markdown
- [ ] Docs updated for any change to public behaviour, config, CLI flags or output
- [ ] CHANGELOG entry added under [Unreleased] (or "no user-visible change")
- [ ] New or changed commands in docs were run and their output pasted from the run
```
