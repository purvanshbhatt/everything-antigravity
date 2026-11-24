# Internal comms: templates

Skeletons for each format. Replace every `<placeholder>`; delete any section that would be empty rather than writing "N/A". Keep the house tone of the organization over the wording here.

## Progress, plans, problems (3P)

```markdown
**<Team or project> — week of <date>**

**Progress** (done since last update)
- <Outcome, not activity> (<link to PR, ticket or dashboard>)
- <Outcome> (<link>)

**Plans** (committed for the next period)
- <Deliverable> — <owner>, by <date>

**Problems** (risks, blocks, asks)
- <Problem>: <impact>. **Ask:** <who> to <do what> by <date>.
```

Rules: three to five items per heading, outcomes over activity ("checkout p95 down to 340 ms" beats "worked on performance"), and an empty Problems section only when there truly are none.

## Weekly status report

```markdown
**Subject:** <Project> status <date>: <On track | At risk | Off track | Blocked> — <one-line reason>

**Summary:** <Two sentences: where the project stands against its committed date and scope, and the one thing the reader should know.>

**Decision or help needed:** <Specific ask, owner, deadline> (or "None this week")

| Milestone | Owner | Due | Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| <Milestone> | <name> | <date> | <label> | <short note with link> |

**Risks**
- <Risk> — likelihood <low|medium|high>, impact <...>, mitigation <...>, owner <...>

**Metrics** (source: <dashboard link>)
- <Metric>: <value> (was <baseline>, target <target>)
```

## Leadership summary (bottom line first)

```markdown
**Subject:** <Decision needed | FYI>: <topic in a few words>

**Bottom line:** <One or two sentences: the conclusion or the decision requested.>

**Why it matters:** <Impact in business terms: customers, revenue, risk, cost, dates.>

**Options** (only if a decision is needed)
1. <Option A> — <cost, risk, timeline>. **Recommended** because <reason>.
2. <Option B> — <cost, risk, timeline>.

**What happens next:** <Owner> will <action> by <date>. Reply by <date> if you disagree.
```

Keep it under 250 words. Put detail in a linked document, not in the message.

## Incident notice (internal audience)

Initial notice:

```markdown
**[Investigating] <Service or feature> <degraded | unavailable> — started <time, time zone>**

**Impact:** <Who is affected and how, in user terms. Approximate scope if known.>
**Workaround:** <Steps, or "None known yet".>
**Status:** The <team> is investigating. <Incident channel or page link>.
**Next update:** <time, time zone>, even if there is no change.
```

Update:

```markdown
**[<Identified | Monitoring>] <Service> — update <n>, <time, time zone>**

**What changed since the last update:** <Facts only.>
**Impact now:** <Same, better or worse, with scope.>
**Next update:** <time, time zone>.
```

Resolved:

```markdown
**[Resolved] <Service> — resolved <time, time zone>, duration <h:mm>**

**Impact summary:** <Who was affected, for how long, any data or money effects.>
**Follow-up for readers:** <Anything they must do, or "No action needed".>
**Postmortem:** <Expected date and where it will be shared.>
```

Do not name a cause until the response team has confirmed it, and never assign blame to a person.

## Change announcement

```markdown
**Subject:** <What is changing> on <date> — <what you need to do, in a few words>

**What is changing:** <One or two sentences.>
**Who is affected:** <Teams, roles or systems. Say who is not affected, too.>
**When:** <Effective date and time zone; any transition period.>
**What you need to do:** <Numbered steps with a deadline, or "Nothing".>
**Why:** <The reason in two or three sentences, in the reader's terms.>
**Where to ask:** <Channel, owner, office hours>. Full FAQ: <link>.
```

## FAQ for a change or reorganization

```markdown
# <Change>: questions and answers
_Last updated <date>. New questions go to <channel or form>._

## For everyone
**Does this change <the thing people worry about most: pay, reporting line, deadlines, tools>?**
<Direct answer first, then detail.>

## For <specific group>
**<Question in the words people actually use>?**
<Answer. If unknown: "Not decided yet; <owner> will answer by <date>.">
```

Collect the real questions first (from managers, chat threads and earlier changes), put the most anxious ones at the top, and update the FAQ in place with a changed date rather than sending new versions.

## Internal newsletter

```markdown
# <Team> news — <month or issue number>

**Top story:** <One shipped outcome and its effect, with a link.>

**Shipped**
- <Item> — <one-line effect> (<link>)

**Coming up**
- <Item> — <date>

**People**
- Welcome <name> to <team> as <role>. (Only with their agreement.)

**One number:** <A metric worth knowing, with its source.>
```

Keep each item to one or two lines with a link out, and get agreement before featuring a person.
