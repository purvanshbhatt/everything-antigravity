# /checkpoint - State Preservation & Session Compaction

## Purpose
Saves the current project state, commits staged progress, generates a concise restore snapshot, and compacts the conversation history.

## Steps
1. Run `git status` to verify modified, added, or untracked files.
2. Commit changes with a concise Conventional Commit message.
3. Record current architecture decisions and active next steps.
4. Execute `eag compact` to reset token accumulation and prime the session for subsequent deep focus tasks.
