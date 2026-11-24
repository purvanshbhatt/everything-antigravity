---
name: regex-text-processing
disable-model-invocation: true
description: >-
  Writes correct, safe regular expressions and text pipelines: engine
  differences (PCRE2, JavaScript, Python, RE2/Go/Rust, POSIX), ReDoS
  avoidance, ripgrep, sed, awk, jq, yq, Miller and PowerShell equivalents,
  test-first patterns, preview-then-replace edits, and streaming large files.
  Use when searching or rewriting text across many files, parsing logs, JSON
  or YAML on the command line, or debugging a regex that misbehaves.
---

# Regex and Text Processing

Pick the right tool for the data's structure, know which regex engine runs
your pattern, test it against positive and negative examples, and always
preview a bulk change before writing it. Most text-processing disasters are an
unescaped dot, a greedy `.*`, or an in-place edit nobody previewed.

## When to use

- Searching or rewriting across a codebase, logs or data files.
- Extracting fields from logs, JSON, NDJSON, YAML or CSV in a shell pipeline.
- A regex matches too much, too little, or hangs on some inputs.
- Processing files too large to open in an editor.

## When not to use

- Renames and refactors with semantic meaning (symbols, imports): use `safe-refactor` and language tooling.
- Analytical queries over CSV or Parquet: use `duckdb-analytics`.
- Extracting structure from free-form prose: use `structured-extraction`.
- Writing full shell scripts: use `bash-scripting` or `powershell-scripting`.

## Workflow

1. **Choose the tool by data shape.** JSON → `jq`; YAML → `yq`; CSV → Miller (`mlr`), DuckDB or a CSV library; source code search → `grep_search` (Antigravity) or `rg`; line-oriented logs → `rg`, `awk`, `sed`. Regex over JSON, YAML, HTML or CSV breaks on nesting, quoting and escaping.

   **Check:** Any regex in the plan targets genuinely line- or token-oriented text.

2. **Write examples first.** List 3-5 strings that must match and 3-5 that must not (edge cases: empty, unicode, the near-miss). Anchor (`^...$` or `\b`) unless substring matching is intended. Escape literal metacharacters `. * + ? ( ) [ ] { } | \ ^ $`.

   **Check:** The pattern passes every example in the target language, for example a quick Python one-liner or a unit test.

3. **Confirm the engine.** Features differ (table below). `rg` uses Rust's regex engine (no lookaround or backreferences) unless you pass `-P` for PCRE2. Python `\d` matches all Unicode digits in `str` patterns; use `[0-9]` or `re.ASCII` when you mean ASCII.

   **Check:** Every construct used is supported by the engine that will run it.

4. **Count and preview before replacing.**

   ```bash
   rg -c 'old_api\(' --type ts                    # matches per file
   rg -n 'old_api\((\w+)\)' -r 'new_api($1)' src  # preview only: -r never writes files
   ```

   **Check:** Match count and preview lines are exactly the intended set.

5. **Replace safely.** Start from a clean git tree. For a handful of files use `replace_file_content`. For many, use a portable in-place editor, then review:

   ```bash
   rg -l 'old_api\(' src | xargs perl -pi -e 's/old_api\((\w+)\)/new_api($1)/g'
   git diff --stat && git diff
   ```

   GNU `sed -i 's/a/b/g' f` and BSD/macOS `sed -i '' 's/a/b/g' f` differ; `perl -pi -e` behaves the same on both. PowerShell:

   ```powershell
   Get-ChildItem src -Recurse -Filter *.ts | ForEach-Object {
     $t = Get-Content $_.FullName -Raw
     $n = $t -replace 'old_api\((\w+)\)', 'new_api($1)'
     if ($n -ne $t) { Set-Content $_.FullName $n -NoNewline }
   }
   ```

   **Check:** `git diff` shows only intended hunks; tests and type-check pass.

6. **Stream large files.** Never load gigabytes into memory or an editor. `rg` and `awk` stream; `rg -z` searches gzip files; `jq -c` processes NDJSON line by line; avoid `jq -s` (slurps everything). In PowerShell, use `switch -Regex -File big.log { 'ERROR' { $_ } }` or `Get-Content -ReadCount 1000` instead of `Get-Content -Raw`. Write results to a new file, never over the input.

   **Check:** Memory stays flat (watch the process) and output goes to a separate file.

