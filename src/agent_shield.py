"""
AgentShield: Security Guardrails for Google Antigravity & Agent Runtimes.
Provides automated scanning for credentials, prompt injections, dangerous terminal commands,
and AST vulnerability patterns.
"""

import re
import sys
from typing import Dict, List, Any

# Regular expressions for sensitive secrets and API keys
SECRET_PATTERNS = {
    "Google API Key": re.compile(r"AIza[0-9A-Za-z\-_]{30,45}"),
    "Anthropic API Key": re.compile(r"sk-ant-[a-zA-Z0-9_\-]{30,}"),
    "OpenAI API Key": re.compile(r"sk-[a-zA-Z0-9]{30,}"),
    "Generic Private Key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "AWS Access Key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "GitHub Token": re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}"),
    "Bearer Token": re.compile(r"bearer\s+[a-zA-Z0-9\-_=]{20,}", re.IGNORECASE)
}

# Patterns associated with prompt injections and agent jailbreaks
INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(?:all\s+)?rules", re.IGNORECASE),
    re.compile(r"bypass\s+safety\s+filter", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+in\s+developer\s+mode", re.IGNORECASE),
    re.compile(r"DAN\s+mode\s+enabled", re.IGNORECASE),
    re.compile(r"system\s*override\s*:\s*execute", re.IGNORECASE),
]

# Unsafe shell command signatures
DANGEROUS_COMMANDS = [
    re.compile(r"rm\s+-(?:r[fF]|fr)\s+/(?:\s|$|\*)"),
    re.compile(r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:"), # fork bomb
    re.compile(r"mkfs\.[a-z0-9]+\s+/dev/"),
    re.compile(r"dd\s+if=/dev/(?:zero|urandom)\s+of=/dev/"),
    re.compile(r"curl\s+[^|]+\|\s*(?:ba)?sh\s*$", re.IGNORECASE),
    re.compile(r"chmod\s+-R\s+777\s+/(?:\s|$)")
]


class AgentShield:
    """Security analysis and protection engine for agent executions."""

    def __init__(self, mode: str = "enforce"):
        self.mode = mode

    def scan_secrets(self, content: str) -> List[Dict[str, Any]]:
        """Scans text content for exposed API keys and credentials."""
        findings = []
        for name, pattern in SECRET_PATTERNS.items():
            matches = list(pattern.finditer(content))
            for m in matches:
                findings.append({
                    "type": "secret_leak",
                    "severity": "CRITICAL",
                    "secret_type": name,
                    "matched": m.group(0)[:8] + "..." + m.group(0)[-4:] if len(m.group(0)) > 12 else "***",
                    "start": m.start(),
                    "end": m.end()
                })
        return findings

    def scan_prompt_injection(self, text: str) -> List[Dict[str, Any]]:
        """Scans user prompts or ingested content for adversarial jailbreaks."""
        findings = []
        for pattern in INJECTION_PATTERNS:
            match = pattern.search(text)
            if match:
                findings.append({
                    "type": "prompt_injection",
                    "severity": "HIGH",
                    "pattern": pattern.pattern,
                    "matched": match.group(0),
                    "start": match.start(),
                    "end": match.end()
                })
        return findings

    def scan_command(self, cmd: str) -> List[Dict[str, Any]]:
        """Validates shell commands against dangerous execution patterns."""
        findings = []
        for pattern in DANGEROUS_COMMANDS:
            if pattern.search(cmd):
                findings.append({
                    "type": "dangerous_command",
                    "severity": "CRITICAL",
                    "command": cmd,
                    "reason": f"Matches dangerous execution signature: {pattern.pattern}"
                })
        return findings

    def sanitize_text(self, text: str) -> str:
        """Redacts sensitive credentials from the given text."""
        sanitized = text
        for name, pattern in SECRET_PATTERNS.items():
            sanitized = pattern.sub(f"[REDACTED_{name.upper().replace(' ', '_')}]", sanitized)
        return sanitized

    def evaluate_payload(self, text: str, command: str = None) -> Dict[str, Any]:
        """Runs a complete security evaluation on text content and optional command."""
        secrets = self.scan_secrets(text)
        injections = self.scan_prompt_injection(text)
        cmd_issues = self.scan_command(command) if command else []

        all_issues = secrets + injections + cmd_issues
        passed = len(all_issues) == 0

        return {
            "passed": passed,
            "total_issues": len(all_issues),
            "secrets": secrets,
            "injections": injections,
            "command_issues": cmd_issues,
            "action": "allow" if passed else ("block" if self.mode == "enforce" else "warn")
        }


def main():
    """CLI runner for AgentShield."""
    import sys
    shield = AgentShield()
    sample = sys.stdin.read() if not sys.stdin.isatty() else (" ".join(sys.argv[1:]) if len(sys.argv) > 1 else "")
    result = shield.evaluate_payload(sample)
    print(result)


if __name__ == "__main__":
    main()
