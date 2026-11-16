#!/usr/bin/env bash
set -e

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  TARGET_DIR="$(cd -P "$(dirname "$SOURCE")" >/dev/null 2>&1 && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$TARGET_DIR/$SOURCE"
done
DIR="$(cd -P "$(dirname "$SOURCE")/.." >/dev/null 2>&1 && pwd)"

export PYTHONPATH="$DIR:$PYTHONPATH"
python3 "$DIR/src/cli.py" "$@"

