'use strict';
/**
 * AgentShield core: dangerous-command classification, secret detection and
 * prompt-injection heuristics. Pure functions, zero dependencies, shared by the
 * Antigravity/Gemini hooks and the `eag shield` CLI.
 */

/** Commands that are never acceptable from an agent. */
const DENY_RULES = [
  { id: 'rm-root', re: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\s+--force|--force\s+--recursive)[a-z-]*\s+(\/\*?(\s|$)|~\/?\*?(\s|$)|\$HOME\/?\*?(\s|$))/i, why: 'recursive force delete of the filesystem root or home directory' },
  { id: 'rm-root-flags', re: /\brm\s+-rf\s+\/\s*--no-preserve-root/i, why: 'recursive delete of the filesystem root' },
  { id: 'mkfs', re: /\bmkfs(\.\w+)?\b/i, why: 'formats a disk partition' },
  { id: 'dd-device', re: /\bdd\b[^|;&]*\bof=\/dev\/(sd|nvme|hd|disk|mmcblk)/i, why: 'writes raw bytes over a disk device' },
  { id: 'fork-bomb', re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, why: 'fork bomb' },
  { id: 'chmod-root', re: /\bchmod\s+-R\s+0?777\s+\/(\s|$)/i, why: 'makes the whole filesystem world-writable' },
  { id: 'format-drive', re: /\bformat(\.com)?\s+[a-z]:/i, why: 'formats a Windows drive' },
  { id: 'remove-item-drive', re: /\bRemove-Item\b(?=.*-Recurse)[^|;]*\s['"]?[a-z]:\\?['"]?(\s|$)/i, why: 'recursively deletes a whole Windows drive' },
  { id: 'rd-drive', re: /\b(rd|rmdir)\s+\/s\s+\/q\s+['"]?[a-z]:\\?['"]?(\s|$)/i, why: 'recursively deletes a whole Windows drive' },
  { id: 'diskpart-clean', re: /\bdiskpart\b.*\bclean\b/i, why: 'wipes a disk' },
];

const DB_CLIENT = /\b(psql|mysql|mariadb|sqlite3|sqlcmd|mongosh|mongo|bq|cockroach|clickhouse-client|duckdb|pg_restore)\b/i;

/** Commands that need a human decision every time (force_ask). */
const ASK_RULES = [
  { id: 'git-force-push', test: (c) => /\bgit\s+push\b/.test(c) && /(\s--force(?!-with-lease)\b|\s-f\b|\s\+\S+)/.test(c), why: 'force-push rewrites remote history' },
  { id: 'git-force-lease-main', test: (c) => /\bgit\s+push\b.*--force-with-lease\b.*\b(main|master|trunk|release)\b/.test(c), why: 'force-push to a protected branch' },
  { id: 'git-reset-hard', test: (c) => /\bgit\s+reset\s+--hard\b/.test(c), why: 'discards uncommitted work' },
  { id: 'git-clean', test: (c) => /\bgit\s+clean\s+-[a-z]*f/.test(c), why: 'deletes untracked files' },
  { id: 'git-discard', test: (c) => /\bgit\s+(checkout\s+--\s+\.|restore\s+(--worktree\s+)?\.)(\s|$)/.test(c), why: 'discards local changes' },
  { id: 'no-verify', test: (c) => /\bgit\s+(commit|push|merge|rebase)\b.*\s--no-verify\b/.test(c) || /\bgit\s+commit\b.*\s-n\b/.test(c), why: 'skips repository hooks (--no-verify)' },
  { id: 'pipe-to-shell', test: (c) => /\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|]*\|\s*(sudo\s+)?(ba|z|da|k)?sh\b|\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|]*\|\s*(iex|Invoke-Expression)\b/i.test(c), why: 'executes a remote script without review' },
  { id: 'sql-destructive', test: (c) => DB_CLIENT.test(c) && /\b(DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\b|DELETE\s+FROM\s+\w+\s*(;|"|'|$))/i.test(c), why: 'destructive SQL against a database' },
  { id: 'terraform-destroy', test: (c) => /\b(terraform|tofu)\s+(destroy|apply\b.*-auto-approve)/.test(c), why: 'changes or destroys infrastructure without a reviewed plan' },
  { id: 'kubectl-delete', test: (c) => /\bkubectl\s+delete\b/.test(c), why: 'deletes Kubernetes resources' },
  { id: 'gcloud-delete', test: (c) => /\bgcloud\b.*\s(delete|remove-iam-policy-binding)\b/.test(c), why: 'deletes Google Cloud resources' },
  { id: 'cloud-bulk-delete', test: (c) => /\b(aws\s+s3\s+rm\b.*--recursive|gsutil\s+(-m\s+)?rm\s+-r|gcloud\s+storage\s+rm\s+.*--recursive)/.test(c), why: 'bulk-deletes cloud storage objects' },
  { id: 'publish', test: (c) => /\b(npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b|\bgem\s+push\b/.test(c), why: 'publishes a package publicly' },
  { id: 'docker-prune', test: (c) => /\bdocker\s+(system|volume)\s+prune\b/.test(c), why: 'deletes Docker data and volumes' },
  { id: 'read-private-key', test: (c) => /(\.ssh\/id_[a-z0-9]+(?!\.pub)\b|\.ssh\\id_[a-z0-9]+(?!\.pub)\b|application_default_credentials\.json|\.aws\/credentials|\.npmrc)/i.test(c) && !/\.pub\b/.test(c), why: 'reads private credentials' },
  { id: 'env-exfil', test: (c) => /\b(env|printenv|set|Get-ChildItem\s+env:)\b[^|]*\|\s*(curl|wget|nc|ncat|Invoke-WebRequest|iwr)\b/i.test(c), why: 'sends environment variables over the network' },
  { id: 'rm-absolute', test: (c) => /\brm\s+-[a-z]*r[a-z]*\s+(-[a-z]+\s+)*\/(?!tmp\b)[a-z]/i.test(c) || /\bRemove-Item\b(?=.*-Recurse)[^|;]*\s['"]?[a-z]:\\[^\s'"]+/i.test(c), why: 'recursive delete outside the workspace' },
  { id: 'sudo', test: (c) => /(^|[;&|]\s*)sudo\s/.test(c), why: 'runs with elevated privileges' },
];

/** Extra prompts in the strict profile: anything outward-facing. */
const STRICT_ASK_RULES = [
  { id: 'push', test: (c) => /\bgit\s+push\b/.test(c), why: 'pushes to a remote (strict profile)' },
  { id: 'deploy', test: (c) => /\b(gcloud\s+(run|app|functions)\s+deploy|firebase\s+deploy|kubectl\s+apply|helm\s+(install|upgrade)|terraform\s+apply|vercel\s+(deploy|--prod)|netlify\s+deploy)\b/.test(c), why: 'deploys to an environment (strict profile)' },
];

/**
 * Classify a shell command.
 * @param {string} command
 * @param {{profile?: 'minimal'|'standard'|'strict'}} [opts]
 * @returns {{level: 'deny'|'ask'|'ok', reasons: string[], ids: string[]}}
 */
function classifyCommand(command, opts = {}) {
  const profile = opts.profile || 'standard';
  const c = String(command || '').replace(/\s+/g, ' ').trim();
  const out = { level: 'ok', reasons: [], ids: [] };
  if (!c) return out;

  for (const r of DENY_RULES) {
    if (r.re.test(c)) {
      out.level = 'deny';
      out.reasons.push(r.why);
      out.ids.push(r.id);
    }
  }
  if (out.level === 'deny' || profile === 'minimal') return out;

  const rules = profile === 'strict' ? ASK_RULES.concat(STRICT_ASK_RULES) : ASK_RULES;
  for (const r of rules) {
    if (r.test(c)) {
      out.level = 'ask';
      out.reasons.push(r.why);
      out.ids.push(r.id);
    }
  }
  return out;
}

const SECRET_RULES = [
  { id: 'private-key', severity: 'critical', re: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/ },
  { id: 'gcp-service-account', severity: 'critical', re: /"type"\s*:\s*"service_account"[\s\S]{0,400}"private_key"/ },
  { id: 'google-api-key', severity: 'high', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'aws-access-key', severity: 'high', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: 'github-token', severity: 'high', re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { id: 'gitlab-token', severity: 'high', re: /\bglpat-[A-Za-z0-9_-]{20}\b/ },
  { id: 'stripe-live-key', severity: 'high', re: /\b(sk|rk)_live_[0-9A-Za-z]{20,}\b/ },
  { id: 'slack-token', severity: 'high', re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: 'llm-api-key', severity: 'high', re: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{10,}\b|\bsk-proj-[A-Za-z0-9_-]{40,}\b|\bsk-ant-[A-Za-z0-9_-]{30,}\b/ },
  { id: 'npm-token', severity: 'high', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { id: 'jwt', severity: 'medium', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { id: 'assigned-secret', severity: 'medium', re: /\b(api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["']([^"'\s]{12,})["']/i, valueGroup: 2 },
];

const PLACEHOLDER = /(example|your[-_ ]?|changeme|change[-_]me|placeholder|dummy|sample|fake|test[-_]?key|xxxx|\*\*\*|<[^>]+>|\$\{[^}]+\}|\{\{[^}]+\}\}|process\.env|os\.environ|getenv|redacted)/i;

function preview(value) {
  const v = String(value);
  return v.length <= 8 ? '****' : `${v.slice(0, 4)}…${v.slice(-2)}`;
}

/**
 * Find credentials in text. Findings never contain the full secret.
 * @param {string} text
 * @returns {{id: string, severity: string, line: number, preview: string}[]}
 */
function scanSecrets(text) {
  const findings = [];
  const src = String(text || '');
  if (!src) return findings;
  for (const rule of SECRET_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`);
    let m;
    while ((m = re.exec(src)) !== null) {
      const value = rule.valueGroup ? m[rule.valueGroup] : m[0];
      const lineStart = src.lastIndexOf('\n', m.index) + 1;
      const lineEnd = src.indexOf('\n', m.index);
      const lineText = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      if (PLACEHOLDER.test(value) || (rule.id !== 'private-key' && rule.id !== 'gcp-service-account' && /EXAMPLE/.test(lineText))) {
        if (m.index === re.lastIndex) re.lastIndex++;
        continue;
      }
      findings.push({
        id: rule.id,
        severity: rule.severity,
        line: src.slice(0, m.index).split('\n').length,
        preview: preview(value),
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return findings;
}

const INJECTION_RULES = [
  { id: 'override-instructions', re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|system|developer)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?|messages?)\b/i },
  { id: 'reveal-system-prompt', re: /\b(reveal|print|show|output|repeat)\b[^.\n]{0,30}\b(system|hidden|developer)\s+(prompt|instructions?|message)\b/i },
  { id: 'role-hijack', re: /\b(you are now|from now on you are|act as)\b[^.\n]{0,40}\b(dan|jailbroken|unrestricted|developer mode|root)\b/i },
  { id: 'exfiltrate', re: /\b(send|post|upload|exfiltrate|transmit)\b[^.\n]{0,40}\b(api[_ ]?keys?|secrets?|credentials?|tokens?|env(ironment)? variables?|\.env|ssh keys?)\b/i },
  { id: 'tool-coercion', re: /\b(run|execute)\b[^.\n]{0,20}\b(this|the following)\b[^.\n]{0,20}\b(command|script|code)\b[^.\n]{0,40}\b(without|do not|don't)\b[^.\n]{0,20}\b(ask|confirm|tell)/i },
  { id: 'invisible-characters', re: /[​-‏⁠-⁤﻿]{4,}|[\u{E0000}-\u{E007F}]/u },
];

/**
 * Heuristic prompt-injection scan for untrusted content.
 * @param {string} text
 * @returns {{id: string, line: number}[]}
 */
function scanInjection(text) {
  const src = String(text || '');
  const out = [];
  for (const r of INJECTION_RULES) {
    const m = r.re.exec(src);
    if (m) out.push({ id: r.id, line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

module.exports = { classifyCommand, scanSecrets, scanInjection, DENY_RULES, ASK_RULES, SECRET_RULES };