## Engine differences

| Feature | PCRE2 / Perl | JavaScript | Python `re` | RE2 / Go / Rust | POSIX ERE (`grep -E`, `awk`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Lookahead / lookbehind | Yes (lookbehind fixed width) | Yes (variable lookbehind) | Yes (lookbehind fixed width) | No | No |
| Backreferences `\1` | Yes | Yes | Yes | No | Not in the standard |
| Named group | `(?<n>...)` | `(?<n>...)` | `(?P<n>...)` | `(?P<n>...)` | No |
| Lazy `*?` | Yes | Yes | Yes | Yes | No |
| Linear-time guarantee | No | No | No | Yes | Implementation-dependent |

## Command recipes

| Task | Bash | PowerShell |
| :--- | :--- | :--- |
| Search recursively | `rg -n 'TODO\(\w+\)'` | `Get-ChildItem src -Recurse -File \| Select-String 'TODO\(\w+\)'` |
| Count by key | `awk '{c[$9]++} END {for (k in c) print k, c[k]}' access.log` | `Get-Content access.log \| ForEach-Object { ($_ -split ' ')[8] } \| Group-Object \| Sort-Object Count` |
| JSON filter | `jq -r '.items[] \| select(.status=="failed") \| .id' r.json` | `(Get-Content r.json -Raw \| ConvertFrom-Json).items \| Where-Object status -eq 'failed'` |
| NDJSON errors | `jq -c 'select(.level=="error")' app.ndjson` | `Get-Content app.ndjson \| ConvertFrom-Json \| Where-Object level -eq 'error'` |
| YAML edit | `yq -i '.version = "1.4.0"' Chart.yaml` | same `yq` binary |
| CSV aggregate | `mlr --icsv --opprint stats1 -a sum -f amount -g user data.csv` | `Import-Csv data.csv \| Group-Object user` |

Two different tools are called `yq`: the Go one (mikefarah, syntax above) and a Python jq wrapper. Check `yq --version`. Pass shell values into jq with `--arg id "$ID"`, never by string interpolation.

## ReDoS and untrusted input

Catastrophic backtracking comes from nested or overlapping quantifiers:
`(a+)+$`, `(.*,)*x`, `(a|aa)+`. On a 30-character near-miss these can take
seconds to years. For patterns or inputs from users: use a linear-time engine
(RE2, Go, Rust), set a timeout where supported (.NET `Regex` match timeout),
cap input length, and escape user text before embedding it (`re.escape` in
Python, `regexp.QuoteMeta` in Go, a tested escape helper in JavaScript).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Parse JSON, HTML or CSV with regex | `jq`, a DOM parser, a CSV library | Nesting, quoting and escaping defeat regex |
| `sed -i` across the repo without a preview | Count, preview with `rg -r`, then edit on a clean tree | Unreviewed bulk edits corrupt files silently |
| Unanchored `.*` in the middle of a pattern | Negated classes like `[^"]*` and anchors | Greedy dots overmatch and backtrack |
| Build a regex from user input unescaped | Escape it, or use a literal search (`rg -F`) | Injection and ReDoS |
| `Get-Content -Raw` or `jq -s` on huge files | Stream line by line | Memory blowups and crashes |
| Assume `\d`, `\w` mean ASCII | Use explicit classes or ASCII flags | Unicode digits and letters slip through |

## Verification checklist

- [ ] Tool matches data shape; no regex over structured formats.
- [ ] Pattern passes listed positive and negative examples in the target engine.
- [ ] Bulk replacements were counted and previewed, then reviewed in `git diff`.
- [ ] Patterns exposed to untrusted input are linear-time or bounded.
- [ ] Large files were streamed and outputs written to new files.

## Related

- Workflows: `/refactor-clean`.
- Knowledge: `bash-scripting`, `powershell-scripting`, `duckdb-analytics`, `safe-refactor`, `structured-extraction`, `context-compaction`.
- Agents: `codebase-explorer`.
