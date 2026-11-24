---
name: youtube-channel
disable-model-invocation: true
description: >-
  Grows and runs a YouTube channel: audience and content pillars, packaging
  ideas before scripting, titles and thumbnails, hooks and retention-focused
  scripts and edits, chapters, captions and end screens, Shorts, reading
  YouTube Studio analytics (CTR, average view duration, retention graphs,
  traffic sources), and metadata automation with the YouTube APIs. Use when
  planning a channel, improving views or retention, or preparing an upload.
---

# YouTube Channel

YouTube rewards videos that people click and keep watching. Packaging (title
plus thumbnail) earns the click; the first 30 seconds and the pacing earn the
watch time. Plan the package before the script, edit for retention, and read
analytics one variable at a time.

## When to use

- Starting or repositioning a channel: audience, pillars, formats, cadence.
- Videos get impressions but few clicks, or clicks but early drop-off.
- Preparing an upload: title, thumbnail, description, chapters, captions, end screen.
- Adding Shorts or repurposing long-form content.

## When not to use

- Editing and rendering pipelines: use `video-production-pipeline`, `ffmpeg-multimedia` or `/video-render`.
- Motion graphics and animated explainers: use `remotion-motion-graphics`.
- Cross-platform social strategy: use `social-media`.
- Audio-first shows: use `podcast-production`.

## Workflow

1. **Define the channel.** One-sentence promise ("practical Godot tutorials for solo devs"), target viewer, 2-4 content pillars, formats (tutorial, breakdown, review, series), and a cadence you can sustain for six months.

   **Check:** Every planned video maps to a pillar and serves the stated viewer.

2. **Validate ideas by packaging first.** Research search suggestions and outlier videos in the niche (videos with far more views than their channel's usual). For each idea, write the title and a thumbnail concept before scripting; if the package is weak, drop or reshape the idea.

   **Check:** Each greenlit idea has 3 title options and a thumbnail sketch.

3. **Craft titles and thumbnails.** Title: a specific promise or tension, front-loaded keywords, roughly 60 characters so it is not truncated. Thumbnail: one focal subject, high contrast, at most about 3 words that complement rather than repeat the title, readable at phone size; 16:9 at 1280 x 720 (check current upload limits in YouTube Help). Keep a consistent style. Use YouTube Studio's thumbnail testing where available.

   **Check:** At thumbnail size on a phone screen, the subject and text are readable in under a second.

4. **Script for retention.** First 15-30 seconds: confirm the title's promise and show the payoff is coming; skip long intros and channel plugs. Structure into clear segments with open loops; add a visual change (B-roll, angle, graphic, example) every 20-60 seconds; deliver the payoff fully; end with one call to action pointing to a specific next video.

   **Check:** The script's opening line restates the promise within the first two sentences.

5. **Edit for pace.** Cut dead air and repeated takes, use jump cuts, add on-screen text for key points, sound design and licensed music (YouTube Audio Library or a licensed library), burned-in or uploaded captions. Extract a thumbnail candidate frame when needed:

   ```bash
   ffmpeg -ss 00:01:23 -i final.mp4 -frames:v 1 thumb-candidate.png
   ```

   **Check:** A full watch-through at 1x has no section where you would skip ahead.

6. **Prepare metadata and upload (confirm before publishing).** Description: first two lines summarize value, then links and chapters. Chapters: timestamps starting at `00:00`, at least three, each at least 10 seconds. Upload accurate captions, add an end screen (final 5-20 seconds) and cards, set the audience ("made for kids") correctly, and use the altered or synthetic content disclosure when realistic AI-generated or altered media is shown. Publishing or scheduling is public: get the user's explicit go-ahead on title, thumbnail, visibility and time.

   **Check:** Chapters appear in the player preview and the visibility setting matches what the user approved.

7. **Read analytics.** Review at 48 hours, 7 days and 28 days against your channel's own baseline, not other channels.

   | Signal | Likely cause | Try |
   | :--- | :--- | :--- |
   | Low impressions | Weak topic demand or niche fit | Different angle on a proven topic |
   | Low click-through rate, normal retention | Packaging | New thumbnail or title (one change at a time) |
   | Good CTR, steep drop in first 30 s | Hook does not match the title | Rewrite openings to confirm the promise immediately |
   | Steady mid-video decline | Pacing or padding | Tighter edits, more visual change |
   | Spikes in the retention graph | Rewatched moments | Make more content like that segment |
   | High returning, low new viewers | Little browse or suggested traffic | Broader topics and stronger packaging |

   **Check:** Each review records one hypothesis and one change for the next video.

8. **Add Shorts deliberately.** Vertical 9:16, hook in the first second, one idea, captions, a loopable ending; length limits have changed over time, so check the current maximum. Use Shorts to test topics and point to related long-form videos.

   **Check:** Each Short links to a related long video and its performance is logged.

9. **Automate metadata carefully.** The YouTube Data API (videos, playlists, captions) and the YouTube Analytics API support bulk updates and reports via OAuth; API calls consume daily quota units (check current costs). Changing live videos in bulk needs explicit user confirmation and a dry run listing every change.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Script first, title last | Package first, then script to fulfil it | Unclickable ideas waste a production cycle |
| Clickbait the video cannot deliver | Bold but true promises | Early drop-off and lost trust hurt future reach |
| 60-second intros and channel plugs | Deliver value immediately | Most drop-off happens at the start |
| Change title, thumbnail and topic together | One variable per experiment | You cannot tell what worked |
| Copyrighted music or clips | Licensed music; fair use only with real review | Claims, demonetization, strikes |
| Compare with large channels | Compare with your own baseline | Different audiences and scale |

## Verification checklist

- [ ] Channel promise, viewer and pillars are written down.
- [ ] Every video has title options and a thumbnail concept before scripting.
- [ ] Opening confirms the promise within 30 seconds; pacing reviewed.
- [ ] Chapters, captions, end screen, audience and disclosure settings done.
- [ ] Publishing confirmed by the user; analytics reviews log one change per video.

## Related

- Workflows: `/video-render`, `/marketing-launch`.
- Knowledge: `video-production-pipeline`, `ffmpeg-multimedia`, `remotion-motion-graphics`, `social-media`, `content-marketing`, `ai-image-generation`, `podcast-production`, `copywriting`.
- Agents: `multimedia-producer`, `marketing-strategist`.
