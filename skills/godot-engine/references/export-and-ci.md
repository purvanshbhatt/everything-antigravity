# Godot export, tests and CI

Command-line flags change between minor versions. Run `godot --help` with the
project's exact editor build before scripting anything below.

## Editor binary

| OS | Typical invocation |
| :--- | :--- |
| Windows | `Godot_v4.x-stable_win64_console.exe` (console build prints to the terminal) |
| macOS | `/Applications/Godot.app/Contents/MacOS/Godot` |
| Linux | `godot` or the downloaded `Godot_v4.x-stable_linux.x86_64` |

Set `GODOT_BIN` to the full path and call it through the variable in scripts
(`& $env:GODOT_BIN ...` in PowerShell, `"$GODOT_BIN" ...` in bash).

## Import before headless runs

A fresh clone has no `.godot/` import cache. Import once before tests or
export: recent 4.x builds accept `--import`; older builds use
`--editor --quit`. Check `godot --help`.

```bash
godot --headless --path . --import
```

## Export

```bash
godot --headless --path . --export-release "Windows Desktop" build/windows/game.exe
godot --headless --path . --export-release "Linux" build/linux/game.x86_64
godot --headless --path . --export-debug "Web" build/web/index.html
godot --headless --path . --export-pack "Linux" build/patch.pck
```

- The preset name must match `export_presets.cfg` exactly (quote it).
- Export templates must match the editor version exactly. Install them via
  Editor > Manage Export Templates, or in CI extract the official
  `export_templates.tpz` into the per-user templates folder named after the
  version (for example `4.x.stable`); check the docs for the folder location.
- Create the output directory first; the exporter does not always create it.
- Web: threaded web exports need cross-origin isolation headers (COOP/COEP)
  on the host; recent 4.x versions also offer single-threaded web exports.
  Check the current web export docs before choosing.
- Signing secrets (Android keystore passwords, Windows code-signing, Apple
  notarization) stay out of git. Recent 4.x versions keep sensitive export
  values out of `export_presets.cfg`, and Android signing can be supplied by
  environment variables; verify the variable names in the Android export docs.

## GUT (Godot Unit Test)

```gdscript
extends GutTest

func test_damage_reduces_health() -> void:
	var health := HealthComponent.new()
	add_child_autofree(health)          # runs _ready(), freed after the test
	health.take_damage(3)
	assert_eq(health.current, health.max_health - 3)

func test_depleted_emits_once() -> void:
	var health := HealthComponent.new()
	add_child_autofree(health)
	watch_signals(health)
	health.take_damage(999)
	health.take_damage(1)
	assert_signal_emit_count(health, "depleted", 1)
```

Headless run (GUT 9.x for Godot 4; verify options in the GUT docs):

```bash
godot --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://test -ginclude_subdirs -gexit
```

## gdUnit4

gdUnit4 ships runner scripts inside the addon and reads the Godot binary from
`GODOT_BIN` (verify in the gdUnit4 docs for your addon version):

```bash
./addons/gdUnit4/runtest.sh -a res://test         # Linux/macOS
```

```powershell
$env:GODOT_BIN = "C:\tools\godot\Godot_v4.x-stable_win64_console.exe"
.\addons\gdUnit4\runtest.cmd -a res://test        # Windows
```

## CI outline (any provider)

1. Check out the repo (with Git LFS if large assets use it).
2. Download the exact Godot version and, for export jobs, its templates. Cache both.
3. `--import`, then run tests headlessly; fail the job on a non-zero exit.
4. Export each preset into `build/<platform>/`; upload as artifacts.
5. Publishing to stores or itch.io is a separate, manually approved job.

Community setup actions for GitHub Actions exist; pin them by commit SHA and
check they are maintained. See `ci-cd-github-actions` for workflow hardening.

## .gitignore essentials

```text
.godot/
*.tmp
build/
export_credentials.cfg
```

Commit `project.godot`, `export_presets.cfg`, `*.import` files and `addons/`
(unless the team vendors addons another way).
