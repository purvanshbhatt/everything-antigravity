"""
AgentShield: Security Guardrails for Google Antigravity & Agent Runtimes.
Provides automated scanning for credentials, prompt injections, dangerous terminal commands,
AST vulnerability patterns, and an MCP (Model Context Protocol) stdio server.
"""

import re
import sys
import json
import base64
from typing import Dict, List, Any, Optional

# Regular expressions for sensitive secrets and API keys
SECRET_PATTERNS = {
    "Google API Key": re.compile(r"AIza[0-9A-Za-z\-_]{30,45}"),
    "Anthropic API Key": re.compile(r"sk-ant-[a-zA-Z0-9_\-]{30,}"),
    "OpenAI API Key": re.compile(r"sk-(?:proj-|admin-|svcacct-)?[a-zA-Z0-9_\-]{20,}"),
    "Generic Private Key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "AWS Access Key": re.compile(r"(?:AKIA|ASIA)[0-9A-Z]{16}"),
    "GitHub Token": re.compile(r"(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}|github_pat_[A-Za-z0-9_]{50,})"),
    "Slack Token": re.compile(r"xox[baprs]-[0-9a-zA-Z]{10,48}"),
    "Hugging Face Token": re.compile(r"hf_[a-zA-Z0-9]{34,}"),
    "Bearer Token": re.compile(r"bearer\s+[a-zA-Z0-9\-_=]{20,}", re.IGNORECASE)
}

# Patterns associated with prompt injections and agent jailbreaks
INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior|above|existing)?\s*(?:instructions|prompts|rules|directives)", re.IGNORECASE),
    re.compile(r"disregard\s+(?:all\s+)?(?:previous|prior|above)?\s*(?:rules|instructions|directives)", re.IGNORECASE),
    re.compile(r"bypass\s+(?:safety|content)?\s*(?:filter|guardrail|policies)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+in\s+developer\s+mode", re.IGNORECASE),
    re.compile(r"DAN\s+mode\s+enabled", re.IGNORECASE),
    re.compile(r"system\s*override\s*:\s*execute", re.IGNORECASE),
]

