---
name: literature-review
description: >-
  Runs academic literature reviews: question framing (PICO and similar),
  reproducible search strings across databases, PRISMA-style screening against
  inclusion criteria, structured extraction notes, quality appraisal, thematic
  synthesis and citation-manager hygiene with Zotero and BibTeX. Use when the
  user needs a related-work section, a scoping or systematic review, or a
  reading plan for a research field.
---

# Literature Review

Find, filter and synthesize the relevant literature in a way another
researcher could reproduce. Every reference comes from a database record the
agent actually retrieved; nothing is cited from memory.

## When to use

- Related-work sections for papers, theses and grant proposals.
- Scoping reviews ("what has been studied about X?") and systematic or rapid reviews.
- Building a reading list and annotated bibliography for a new field.

## When not to use

- A quick, mixed-source answer to a practical question: `/research-synthesis`.
- Market or competitor research: `market-research`, `competitive-analysis`.
- Statistical meta-analysis itself: use a statistician and dedicated tools; this skill prepares the evidence base.

## Workflow

1. **Frame the review.** Choose the type (narrative, scoping, systematic, rapid) and write the question with a framework: PICO (Population, Intervention, Comparison, Outcome) for clinical work, SPIDER for qualitative work, or simply concept + context + outcome for computing. Write inclusion and exclusion criteria (years, languages, study types, venues) before searching.

   **Check:** Criteria are specific enough that two people would screen the same paper the same way.

2. **Build search strings.** List synonyms per concept, combine with `OR` inside a concept and `AND` across concepts, and adapt to each database's syntax (MeSH terms in PubMed, field tags elsewhere). Record each string, database and date.

   ```text
   ("large language model*" OR LLM OR "foundation model*")
   AND ("code review" OR "pull request*")
   AND (evaluat* OR benchmark*)
   ```

   **Check:** The strings and run dates are saved so the search can be rerun.

3. **Search the right databases.** Biomedicine: PubMed, Embase, Cochrane Library. Computing: ACM Digital Library, IEEE Xplore, DBLP, arXiv. Cross-discipline: Scopus, Web of Science, OpenAlex, Semantic Scholar, Google Scholar (useful but not reproducible; use as a supplement). Then snowball: backward (references of key papers) and forward (papers citing them).

   **Check:** Record counts per source are logged for the flow diagram.

4. **Deduplicate and screen in two stages.** Import into a citation manager (Zotero, JabRef, EndNote) or a screening tool (Rayyan, Covidence) and remove duplicates by DOI then title. Screen titles and abstracts, then full texts, logging an exclusion reason for each full-text exclusion. For systematic reviews, have a second screener check a sample and report agreement.

   **Check:** Counts reconcile: identified - duplicates - excluded = included, as in a PRISMA 2020 flow diagram.

5. **Extract into a structured table.** One row per included study (template below). Note whether you read the full text or only the abstract.

   **Check:** No row has an empty "key finding" or "limitations" cell.

6. **Appraise quality.** Use a tool fitted to the design: Cochrane RoB 2 for randomized trials, CASP checklists, JBI tools, or explicit criteria for engineering papers (baseline strength, dataset size and leakage, reproducibility artifacts). Flag preprints as not peer reviewed and check for retractions (Crossref metadata includes Retraction Watch data; verify against current docs).

   **Check:** Every included study has a quality rating and a reason.

7. **Synthesize by theme, not by paper.** Group findings into themes, state where evidence agrees, conflicts or is thin, and name the gaps your work addresses. Use "studies X, Y and Z found..." rather than one paragraph per paper.

   **Check:** Each theme paragraph cites at least two studies or explicitly says it rests on one.

8. **Verify every reference.** Resolve each DOI (`https://doi.org/<doi>`) or look it up via the Crossref API (`https://api.crossref.org/works/<doi>`); confirm authors, title, year and venue. Export BibTeX from the citation manager (Zotero with Better BibTeX gives stable citation keys) rather than typing entries by hand.

   **Check:** Zero references that cannot be resolved to a real record.

## Patterns

Extraction table:

| Citation key | Year | Design / method | Sample or dataset | Key finding | Limitations | Quality | Full text read? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| smith2024review | 2024 | Controlled experiment | 312 PRs, 4 repos | ... | Single company | Medium | Yes |

| Review type | Use when | Reporting guide |
| :--- | :--- | :--- |
| Narrative | Background or related-work section | None formal; be transparent about search |
| Scoping | Mapping what exists in a broad field | PRISMA-ScR |
| Systematic | Answering a focused question with all evidence | PRISMA 2020, often a registered protocol (e.g. PROSPERO for health) |
| Rapid | Time-boxed decision support | State the shortcuts taken |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Generate references from memory | Retrieve and verify every record | Invented or mangled citations are a common, serious failure |
| Search one database | Combine databases plus snowballing | Coverage differs widely between indexes |
| Decide criteria after reading | Fix criteria before screening | Post-hoc criteria bias the result |
| Summarize paper by paper | Synthesize by theme | Readers need the state of knowledge, not a list |
| Cite a preprint as settled | Flag it and check for a published version | Preprints change or get withdrawn |

## Verification checklist

- [ ] Question, framework and inclusion criteria written before searching.
- [ ] Search strings, databases, dates and counts logged.
- [ ] Screening counts reconcile; full-text exclusions have reasons.
- [ ] Every included study has extraction notes and a quality rating.
- [ ] Every reference resolves to a real record; BibTeX exported from a manager.

## Related

- Workflows: `/research-synthesis`.
- Knowledge: `grant-writing`, `editing`, `data-storytelling`, `scientific-computing`, `bioinformatics`, `ml-evaluation`.
- Agents: `deep-researcher`.
