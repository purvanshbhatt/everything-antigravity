# Contributing to Everything Antigravity (EAG)

We welcome contributions to Everything Antigravity!

## Guidelines for Adding Skills
1. Create a subdirectory under `skills/<skill-name>/`.
2. Provide a `SKILL.md` file starting with valid YAML frontmatter:
   ```yaml
   ---
   name: your-skill-name
   description: "One clear sentence describing when and how to use this skill."
   ---
   ```
3. Document core workflows, patterns, and outputs clearly in markdown.
4. Run `python3 src/cli.py verify` to ensure the new skill passes schema verification.
5. Add tests in `tests/` if your skill includes runnable code or scripts.

## Submitting Pull Requests
- Keep changes modular and focused.
- Ensure all tests pass (`pytest tests/`).
- Do not weaken or delete existing tests to pass validation.
