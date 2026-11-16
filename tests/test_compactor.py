"""
Unit tests for ContextCompactor.
"""

import sys
from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.compactor import ContextCompactor


@pytest.fixture
def compactor():
    return ContextCompactor()


def test_empty_string(compactor):
    result = compactor.compact("")
    assert result["original_chars"] == 0
    assert result["compacted_chars"] == 0
    assert result["reduction_percent"] == 0.0


def test_strip_ansi_sequences(compactor):
    ansi_text = "\x1b[31mError:\x1b[0m \x1b[1mFile not found\x1b[0m"
    cleaned = compactor.strip_ansi(ansi_text)
    assert "\x1b" not in cleaned
    assert cleaned == "Error: File not found"


def test_deduplicate_lines(compactor):
    repetitive = "Building...\n" + ("Polling server status...\n" * 10) + "Build succeeded."
    deduped = compactor.deduplicate_lines(repetitive)
    assert "[repeated 10 times]" in deduped
    assert deduped.count("Polling server status...") == 1


def test_extract_facts(compactor):
    log = "Build failed at /home/user/project/src/index.ts commit 7f8a9b0c1d2e3f4 url https://antigravity.google/docs"
    facts = compactor.extract_key_facts(log)
    assert any("path: /home/user/project/src/index.ts" in f for f in facts)
    assert any("hash: 7f8a9b0c1d2e3f4" in f for f in facts)
    assert any("url: https://antigravity.google/docs" in f for f in facts)
