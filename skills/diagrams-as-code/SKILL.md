---
name: diagrams-as-code
disable-model-invocation: true
description: >-
  Produces diagrams as editable text with Mermaid, D2 or Excalidraw JSON:
  picks the diagram type for the question (flow, sequence, ER, state, C4
  context or container), derives nodes and edges from the real repository
  (manifests, imports, routes, schemas) instead of guessing, renders to SVG or
  PNG, checks the image, and commits source beside output. Use when the user
  asks for an architecture, flow, sequence or data-model diagram.
---

# Diagrams as Code

A diagram is only useful if it is true and readable. Text-defined diagrams can be reviewed in a diff, regenerated when the code changes, and rendered anywhere, but they are just as easy to fill with plausible boxes that do not exist. This skill answers one question per diagram, builds every node from evidence in the repository, renders the source, and looks at the result before handing it over.

## When to use

- "Draw the architecture", "diagram this flow", "show the sequence for checkout", "make an ER diagram of the schema".
- Onboarding docs, design docs, ADRs and READMEs that need a picture kept in sync with code.
- Explaining a call path or state machine found while debugging or reviewing.
- Turning a whiteboard sketch or a description into a maintainable diagram.

## When not to use

- Hand-drawn icons, illustrations or animated SVG: `svg-graphics`.
- Charts of numbers (bars, lines, scatter): `data-visualization`.
- A threat model with trust boundaries and STRIDE analysis: `/threat-modeling` (it can use this skill for the drawing).
- A narrative walkthrough of how code works: `/explain-code`, which may embed a diagram from here.

## Workflow

1. **Name the question and the reader.** One diagram answers one question for one audience, such as "how does a request reach the database?" for new backend engineers. Choose the type from the table below and the zoom level: system context, containers (deployable units), components (modules inside one container), or code.

   **Check:** The question fits in one sentence, and the type and zoom level are chosen.

2. **Collect evidence from the repository.** Build the node and edge list from real artifacts, not from memory or naming guesses:

   | Diagram | Evidence | Commands and tools |
   | :--- | :--- | :--- |
   | Containers, services | Compose files, Kubernetes manifests, Terraform, CI deploy jobs | `find_by_name` for `docker-compose*.yml`, `*.tf`, `k8s/` |
   | Module dependencies (JS/TS) | Imports | `npx depcruise src --include-only "^src" --output-type mermaid` |
   | Module dependencies (Python) | Imports, classes | `pyreverse -o mmd <package>` (from pylint) |
   | Module dependencies (Go, Rust) | Module graph | `go mod graph`, `go list -deps ./...`, `cargo tree` |
   | Sequence | The actual call path | Trace with `grep_search` and `view_file`; note `file:line` per hop |
   | ER model | Schema or migrations | `pg_dump --schema-only`, Prisma or ORM model files, migration folder |
   | State machine | Enum of states and the transition code | `grep_search` for the state enum and every assignment to it |

   For a large repository, delegate the evidence sweep to a `codebase-explorer` subagent and ask for a table of `node | evidence path` and `edge | evidence path`.

   **Check:** Every planned node and edge has an evidence path. Anything without evidence is dropped or marked as planned.

3. **Cut to fit.** Keep each diagram to about 15 nodes. Group by layer or bounded context with subgraphs or containers, collapse leaf modules into their parent, and split anything larger into a context diagram plus one detail diagram per area. Labels: two to five words, the names used in the code, verbs on edges ("publishes OrderPlaced", "reads").

   **Check:** No diagram exceeds the node budget, and every label is short enough to read at normal zoom.

4. **Write the source with traceability.** Put the source in `docs/diagrams/<name>.mmd` or `.d2`. Add comments that map nodes to paths, so the next editor can re-verify them (`%%` comments in Mermaid, `#` in D2).

   ```mermaid
   %% api -> src/api/server.ts, worker -> src/jobs/worker.ts, db -> infra/postgres.tf
   flowchart LR
     web["Web app (Next.js)"] -->|HTTPS JSON| api["API service"]
     api -->|SQL| db[("Postgres")]
     api -->|publishes OrderPlaced| queue[["Pub/Sub topic"]]
     queue --> worker["Fulfilment worker"]
     worker -->|SQL| db
   ```

   ```d2
   # api: src/api/server.ts · worker: src/jobs/worker.ts
   direction: right
   web: Web app (Next.js)
   api: API service
   db: Postgres {shape: cylinder}
   queue: Pub/Sub topic {shape: queue}
   worker: Fulfilment worker
   web -> api: HTTPS JSON
   api -> db: SQL
   api -> queue: publishes OrderPlaced
   queue -> worker
   worker -> db: SQL
   ```

   **Check:** The comments name a path for every node, and the source uses only syntax for the chosen tool.

