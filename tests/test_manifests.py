"""
Tests for EAG JSON manifests and schemas.
"""

import json
from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent


def test_marketplace_manifest():
    mp_file = ROOT_DIR / ".antigravity" / "marketplace.json"
    assert mp_file.exists()
    data = json.loads(mp_file.read_text(encoding="utf-8"))
    assert "name" in data
    assert "plugins" in data
    assert len(data["plugins"]) > 0
    assert len(data["plugins"][0]["skills"]) >= 30


def test_plugin_manifest():
    pl_file = ROOT_DIR / "plugins" / "everything-antigravity" / "plugin.json"
    assert pl_file.exists()
    data = json.loads(pl_file.read_text(encoding="utf-8"))
    assert data["name"] == "everything-antigravity"
    assert "version" in data
    assert "description" in data


def test_package_json():
    pkg_file = ROOT_DIR / "package.json"
    assert pkg_file.exists()
    data = json.loads(pkg_file.read_text(encoding="utf-8"))
    assert data["name"] == "everything-antigravity"
    assert "scripts" in data
