#!/usr/bin/env bash
# Everything Antigravity (EAG) Universal Installer
set -e

echo "========================================================="
echo " 🚀 Installing Everything Antigravity (EAG)"
echo "========================================================="

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$DIR/skills"
RULES_SRC="$DIR/rules"
COMMANDS_SRC="$DIR/commands"
PLUGIN_SRC="$DIR/plugins/everything-antigravity"
LOCAL_BIN="$HOME/.local/bin"

# Target directories
ANTIGRAVITY_SKILLS="$HOME/.gemini/antigravity/skills"
ANTIGRAVITY_CONFIG_SKILLS="$HOME/.gemini/config/skills"
AGENTS_SKILLS="$HOME/.agents/skills"
AGENTS_RULES="$HOME/.agents/rules"
CONFIG_RULES="$HOME/.gemini/config/rules"
AGENTS_WORKFLOWS="$HOME/.agents/workflows"
ANTIGRAVITY_PLUGINS="$HOME/.gemini/config/plugins"
CLAUDE_SKILLS="$HOME/.claude/skills"
CURSOR_SKILLS="$HOME/.cursor/skills"

# 1. Ensure directories exist
mkdir -p "$ANTIGRAVITY_SKILLS" "$ANTIGRAVITY_CONFIG_SKILLS" "$AGENTS_SKILLS" "$AGENTS_RULES" "$CONFIG_RULES" "$AGENTS_WORKFLOWS" "$ANTIGRAVITY_PLUGINS" "$LOCAL_BIN"

# 2. Link EAG CLI binary
echo "[1/5] Installing 'eag' CLI to $LOCAL_BIN/eag..."
chmod +x "$DIR/bin/eag.sh" "$DIR/bin/eag.js"
ln -sf "$DIR/bin/eag.sh" "$LOCAL_BIN/eag"

# 3. Link Skills to Antigravity and Agent environments
echo "[2/5] Linking 30 skills to Antigravity and .agents..."
if [ -d "$SKILLS_SRC" ]; then
  for sdir in "$SKILLS_SRC"/*; do
    if [ -d "$sdir" ]; then
      sname=$(basename "$sdir")
      ln -sfn "$sdir" "$ANTIGRAVITY_SKILLS/$sname"
      ln -sfn "$sdir" "$ANTIGRAVITY_CONFIG_SKILLS/$sname"
      ln -sfn "$sdir" "$AGENTS_SKILLS/$sname"
    fi
  done
fi

# 4. Link Rules
echo "[3/5] Linking rules to Antigravity and .agents..."
if [ -d "$RULES_SRC" ]; then
  for rfile in "$RULES_SRC"/*.md; do
    if [ -f "$rfile" ]; then
      rname=$(basename "$rfile")
      ln -sfn "$rfile" "$AGENTS_RULES/$rname"
      ln -sfn "$rfile" "$CONFIG_RULES/$rname"
    fi
  done
fi

# 5. Link Commands / Workflows
echo "[4/5] Linking commands/workflows to .agents/workflows..."
if [ -d "$COMMANDS_SRC" ]; then
  for cfile in "$COMMANDS_SRC"/*.md; do
    if [ -f "$cfile" ]; then
      cname=$(basename "$cfile")
      ln -sfn "$cfile" "$AGENTS_WORKFLOWS/$cname"
    fi
  done
fi

# 6. Link Plugin
echo "[5/5] Linking plugin to Antigravity plugins..."
if [ -d "$PLUGIN_SRC" ]; then
  ln -sfn "$PLUGIN_SRC" "$ANTIGRAVITY_PLUGINS/everything-antigravity"
fi

# Optional cross-compatibility with Claude Code and Cursor
if [ -d "$HOME/.claude" ]; then
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
echo " Status: eag status"
echo " Verify: eag verify"
echo "========================================================="
