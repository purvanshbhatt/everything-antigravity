---
name: technical-blogging
description: >-
  Writes technical blog posts engineers finish and trust: a sharp angle, a
  reader-first structure, runnable code samples, measured proof instead of
  adjectives, honest trade-offs and distribution that fits the audience. Use
  when the user wants to write, outline or tighten an engineering blog post,
  tutorial, launch write-up, deep dive or war story, or turn a project into an
  article.
---

# Technical Blogging

A technical post earns attention by teaching something the reader could not
easily get elsewhere, and earns trust by showing evidence. This skill turns a
topic into a post with one clear promise, proof for every claim and code that
runs.

## When to use

- "Write a blog post about how we cut build time", "turn this PR into an article", "outline a tutorial".
- Engineering-blog deep dives, incident war stories (after the postmortem is public-safe), launch write-ups, comparisons.
- Reviewing a draft that is accurate but nobody finishes.

## When not to use

- Reference docs, READMEs or guides that live with the code: `documentation-writing`.
- A recurring email issue: `newsletters`. A talk: `conference-talks`.
- Landing pages, ads or conversion copy: `copywriting`. Topic strategy and calendars: `content-marketing`.
- A pure proofreading pass on a finished draft: `editing`.

## Workflow

1. **Pin the reader and the promise.** Write one sentence: "After reading, a <specific reader> can <do X> or understands why <Y>." Pick the post type from the table below.

   **Check:** The promise is under 25 words and names a reader more specific than "developers".

2. **Find the angle.** Search for the top existing posts on the topic and note what they all say. The angle is what this post adds: a number you measured, a failure you debugged, a constraint others ignore, or a counter-intuitive result.

   **Check:** The angle can be stated as a claim a competent reader could disagree with.

3. **Collect proof before prose.** Gather benchmarks (with hardware, versions, run count and variance), before/after numbers, logs, diagrams and a public repo or gist. Replace every adjective with a number or an example.

   **Check:** Every claim in the outline has its evidence attached, or is cut.

4. **Outline so the headings tell the story.** Hook (the problem in two or three sentences), context (only what the reader needs), the core (steps or the investigation), trade-offs and limits, and a close with the next action. Put the outline in an artifact for the user to approve.

   **Check:** Reading only the title and headings conveys the argument.

5. **Build code samples that run.** Extract them from a real project, pin versions, run them in a clean environment and show real output. Cut to the relevant lines, mark elisions with `// ...`, tag code fences with a language, and give commands without shell prompts so they copy cleanly. Show the PowerShell form when it differs.

   **Check:** Each snippet was executed; versions are stated next to it.

6. **Draft fast, reader first.** Lead with the payoff, keep paragraphs to three or four sentences, define each term on first use, and use "you". Put versioned behaviour behind "as of <version/date>".

   **Check:** The intro is under 150 words and states what the reader will get.

7. **Edit and fact-check.** Cut about 20%. Re-verify every number and link, add alt text to images, and run the `editing` pass. Scan for internal hostnames, customer names, keys and tokens: `eag shield --file post.md` (or `node <plugin-root>/bin/eag.js shield --file post.md`).

   **Check:** Zero shield findings, all links resolve, a second engineer has reviewed the technical content.

8. **Publish and distribute, with confirmation.** Publishing and posting are outward-facing: show the final text and target channels, and wait for an explicit yes. Set a canonical URL on cross-posts and write a native summary per channel instead of pasting the same blurb everywhere.

   **Check:** The user approved the publish; canonical links point to the original.

## Patterns

| Post type | Shape | Typical length |
| :--- | :--- | :--- |
| Tutorial | Goal, prerequisites, numbered steps with output, troubleshooting, next steps | 1,200-2,500 words |
| Deep dive / war story | Symptom, investigation (including dead ends), root cause, fix, what changed | 1,500-3,000 words |
| Explainer | Question, mental model, worked example, edge cases | 800-1,800 words |
| Comparison | Criteria first, method, results table, "choose X when..." | 1,500-2,500 words |
| Launch / announcement | What shipped, why it matters, how to try it in 60 seconds, limits | 500-1,000 words |

Proof over adjectives:

| Weak | Strong |
| :--- | :--- |
| "Dramatically faster builds" | "Cold CI builds dropped from 14m 10s to 3m 52s (median of 20 runs, same runner type)" |
| "Simple to set up" | "Three commands; the full config is the 12-line file below" |
| "Scales well" | "p95 stayed under 120 ms from 50 to 2,000 RPS in the k6 run linked here" |

Titles that work state the outcome or the surprise: "How we cut cold starts 70% by deleting a dependency", "Why our cache made p99 worse". Avoid "A deep dive into X" and clickbait the post can't pay off.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Open with history or "In today's fast-paced world" | Open with the problem and the payoff | Readers decide in the first paragraph |
| Paste untested snippets | Run every sample and show its output | One broken sample discredits the whole post |
| Hide trade-offs | Add a "When not to do this" section | Experienced readers trust posts that admit limits |
| Publish benchmarks without setup | State hardware, versions, runs, variance | Unreproducible numbers invite dismissal |
| Leak internal details | Shield scan and a reviewer from the owning team | Posts are permanent and public |

## Verification checklist

- [ ] One promise, one named reader, one angle.
- [ ] Every claim has a number, example or link; benchmarks state their setup.
- [ ] All code samples executed with pinned versions.
- [ ] Shield scan clean; technical reviewer signed off.
- [ ] The user explicitly approved publishing and the channel list.

## Related

- Knowledge: `editing`, `documentation-writing`, `copywriting`, `content-marketing`, `newsletters`, `conference-talks`, `developer-relations`, `data-storytelling`, `seo-audit`.
- Agents: `technical-writer`.
