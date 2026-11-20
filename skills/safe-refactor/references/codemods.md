# Codemods and behaviour-equivalence checks

Always run a codemod on a clean working tree, review the dry run, then commit
the codemod output alone (no hand edits mixed in) so it can be reverted or
re-run.

## Choosing a tool

| Need | Tool |
| :--- | :--- |
| Rename or move a symbol | IDE / language server (TypeScript server, Pyright/Pylance, gopls, rust-analyzer) |
| Pattern-to-pattern rewrite, many languages | ast-grep |
| JS / TS transform with logic | jscodeshift (recast-based, preserves formatting) |
| TS transform that needs type information | ts-morph |
| Python transform preserving comments and formatting | LibCST |
| Go expression rewrite | `gofmt -r`; semantic rename with `gopls rename`; API migrations with `go fix` or `eg` |
| Java large-scale migrations | OpenRewrite recipes |

## ast-grep

```bash
# Preview
ast-grep run --pattern 'console.log($$$ARGS)' --rewrite 'logger.debug($$$ARGS)' --lang ts src
# Apply all
ast-grep run --pattern 'console.log($$$ARGS)' --rewrite 'logger.debug($$$ARGS)' --lang ts --update-all src
```

`$A` matches one node, `$$$A` matches a sequence. Put recurring rules in YAML files and run `ast-grep scan` in CI to stop the old pattern from returning.

## jscodeshift

```js
// transforms/rename-fetch-user.js
module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  return j(file.source)
    .find(j.CallExpression, { callee: { name: 'fetchUser' } })
    .forEach((p) => { p.node.callee.name = 'getUser'; })
    .toSource({ quote: 'single' });
};
```

```bash
npx jscodeshift -t transforms/rename-fetch-user.js src --extensions=ts,tsx --parser=tsx --dry --print
npx jscodeshift -t transforms/rename-fetch-user.js src --extensions=ts,tsx --parser=tsx
```

## ts-morph (type-aware)

```ts
import { Project } from 'ts-morph';

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const fn = project.getSourceFileOrThrow('src/users/api.ts').getFunctionOrThrow('fetchUser');
fn.rename('getUser');                 // updates every reference the type checker knows about
await project.save();
```

## LibCST (Python)

```bash
python -m libcst.tool initialize .                       # creates .libcst.codemod.yaml
python -m libcst.tool codemod rename.RenameCommand src/ \
  --old_name=app.users.fetch_user --new_name=app.users.get_user
```

`RenameCommand` ships with LibCST (`libcst.codemod.commands.rename`). For custom transforms subclass `VisitorBasedCodemodCommand` and run it the same way. PowerShell: put the command on one line or use a backtick for line continuation.

## Go

```bash
gofmt -r 'bytes.Compare(a, b) == 0 -> bytes.Equal(a, b)' -l .   # list files that would change
gofmt -r 'bytes.Compare(a, b) == 0 -> bytes.Equal(a, b)' -w .   # rewrite
gopls rename -w internal/users/api.go:42:6 GetUser              # file:line:column of the identifier
go vet ./... && go test ./...
```

In `gofmt -r`, single lowercase letters are wildcards matching any expression.

## Proving behaviour is unchanged

| Check | How |
| :--- | :--- |
| Tests | Full suite plus characterization tests, same results before and after |
| Public API surface | TS: API Extractor report diff; Go: `apidiff` (golang.org/x/exp/cmd/apidiff); Python: `griffe check`; JVM: japicmp |
| Outputs | Golden-file or approval tests over recorded inputs; byte-compare generated artifacts |
| Types | `tsc --noEmit`, `mypy`/`pyright`, `go vet`, `cargo check` |
| Performance | Benchmark before and after (`go test -bench`, `pytest-benchmark`, `hyperfine` for CLIs) |
| Production equivalence | Shadow run: execute old and new, return old, log mismatches; switch only at zero unexplained mismatches |

## Micro-commit rhythm

```text
refactor: extract PriceCalculator from OrderService (no behaviour change)
refactor: move PriceCalculator to pricing module (no behaviour change)
refactor: rename calc() to totalFor() via LSP (no behaviour change)
test: characterize rounding for negative discounts
```

Each commit builds and passes tests on its own, so `git bisect` and `git revert` work at single-step granularity.
