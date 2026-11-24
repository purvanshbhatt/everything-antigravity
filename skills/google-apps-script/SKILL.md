---
name: google-apps-script
disable-model-invocation: true
description: >-
  Automates Google Workspace with Apps Script: local development with clasp,
  the appsscript.json manifest and least-privilege OAuth scopes, batched Sheets
  reads and writes, simple versus installable triggers, quotas, time limits
  and checkpointed long jobs, LockService, script
  properties, custom functions, and web app or add-on deployment. Use when
  automating Sheets, Docs, Gmail, Drive, Calendar or Forms, or when a script
  hits quotas or timeouts.
---

# Google Apps Script

Apps Script runs JavaScript (V8) on Google's servers with built-in access to
Workspace services. Scripts fail for three predictable reasons: per-cell API
calls in loops, the per-execution time limit, and triggers running with the
wrong identity or scopes. Design around all three from the start.

## When to use

- Automating spreadsheets: imports, cleanup, reports, notifications.
- Reacting to form submissions, edits, schedules or incoming mail.
- Building a small internal web app, sidebar or custom menu on Workspace data.
- A script times out, hits "Service invoked too many times" or runs as the wrong user.

## When not to use

- Model and formula design inside the sheet: use `spreadsheet-modeling`.
- Production services with SLAs, heavy compute or large data: use Cloud Run (`cloud-run`) or BigQuery (`bigquery`) with the Workspace APIs.
- Bulk marketing email: use `email-marketing` or `transactional-email` providers.

## Workflow

1. **Set up local development.** Container-bound scripts live in a file (Sheets, Docs, Forms); standalone scripts live in Drive. Use clasp to edit in the IDE with git:

   ```bash
   npm i -g @google/clasp
   clasp login
   clasp clone <scriptId>    # Project Settings in the Apps Script editor shows the ID
   clasp pull                # fetch remote changes
   clasp push                # upload local files
   ```

   Enable the Apps Script API in your Apps Script user settings first. clasp 3 renamed several commands (create, deploy, logs) and no longer transpiles TypeScript (bundle with esbuild or Rollup instead); check `clasp --help` for your version.

   **Check:** `clasp push` succeeds and the change appears in the online editor.

2. **Pin the manifest.** In `appsscript.json` set `timeZone`, `"runtimeVersion": "V8"`, `"exceptionLogging": "STACKDRIVER"` and an explicit `oauthScopes` list with the narrowest scopes, for example `https://www.googleapis.com/auth/spreadsheets.currentonly` instead of full Drive access.

   **Check:** The authorization prompt lists only the scopes you declared.

3. **Batch every service call.** Read a range once with `getValues()`, transform in JavaScript arrays, write once with `setValues()`. Never call `getValue()`/`setValue()` per cell inside loops. Use `UrlFetchApp.fetchAll` for parallel HTTP requests and `CacheService` for repeated lookups.

   **Check:** The execution log shows a handful of Sheets calls per run, not one per row.

4. **Pick the right trigger.**

   | Trigger | How | Limits and identity |
   | :--- | :--- | :--- |
   | Simple: `onOpen(e)`, `onEdit(e)`, `onSelectionChange(e)`, `onInstall(e)` | Function name only | No services that need authorization; short time limit; not fired by script or API edits |
   | Web app: `doGet(e)`, `doPost(e)` | Deploy as web app | Runs as owner or as visitor, per deployment settings |
   | Installable: time-driven, on form submit, on change, on edit | `ScriptApp.newTrigger(...)` or the Triggers page | Runs as the user who created it; counts toward daily trigger runtime |

   Create installable triggers idempotently: delete existing triggers for the same handler before creating a new one.

   **Check:** The Triggers page shows exactly one trigger per handler, owned by the intended account.

