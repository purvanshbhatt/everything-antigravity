# Troubleshooting Guide

Common issues and solutions when deploying or developing with Everything Antigravity (EAG).

## 1. Skill Not Detected by Antigravity
- **Symptom**: `agy` does not list newly added EAG skills.
- **Solution**:
  1. Ensure you ran `./install.sh` to symlink skills into `~/.gemini/antigravity/skills/`.
  2. Verify that `SKILL.md` contains valid YAML frontmatter delimiters (`---`) and both `name` and `description` keys.
  3. Run `python3 src/cli.py verify` to check for syntax or schema errors.

## 2. AgentShield Blocks Valid Code
- **Symptom**: `AgentShield` raises a false positive on a test token.
- **Solution**:
  - Test fixtures containing synthetic tokens should use standard test placeholders like `AIzaSyD-TEST-MOCK-KEY-000000000000000`.
  - Alternatively, pass `mode="warn"` to `AgentShield` for non-blocking audits.

## 3. High Memory or Token Budget Warning
- **Symptom**: Session context grows too large during deep investigation.
- **Solution**:
  - Delegate long-running tasks to subagents.
  - Run `python3 src/cli.py compact --file trace.log` to collapse duplicate logs and strip ANSI escape sequences.
