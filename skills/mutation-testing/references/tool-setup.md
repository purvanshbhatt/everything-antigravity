# Mutation testing: tool setup

Minimal, working setups for each tool. Pin versions in the project's own manifest and check the tool's docs for the current release; options change between major versions.

## Stryker (JavaScript and TypeScript)

```bash
npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner   # or jest-runner, mocha-runner
npx stryker init                                                # interactive; writes a config file
```

`stryker.config.json`:

```json
{
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "mutate": ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/*.d.ts"],
  "incremental": true,
  "thresholds": { "high": 80, "low": 60, "break": 50 },
  "reporters": ["html", "clear-text", "progress"]
}
```

- `--mutate` accepts a comma-separated list and line ranges such as `src/price.ts:20-45`.
- `incremental` stores results in `reports/stryker-incremental.json` and re-tests only what changed. Cache that file in CI between runs on the same branch.
- Suppress one mutant with a reason: `// Stryker disable next-line all: log text only`.
- The HTML report is `reports/mutation/mutation.html`; open it in the browser subagent or a local browser to read survivors in context.

## Stryker.NET (C#)

```bash
dotnet tool install -g dotnet-stryker
dotnet stryker --project Billing.csproj
```

Use its `--since` option to mutate only code changed against a branch; check `dotnet stryker --help` for the exact syntax of your version.

## mutmut (Python)

```bash
pip install mutmut
mutmut run
mutmut results          # survivors and their ids
mutmut show <id>        # the diff for one mutant
```

`pyproject.toml` (mutmut 3):

```toml
[tool.mutmut]
paths_to_mutate = ["src/billing/"]
```

- mutmut 2 and mutmut 3 differ in configuration and commands; read `mutmut --help` for the installed version.
- mutmut 3 relies on process forking, so on Windows run it under WSL.
- Suppress a line with `# pragma: no mutate` and a comment that says why.
- Alternatives: cosmic-ray for large codebases that need distributed runs.

## PIT (Java and Kotlin on the JVM)

Maven:

```xml
<plugin>
  <groupId>org.pitest</groupId>
  <artifactId>pitest-maven</artifactId>
  <version>CHECK_CURRENT</version>
  <dependencies>
    <dependency>
      <groupId>org.pitest</groupId>
      <artifactId>pitest-junit5-plugin</artifactId>
      <version>CHECK_CURRENT</version>
    </dependency>
  </dependencies>
  <configuration>
    <targetClasses><param>com.example.billing.*</param></targetClasses>
    <targetTests><param>com.example.billing.*</param></targetTests>
    <mutationThreshold>60</mutationThreshold>
    <timestampedReports>false</timestampedReports>
  </configuration>
</plugin>
```

```bash
mvn test-compile org.pitest:pitest-maven:mutationCoverage
mvn -DwithHistory test-compile org.pitest:pitest-maven:mutationCoverage     # incremental
mvn test-compile org.pitest:pitest-maven:scmMutationCoverage               # changed files; needs <scm> in the POM
```

Gradle uses the `info.solidsoft.pitest` plugin and the `pitest` task, configured in a `pitest { }` block with `targetClasses`, `threads` and `junit5PluginVersion`. Reports are written to `target/pit-reports/` (Maven) or `build/reports/pitest/` (Gradle).

- JUnit 5 projects need the JUnit 5 plugin dependency or PIT finds no tests.
- Logging calls are skipped by default through `avoidCallsTo`; add your own logging or metrics packages there.

## cargo-mutants (Rust)

```bash
cargo install --locked cargo-mutants
cargo mutants --list                    # see what would be mutated
cargo mutants -f src/billing.rs         # one file
git diff origin/main > pr.diff
cargo mutants --in-diff pr.diff         # only code touched by the diff
```

- Results: `mutants.out/missed.txt`, `caught.txt`, `timeout.txt` and `unviable.txt`.
- Split big runs across CI jobs with `--shard k/n`, and run tests in parallel with `-j`.
- Skip a function with `#[mutants::skip]` (add the small `mutants` crate as a dependency) or exclude patterns in `.cargo/mutants.toml`.

## Go

- gremlins: `gremlins unleash ./internal/billing` runs mutants for one package.
- go-mutesting: older, still used; scope it to a package directory.
- Both are less mature than the tools above; keep runs to one package and read survivors by hand.

## CI shape

| Trigger | Scope | Gate |
| :--- | :--- | :--- |
| Pull request | Changed files or incremental mode | Break threshold on changed code |
| Nightly or weekly | Whole project, sharded | Report only; ratchet the PR threshold when the score rises |
| Before a big refactor | The modules being refactored | Survivors reviewed before refactoring starts |
