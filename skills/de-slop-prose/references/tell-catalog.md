# Tell Catalog

Companion to the `de-slop-prose` skill. The word list catches lexical tells; the
structural cues below catch the patterns a word list cannot see. Every entry is a
candidate, not a verdict: read the sentence before changing it.

## Starter word list

Save this block as `slop-words.txt` (one pattern per line) and search with
`rg -n -i -w -f slop-words.txt <file>`. Add the house style guide's own banned
phrases, and remove any word that is a legitimate term in the document's field.

```text
delve
delves
tapestry
testament to
pivotal
paramount
seamless
seamlessly
cutting-edge
game-changer
game-changing
revolutionize
revolutionary
unlock
unleash
elevate
empower
empowers
supercharge
harness the power
robust
leverage
leveraging
synergy
holistic
landscape
realm
navigate the complexities
in today's
fast-paced
ever-evolving
ever-changing
it's worth noting
it is important to note
needless to say
at the end of the day
in conclusion
in summary
moreover
furthermore
additionally
notably
crucially
ultimately
let's dive in
dive into
deep dive
look no further
whether you're
plays a crucial role
plays a vital role
a wide range of
a myriad of
plethora
boasts
nestled
vibrant
meticulous
meticulously
I hope this helps
great question
certainly
absolutely
as an AI
```

## Structural cues

| Cue | How to spot it | Fix |
| :--- | :--- | :--- |
| Participle tail | Sentence ends with ", highlighting...", ", ensuring...", ", underscoring...", ", reflecting..." | Cut the tail, or turn it into its own sentence with a concrete claim |
| Paired abstraction | "both X and Y", "not only X but also Y" where X and Y are vague nouns | Pick the one that matters and make it concrete |
| List padding | Bullet lists where each item is a two-word noun phrase with no verb | Turn into sentences that say what happens, or cut the list |
| Label bullets | Every bullet starts with a bold label and a colon | Keep labels only when readers scan for them; otherwise write a paragraph |
| Heading inflation | A 300-word note with four headings | Remove headings below about 500 words unless the text is reference material |
| Closing moral | Final sentence states a lesson ("The takeaway is clear: ...") | Delete; the reader can draw it |
| Faux candour | "Let's be honest", "Here's the thing", "The truth is" | Delete and state the point |
| Hedged opener | "While X has its challenges, ..." on every paragraph | State the challenge specifically, once, where it applies |
| Symmetric paragraphs | Every paragraph has topic sentence, two support sentences, wrap-up | Let paragraph length follow content; some can be one sentence |
| Over-qualified numbers | "approximately around 50%" | One qualifier, or the exact figure |
| Empty intensifiers | "truly", "incredibly", "deeply", "remarkably" | Delete; if the sentence collapses, it had no claim |
| Dash chains | Several em dashes per paragraph used as all-purpose connectors | Use a period, comma, colon or parentheses |
| Emoji structure | Emoji used as bullets or heading markers in technical text | Remove unless the house style uses them |

## Edge cases

- **Honest hedges.** "We have not tested this on Windows" is a useful qualifier, not slop. Keep hedges that point at a specific unknown.
- **Terms of art.** "Robust" (statistics, control systems), "landscape" (print orientation), "leverage" (finance), "harness" (test harness) are fine when they are the technical term.
- **Quoted material.** Never edit inside quotations, even if the quote is full of tells. Comment on it outside the quote if needed.
- **Required boilerplate.** Legal notices, license headers and regulated disclosures stay verbatim.
- **Non-English text.** Tells differ by language. Build a separate list with a native speaker's help rather than translating this one.
- **Voice that genuinely uses a pattern.** Some authors like triplets or dashes. If the author's own samples use a pattern deliberately, keep it at their frequency.

## Change summary template

```markdown
## Rewrite summary
- Tags found: INFLATE 4, PROMO 6, TRIAD 3, TAIL 5, ECHO 1, CHAT 2
- Cut: opening signpost paragraph; closing summary (repeated the intro)
- Concretized: latency claim now uses the benchmark from the PR description
- Kept deliberately: one hedge in "Limitations" (real unknown: Windows support)
- Questions for the author:
  1. "Used by many teams": can we name a number or a public user, or should it go?
```
