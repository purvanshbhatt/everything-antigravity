# Engineering Rules & Standards

1. **Test-Driven Rigor**: Write tests before implementing new features or bugfixes. Ensure failing tests fail for the right reason.
2. **Never Weaken Tests to Pass**: Existing failing tests signal real defects. Solve the root bug rather than deleting assertions or skipping tests.
3. **Focused Atomic Diffs**: Keep changes focused on the task at hand. Avoid unnecessary refactoring or style churning across unrelated files.
4. **Defensive Error Handling**: Always catch specific exceptions, provide contextual error messages, and log cleanly without polluting stdout.
