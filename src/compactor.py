"""
Context & Token Compactor for Antigravity & Agent Harnesses.
Optimizes prompt context by eliminating conversational fluff, stripping ANSI sequences,
deduplicating trace logs, and extracting key architectural facts.
"""

import re
from typing import Dict, Any, List


class ContextCompactor:
    """Intelligently compacts conversation histories and execution traces."""

    ANSI_ESCAPE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")

    def __init__(self, target_ratio: float = 0.5):
        self.target_ratio = target_ratio

    def strip_ansi(self, text: str) -> str:
        """Removes terminal escape color codes."""
        return self.ANSI_ESCAPE.sub("", text)

    def deduplicate_lines(self, text: str) -> str:
        """Collapses consecutive identical lines often generated in build logs."""
        lines = text.splitlines()
        if not lines:
            return ""

        condensed = []
        prev = None
        repeat_count = 0

        for line in lines:
            cleaned = line.strip()
            if cleaned == prev:
                repeat_count += 1
            else:
                if repeat_count > 1:
                    condensed.append(f"  ... [repeated {repeat_count} times] ...")
                repeat_count = 1
                prev = cleaned
                condensed.append(line)

        if repeat_count > 1:
            condensed.append(f"  ... [repeated {repeat_count} times] ...")

        return "\n".join(condensed)

    def extract_key_facts(self, text: str) -> List[str]:
        """Extracts critical file paths, error codes, URLs, and git commits."""
        facts = []
        # Paths
        paths = set(re.findall(r"(?:/[a-zA-Z0-9_\.\-]+)+", text))
        for p in sorted(paths):
            if len(p) > 3 and not p.endswith("/"):
                facts.append(f"path: {p}")

        # Git hashes
        commits = set(re.findall(r"\b[0-9a-f]{7,40}\b", text))
        for c in sorted(commits):
            facts.append(f"hash: {c}")

        # HTTP URLs
        urls = set(re.findall(r"https?://[^\s]+", text))
        for u in sorted(urls):
            facts.append(f"url: {u}")

        return facts

    def compact(self, text: str) -> Dict[str, Any]:
        """Applies compaction pipeline and returns metrics."""
        original_length = len(text)
        if original_length == 0:
            return {
                "original_chars": 0,
                "compacted_chars": 0,
                "reduction_percent": 0.0,
                "compacted_text": ""
            }

        # Step 1: Strip ANSI codes
        cleaned = self.strip_ansi(text)

        # Step 2: Deduplicate repeated log lines
        deduped = self.deduplicate_lines(cleaned)

        # Step 3: Normalize excessive empty newlines
        normalized = re.sub(r"\n{3,}", "\n\n", deduped).strip()

        compacted_length = len(normalized)
        reduction = max(0.0, round((1.0 - (compacted_length / original_length)) * 100, 2))

        return {
            "original_chars": original_length,
            "compacted_chars": compacted_length,
            "reduction_percent": reduction,
            "compacted_text": normalized
        }