# Unsafe shell command signatures
DANGEROUS_COMMANDS = [
    re.compile(r"rm\s+-(?:r[fF]|fr)\s+(?:/|/\*|~|\$HOME)(?:\s|$)"),
    re.compile(r"rm\s+.*--no-preserve-root"),
    re.compile(r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:"),  # fork bomb
    re.compile(r"mkfs\.[a-z0-9]+\s+/dev/"),
    re.compile(r"dd\s+if=/dev/(?:zero|urandom)\s+of=(?:/dev/|[a-z0-9/]+)"),
    re.compile(r"(?:curl|wget)\s+[^|]+\|\s*(?:ba|z)?sh(?:\s*|\s+-[a-zA-Z0-9]+)", re.IGNORECASE),
    re.compile(r"(?:curl|wget)\s+[^|]+\|\s*python[0-9]*(?:\s*|\s+-)", re.IGNORECASE),
    re.compile(r"chmod\s+-R\s+777\s+/(?:\s|$)")
]


def extract_base64_candidates(text: str) -> List[str]:
    """Finds candidate base64 sequences and attempts decoding."""
    candidates = set()
    for m in re.finditer(r"(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{12,}={0,2}(?=[^A-Za-z0-9+/=]|$)", text):
        candidates.add(m.group(0))
    for m in re.finditer(r"(?<![A-Za-z0-9+/])(?:[A-Za-z0-9+/]{4,}\s+)+[A-Za-z0-9+/]{2,}={0,2}(?=[^A-Za-z0-9+/=]|$)", text):
        candidates.add(m.group(0))

    decoded_strings = []
    for cand in candidates:
        clean = re.sub(r"\s+", "", cand)
        try:
            raw = base64.b64decode(clean).decode("utf-8", errors="ignore")
            if len(raw.strip()) >= 6 and any(c.isalnum() for c in raw):
                decoded_strings.append(raw)
        except Exception:
            continue
    return decoded_strings


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

        # Also inspect decoded base64 payloads
        for decoded in extract_base64_candidates(content):
            for name, pattern in SECRET_PATTERNS.items():
                if pattern.search(decoded):
                    findings.append({
                        "type": "secret_leak",
                        "severity": "CRITICAL",
                        "secret_type": f"{name} (in Base64)",
                        "matched": "[OBFUSCATED_SECRET]",
                        "start": 0,
                        "end": len(content)
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

        # Check for obfuscated base64 prompt injections
        for decoded in extract_base64_candidates(text):
            for pattern in INJECTION_PATTERNS:
                match = pattern.search(decoded)
                if match:
                    findings.append({
                        "type": "prompt_injection",
                        "severity": "CRITICAL",
                        "pattern": pattern.pattern,
                        "matched": f"Base64 decoded payload: {match.group(0)}",
                        "start": 0,
                        "end": len(text)
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

    def evaluate_payload(self, text: str, command: Optional[str] = None) -> Dict[str, Any]:
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


def run_mcp_server():
    """Runs a Model Context Protocol (MCP) JSON-RPC 2.0 stdio server."""
    shield = AgentShield(mode="enforce")

    tools = [
        {
            "name": "scan_secrets",
            "description": "Scans text content for exposed API keys and sensitive credentials.",
            "inputSchema": {
                "type": "object",
                "properties": {"content": {"type": "string", "description": "Text to scan for secrets"}},
                "required": ["content"]
            }
        },
        {
            "name": "scan_prompt_injection",
            "description": "Scans text for adversarial prompt injection, jailbreaks, or evasion attempts.",
            "inputSchema": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "Prompt or input text to inspect"}},
                "required": ["text"]
            }
        },
        {
            "name": "scan_command",
            "description": "Scans shell commands for dangerous operations (e.g. disk wiping, root deletions, fork bombs).",
            "inputSchema": {
                "type": "object",
                "properties": {"command": {"type": "string", "description": "Shell command to validate"}},
                "required": ["command"]
            }
        },
        {
            "name": "sanitize_text",
            "description": "Redacts sensitive credentials and API keys from text.",
            "inputSchema": {
                "type": "object",
                "properties": {"text": {"type": "string", "description": "Text to redact"}},
                "required": ["text"]
            }
        },
        {
            "name": "evaluate_payload",
            "description": "Performs comprehensive security inspection across text, injections, and optional command.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Input text or prompt"},
                    "command": {"type": "string", "description": "Optional shell command to validate"}
                },
                "required": ["text"]
            }
        }
    ]

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue

        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params", {})

        if method == "initialize":
            res = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "eag-guardrail-mcp", "version": "1.0.0"}
                }
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        elif method == "notifications/initialized":
            pass
        elif method == "ping":
            res = {"jsonrpc": "2.0", "id": req_id, "result": {}}
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        elif method == "tools/list":
            res = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"tools": tools}
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        elif method == "tools/call":
            tool_name = params.get("name")
            args = params.get("arguments", {})
            try:
                if tool_name == "scan_secrets":
                    out = shield.scan_secrets(args.get("content", ""))
                elif tool_name == "scan_prompt_injection":
                    out = shield.scan_prompt_injection(args.get("text", ""))
                elif tool_name == "scan_command":
                    out = shield.scan_command(args.get("command", ""))
                elif tool_name == "sanitize_text":
                    out = shield.sanitize_text(args.get("text", ""))
                elif tool_name == "evaluate_payload":
                    out = shield.evaluate_payload(args.get("text", ""), command=args.get("command"))
                else:
                    raise ValueError(f"Unknown tool: {tool_name}")

                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [
                            {"type": "text", "text": json.dumps(out, indent=2) if not isinstance(out, str) else out}
                        ]
                    }
                }
            except Exception as e:
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32603, "message": str(e)}
                }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        elif req_id is not None:
            res = {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": f"Method '{method}' not found"}
            }
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()


def main():
    """CLI and MCP runner for AgentShield."""
    if "--stdio" in sys.argv:
        run_mcp_server()
        return

    shield = AgentShield()
    sample = sys.stdin.read() if not sys.stdin.isatty() else (" ".join(sys.argv[1:]) if len(sys.argv) > 1 else "")
    result = shield.evaluate_payload(sample)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
