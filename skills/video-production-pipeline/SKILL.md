---
name: video-production-pipeline
description: "Orchestrate end-to-end video creation: scriptwriting, automated voice synthesis, storyboard sequencing, and post-production rendering."
---

# Video Production & Automation Pipeline

## Overview
Automate full lifecycle video production from written brief to final encoded MP4 ready for social distribution or documentation tutorials.

## The 5-Stage Pipeline
1. **Script & Storyboard**:
   - Structure: The Hook (0-5s), The Problem (5-20s), The Solution & Demo (20-60s), Key Takeaways (60-80s), Call To Action (80-90s).
   - Annotate visual cues, screen recordings, and graphic overlays for every spoken line.
2. **Audio & Voiceover Generation**:
   - Synthesize lifelike speech via Google Cloud Text-to-Speech or ElevenLabs API.
   - Generate word-level timestamp alignments for precise caption synchronization.
3. **Asset Gathering & Screen Capture**:
   - Record UI flows headlessly via Playwright/Puppeteer or automated CLI terminal casting (`asciinema`).
4. **Assembly & Remotion / FFmpeg Stitching**:
   - Combine audio tracks, background music (ducked by -14dB during voiceover), video clips, and motion titles.
5. **Quality Review**:
   - Check sync accuracy, audio clipping, and color contrast.