5. **Render.** Pin the renderer version (a devDependency, or `npx -p @mermaid-js/mermaid-cli@<version>`) so output does not shift between machines.

   ```bash
   npx -p @mermaid-js/mermaid-cli mmdc -i docs/diagrams/orders.mmd -o docs/diagrams/orders.svg -b transparent
   d2 --layout elk docs/diagrams/orders.d2 docs/diagrams/orders.svg
   d2 fmt docs/diagrams/orders.d2
   ```

   GitHub and many doc sites render fenced `mermaid` blocks directly; still render locally once, because a syntax error there shows up only as a broken block. For Excalidraw, see the format notes below.

   **Check:** The renderer exits 0 and writes the output file.

6. **Look at the result.** Render a PNG (`mmdc ... -o out.png`, or `d2 ... out.png`) and open it with `view_file`, or open the SVG with the browser agent. Check for overlapping labels, crossing edges that hide meaning, unreadable text, wrong direction (left-to-right suits pipelines, top-down suits hierarchies), and contrast on both light and dark backgrounds.

   **Check:** A reader who knows nothing of the code can answer the question from step 1 using only the image.

7. **Commit source next to output and keep it fresh.** Commit the `.mmd` or `.d2` source with the rendered `.svg` beside it, same base name, and link the SVG from the doc. Add a "regenerate" command to the project's task runner, and when code that a diagram traces changes, update the diagram in the same pull request.

   **Check:** The source and output are both in the repo, and regenerating produces no diff.

## Choosing the type

| Question | Diagram | Mermaid | D2 |
| :--- | :--- | :--- | :--- |
| What talks to what? | Flowchart or C4 container view | `flowchart LR` (or `C4Container`) | Shapes and connections, containers for boundaries |
| What happens, in what order, for one request? | Sequence | `sequenceDiagram` | `shape: sequence_diagram` |
| What does the data look like? | Entity relationship | `erDiagram` | `shape: sql_table` |
| What states can this object be in? | State | `stateDiagram-v2` | Shapes and labelled transitions |
| How is the code organised? | Module or class | `flowchart` with subgraphs, `classDiagram` | Nested containers |
| When does each phase happen? | Timeline or Gantt | `gantt`, `timeline` | Not a strength; use Mermaid |

Mermaid is the default when the diagram lives in Markdown on GitHub. D2 gives better automatic layout for dense architecture views. Excalidraw suits whiteboard-style diagrams that people will keep editing by hand.

## Format notes

- **Mermaid labels:** wrap labels containing parentheses, colons or quotes in `["..."]`. A node whose text is a bare lowercase `end` breaks flowcharts; capitalize it or quote it. Use `classDef` sparingly; color should encode meaning (for example, external systems) and be explained in a legend.
- **Sequence diagrams:** `->>` for calls, `-->>` for replies, `alt`/`else`/`end` for branches, `Note over A,B: text` for context. Mirror the real call order you traced, with `file:line` in a comment per hop.
- **D2:** `d2 --watch` re-renders on save; `--sketch` gives a hand-drawn look; the default layout engine is dagre and `--layout elk` often untangles dense graphs.
- **Excalidraw:** the file is JSON (`"type": "excalidraw"` with an `elements` array of rectangles, ellipses, text and arrows that carry `startBinding` and `endBinding`). Generating it by hand is fiddly; it is often easier to write Mermaid and use Excalidraw's Mermaid import, then save the `.excalidraw` file into the repo. Open it with the Excalidraw app or editor extension to check it. Keep private architecture out of public tools the team has not approved.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Draw boxes from folder names alone | Derive from imports, manifests and call traces | Folders lie; wiring is what runs |
| Put the whole system in one picture | Context view plus one detail view per area | Past ~15 nodes nobody reads the diagram |
| Commit only the PNG | Commit source and rendered output together | Images cannot be diffed or updated |
| Use color without a legend | Encode one meaning per color and explain it | Readers guess, and color-blind readers lose it |
| Long sentences as labels | Two to five words; details in the doc text | Long labels wreck layout |
| Draw planned components as if they exist | Mark them as planned or leave them out | Readers trust diagrams as fact |
| Skip rendering because the syntax "looks right" | Render and view the image | Small syntax errors break the whole diagram |

## Verification checklist

- [ ] The diagram answers one stated question for one stated reader.
- [ ] Every node and edge has an evidence path, recorded in source comments.
- [ ] No diagram exceeds about 15 nodes; larger systems are split by zoom level.
- [ ] The source renders without errors using a pinned renderer version.
- [ ] The rendered image was viewed and is readable on light and dark backgrounds.
- [ ] Source and rendered output are committed side by side, and regeneration gives no diff.

## Related

- Workflows: `/explain-code`, `/codebase-onboard`, `/architecture-decision`, `/threat-modeling`, `/update-docs`.
- Knowledge: `svg-graphics`, `data-visualization`, `software-architecture`, `documentation-writing`, `database-design`.
- Agents: `codebase-explorer` (evidence sweeps), `doc-updater` (keeping diagrams in sync), `code-architect` (target-state designs).
