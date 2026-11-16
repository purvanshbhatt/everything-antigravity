#!/usr/bin/env bash
# Everything Antigravity (EAG) Universal Installer
set -e

echo "========================================================="
echo " 🚀 Installing Everything Antigravity (EAG)"
echo "========================================================="

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$DIR/skills"
PLUGIN_SRC="$DIR/plugins/everything-antigravity"
LOCAL_BIN="$HOME/.local/bin"

# Target directories
ANTIGRAVITY_SKILLS="$HOME/.gemini/antigravity/skills"
ANTIGRAVITY_CONFIG_SKILLS="$HOME/.gemini/config/skills"
ANTIGRAVITY_PLUGINS="$HOME/.gemini/config/plugins"
CLAUDE_SKILLS="$HOME/.claude/skills"
CURSOR_SKILLS="$HOME/.cursor/skills"

# 1. Ensure directories exist
mkdir -p "$ANTIGRAVITY_SKILLS" "$ANTIGRAVITY_CONFIG_SKILLS" "$ANTIGRAVITY_PLUGINS" "$LOCAL_BIN"

# 2. Link EAG CLI binary
echo "[1/4] Installing 'eag' CLI to $LOCAL_BIN/eag..."
chmod +x "$DIR/bin/eag.sh"
ln -sf "$DIR/bin/eag.sh" "$LOCAL_BIN/eag"

# 3. Link Skills to Google Antigravity
echo "[2/4] Linking skills to Antigravity ($ANTIGRAVITY_SKILLS and $ANTIGRAVITY_CONFIG_SKILLS)..."
if [ -d "$SKILLS_SRC" ]; then
  for sdir in "$SKILLS_SRC"/*; do
    if [ -d "$sdir" ]; then
      sname=$(basename "$sdir")
      ln -sfn "$sdir" "$ANTIGRAVITY_SKILLS/$sname"
      ln -sfn "$sdir" "$ANTIGRAVITY_CONFIG_SKILLS/$sname"
    fi
  done
fi

# 4. Link Plugin to Google Antigravity
echo "[3/4] Linking plugin to Antigravity plugins ($ANTIGRAVITY_PLUGINS)..."
if [ -d "$PLUGIN_SRC" ]; then
  ln -sfn "$PLUGIN_SRC" "$ANTIGRAVITY_PLUGINS/everything-antigravity"
fi

# 5. Optional cross-compatibility with Claude Code and Cursor
if [ -d "$HOME/.claude" ]; then
  echo "[4/4] Linking skills to Claude Code ($CLAUDE_SKILLS)..."
  mkdir -p "$CLAUDE_SKILLS"
  for sdir in "$SKILLS_SRC"/*; do
    if [ -d "$sdir" ]; then
      sname=$(basename "$sdir")
      ln -sfn "$sdir" "$CLAUDE_SKILLS/$sname"
    fi
  done
fi

if [ -d "$HOME/.cursor" ]; then
  mkdir -p "$CURSOR_SKILLS"
  for sdir in "$SKILLS_SRC"/*; do
    if [ -d "$sdir" ]; then
      sname=$(basename "$sdir")
      ln -sfn "$sdir" "$CURSOR_SKILLS/$sname"
    fi
  done
fi

echo "========================================================="
echo " 🎉 Everything Antigravity (EAG) installed successfully!"
echo " Test with: eag status"
echo " Verify with: eag verify"
echo "========================================================="
