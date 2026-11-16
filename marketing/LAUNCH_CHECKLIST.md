# 📋 Everything Antigravity (EAG) — Marketing & Launch Checklist

Use this quick-action checklist to execute the multi-channel launch across X, Reddit, Medium, and Dev.to.

---

## 1. Platforms & Links
- **GitHub:** https://github.com/purvanshbhatt/everything-antigravity
- **GitLab:** https://gitlab.com/purvansh95b/everything-antigravity
- **NPM Package:** https://www.npmjs.com/package/everything-antigravity
- **Marketing Folder:** [`marketing/`](.)

---

## 2. Launch Sequence

### Step 1: NPM Release
- Run `npm login` in your terminal.
- Run `npm publish --access public` (or dispatch the GitHub Actions `.github/workflows/npm-publish.yml` workflow by adding `NPM_TOKEN` to your repo secrets).
- Verify with `npx everything-antigravity status`.

### Step 2: X (Twitter)
- Open [marketing/X_LAUNCH_THREAD.md](X_LAUNCH_THREAD.md).
- Copy Tweet 1 as the main tweet.
- Post Tweets 2 through 7 as consecutive replies in the thread.
- Optional: Attach a screenshot or terminal recording of `eag status` and `eag verify`.

### Step 3: Reddit
- Open [marketing/REDDIT_POSTS.md](REDDIT_POSTS.md).
- Post **Post 1** to `r/ArtificialIntelligence` and `r/LocalLLaMA`.
- Post **Post 2** to `r/ClaudeAI` and `r/ChatGPTCoding`.
- Post **Post 3** to `r/webdev` and `r/gamedev`.

### Step 4: Medium
- Open [marketing/MEDIUM_ARTICLE.md](MEDIUM_ARTICLE.md).
- Import or paste into Medium's editor.
- Set tags: `Artificial Intelligence`, `Software Engineering`, `Web Development`, `Google`, `Open Source`.
- Publish and share the Medium story link on LinkedIn and X.

### Step 5: Dev.to
- Open [marketing/DEV_TO_POST.md](DEV_TO_POST.md).
- Copy the raw Markdown (including the YAML frontmatter).
- Paste directly into Dev.to's editor and hit "Publish".

---

## 3. Post-Launch Community Monitoring
- Monitor GitHub Issues and Discussions.
- Monitor GitLab issues and merge requests.
- Respond to comments on Reddit within the first 2-4 hours to drive algorithmic reach.
