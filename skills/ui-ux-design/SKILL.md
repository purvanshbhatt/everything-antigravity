---
name: ui-ux-design
description: >-
  Designs usable interfaces from problem to handoff: framing, user flows with
  error paths, low-fidelity wireframes, complete component states, responsive
  layouts, heuristic evaluation with severity ratings, structured design
  critique, Figma handoff with auto layout, variables and annotations, and
  design QA against the built UI in a browser. Use when designing a feature
  or screen, critiquing a design, or preparing designs for developers.
---

# UI/UX Design

Good interface design is mostly decided before pixels: who the user is, which
job they are doing, and every path through the flow, including errors. Then
design every state, critique against heuristics, and hand off specs precise
enough that the build matches the design.

## When to use

- Designing a new feature, screen or flow, or redesigning a confusing one.
- Critiquing a mockup, prototype or live UI.
- Preparing a Figma file for developer handoff.
- Checking that the implementation matches the design.

## When not to use

- Interviews, usability tests and surveys: use `ux-research`.
- Building the component library and tokens: use `design-systems`.
- Logos, palettes and brand type: use `visual-identity`.
- Polishing an implemented UI in code: use `/ui-polish`; accessibility audits: `/a11y-audit`.

## Workflow

1. **Frame the problem.** User, their job ("when I..., I want to..., so I can..."), the success metric, constraints (platform, tech, deadline) and evidence (support tickets, analytics, research findings).

   **Check:** A one-paragraph problem statement names user, job, metric and constraints.

2. **Map user flows, including failure paths.** Entry points, decisions, happy path, errors, empty states, permission denials, offline and back navigation. Mermaid is easy to keep in the repo:

   ```mermaid
   flowchart TD
     A[Cart] --> B{Signed in?}
     B -- no --> C[Sign in or continue as guest]
     B -- yes --> D[Shipping]
     C --> D
     D --> E[Payment] --> F{Payment ok?}
     F -- no --> G[Show error, keep form data] --> E
     F -- yes --> H[Confirmation]
   ```

   **Check:** Every decision node has all outcomes drawn, including failure.

3. **Wireframe in low fidelity.** Grey boxes, real copy, content hierarchy first. Produce two or three layout options for the key screen and pick with the team before adding visual detail.

   **Check:** Options differ in structure, not just styling, and the choice is recorded with a reason.

4. **Design every state.** For each component and screen: default, hover, focus, active, disabled, loading (skeleton or spinner), empty (first use and no results), error (inline and page level), success, partial data, very long text, slow network and offline. Cover breakpoints (mobile, tablet, desktop). Touch targets: at least 24 x 24 CSS px (WCAG 2.2 minimum), 44 x 44 pt on iOS and 48 x 48 dp on Android.

   **Check:** A state matrix shows every state at every breakpoint for each key component.

5. **Prototype and test.** Link screens into a clickable prototype covering the main task, then test with five representative users (see `ux-research`).

   **Check:** At least one round of task testing ran before handoff, with issues logged.

6. **Critique with heuristics.** Walk the flow against Nielsen's heuristics and rate each issue 0-4 (0 not a problem, 4 usability catastrophe). Structure critique as: goal of the screen, what works, issues ranked by severity with the violated heuristic, suggested fix.

   | Heuristic | Quick check |
   | :--- | :--- |
   | Visibility of system status | Every action gives feedback within about 1 s |
   | Match with the real world | User language, not internal jargon |
   | User control and freedom | Undo, cancel and back always available |
   | Consistency and standards | Same thing looks and behaves the same everywhere |
   | Error prevention | Constraints and confirmations before costly actions |
   | Recognition over recall | Options visible; no memorized codes |
   | Flexibility and efficiency | Shortcuts and defaults for frequent users |
   | Aesthetic and minimalist design | Nothing competes with the primary action |
   | Help users recover from errors | Plain-language cause and next step |
   | Help and documentation | Contextual help where tasks are complex |

   **Check:** Each issue has a severity, a heuristic and a proposed fix.

7. **Hand off.** In Figma: auto layout on every frame, components with variants for states, variables for colour, spacing and type, annotations for interactions, motion (duration, easing), focus order, labels and roles, plus responsive behaviour. Write acceptance criteria per screen. If a Figma MCP server is configured, the agent can read node specs directly instead of guessing from screenshots.

   **Check:** A developer can build the screen without asking about any state, spacing or behaviour.

8. **Run design QA.** Compare the built UI against the design in the Antigravity browser at each breakpoint: screenshots side by side, states triggered (errors, empty, loading), keyboard navigation. Log differences as tickets with screenshots.

   **Check:** Every mismatch is fixed or accepted explicitly.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start in high fidelity | Flows and wireframes first | Polish hides structural problems and resists change |
| Design only the happy path | State matrix with errors, empty and loading | Developers invent missing states inconsistently |
| Lorem ipsum | Real or realistic copy, including long values | Layouts break on real content |
| "I don't like it" critique | Heuristic, severity and fix | Actionable and less personal |
| Detached, one-off components | Components with variants and variables | Inconsistency and slow updates |
| Handoff by screenshot | Annotated specs and acceptance criteria | Guesswork produces mismatches |

## Verification checklist

- [ ] Problem statement with user, job, metric and constraints.
- [ ] Flows include failure paths; wireframe options compared.
- [ ] State matrix complete across breakpoints; targets meet minimum sizes.
- [ ] Usability test round done; heuristic issues rated and resolved.
- [ ] Handoff has auto layout, variants, variables, annotations and acceptance criteria.
- [ ] Design QA against the built UI completed.

## Related

- Workflows: `/ui-polish`, `/a11y-audit`.
- Knowledge: `ux-research`, `design-systems`, `accessibility-a11y`, `forms-validation`, `visual-identity`, `frontend-react-nextjs`.
- Agents: `ux-designer`, `accessibility-auditor`, `frontend-engineer`.
