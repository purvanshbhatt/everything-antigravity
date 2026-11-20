#!/usr/bin/env bash
# Everything Antigravity installer for macOS, Linux and WSL.
# Thin wrapper around `node bin/eag.js install`; all options are passed through:
#   ./install.sh                         # Antigravity (+ Gemini CLI if detected)
#   ./install.sh --target antigravity,gemini --profile strict
#   ./install.sh --dry-run               # show the plan, change nothing
#   ./install.sh --link                  # contributors: link this checkout instead of copying
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Everything Antigravity needs Node.js 18 or newer (the hooks and the eag CLI run on Node)." >&2
  echo "Install it from https://nodejs.org or your package manager, then re-run ./install.sh" >&2
  exit 1
fi

major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$major" -lt 18 ]; then
  echo "Node.js 18+ is required (found $(node --version))." >&2
  exit 1
fi

exec node "$DIR/bin/eag.js" install "$@"