5. **Respect quotas and the time limit.** Each execution has a hard time cap (6 minutes for standard scripts; custom functions and simple triggers get far less). Daily quotas cap email recipients, URL fetches and total trigger runtime, with higher limits on Workspace accounts. Check the current Apps Script quotas page; do not hard-code numbers from memory. For long jobs, process in batches, store a cursor in `PropertiesService`, and resume on a time-driven trigger:

   ```js
   const BATCH = 500;

   function processOrders() {
     const lock = LockService.getScriptLock();
     if (!lock.tryLock(5000)) return;                       // previous run still active
     try {
       const props = PropertiesService.getScriptProperties();
       const start = Number(props.getProperty('cursor') || 2); // row 1 is the header
       const sheet = SpreadsheetApp.getActive().getSheetByName('Orders');
       const last = sheet.getLastRow();
       if (start > last) { props.deleteProperty('cursor'); return; }
       const n = Math.min(BATCH, last - start + 1);
       const range = sheet.getRange(start, 1, n, 4);         // id, qty, price, status
       const out = range.getValues().map(([id, qty, price, status]) =>
         [id, qty, price, status || (qty * price > 1000 ? 'REVIEW' : 'OK')]);
       range.setValues(out);                                 // one write per batch
       props.setProperty('cursor', String(start + n));
     } finally {
       lock.releaseLock();
     }
   }

   function installTrigger() {
     ScriptApp.getProjectTriggers()
       .filter((t) => t.getHandlerFunction() === 'processOrders')
       .forEach((t) => ScriptApp.deleteTrigger(t));
     ScriptApp.newTrigger('processOrders').timeBased().everyMinutes(5).create();
   }
   ```

   **Check:** A run on the full dataset finishes in batches well under the time cap, and overlapping runs exit early.

6. **Keep secrets out of code.** API keys go in Script Properties (`PropertiesService.getScriptProperties()`); anyone with edit access to the script can read them, so limit editors. Never log tokens.

   **Check:** `grep_search` finds no key-like strings in the project files.

7. **Write custom functions carefully.** `=PRICE_WITH_TAX(A2:A100)` receives a 2-D array and should return a 2-D array in one call. Custom functions are pure: no services requiring authorization, short time limit, recalculated often.

8. **Test and observe.** Develop against a copy of the real file. Use `console.log` (Executions view and Cloud Logging), wrap trigger entry points in try/catch, and notify an owner on failure. Keep pure logic in plain functions that can be unit-tested locally with Node.

   **Check:** A deliberately broken input produces a logged error and a notification, not a silent stop.

9. **Deploy (confirm first).** Web app deployments expose an endpoint: confirm "Execute as" and "Who has access" with the user before deploying, and prefer domain-restricted access. Scripts that send email, share files or modify many documents need an explicit yes and a dry-run mode that logs intended actions first. Use versioned deployments so you can roll back.

   **Check:** The deployment's access setting matches what the user approved, and a dry run logged the planned actions.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `getValue`/`setValue` per cell in loops | One `getValues` and one `setValues` per range | Each call is a round trip; scripts time out |
| Broad `drive` scope for one sheet | Narrow scopes declared in the manifest | Scarier consent and larger blast radius |
| Create triggers on every run | Delete-then-create once, idempotently | Duplicate triggers multiply work and quota use |
| One long run over all rows | Batches with a cursor and a time-driven trigger | The execution time cap kills the job midway |
| API keys in source files | Script Properties, limited editors | Code is shared and copied with the file |
| Web app open to "Anyone" by default | Domain-restricted access unless the user decides otherwise | Exposes data and quota to the internet |

## Verification checklist

- [ ] Manifest pins V8, time zone and least-privilege scopes.
- [ ] All Sheets access is batched; long jobs checkpoint and resume.
- [ ] Triggers are unique per handler and owned by the right account.
- [ ] Concurrency guarded with LockService; secrets in Script Properties.
- [ ] Errors are logged and notified; a dry run preceded bulk email or sharing.
- [ ] Deployment access was confirmed by the user.

## Related

- Knowledge: `spreadsheet-modeling`, `transactional-email`, `secrets-management`, `webhooks`, `bigquery`, `background-jobs`.
- Workflows: `/tdd`.
- Agents: `data-analyst`.
