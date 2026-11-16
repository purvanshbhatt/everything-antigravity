# Token Optimization & Context Compaction Rules

1. **Subagent Context Boundary**: Isolate noisy exploratory work and deep directory scans inside subagents. Return only concise, high-signal reports to parent agent.
2. **Strip Terminal Artifacts**: Strip ANSI escape sequences, raw binary output, and duplicate polling loop lines before sending text into context.
3. **No Fluff & No Status Spam**: Avoid interim status messages or conversational filler. Deliver factual summaries directly.
4. **Periodic Compaction**: Run compaction when session token consumption approaches 75% capacity to maintain prompt sharpness.
