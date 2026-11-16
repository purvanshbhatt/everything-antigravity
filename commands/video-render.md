# /video-render - Programmatic Video & Multimedia Pipeline

## Purpose
Renders automated motion graphics, product walkthroughs, social media clips, and technical demos using Remotion and FFmpeg.

## Workflow
1. **Composition Setup**: Load composition templates with specified dimensions, frame rate, and asset manifests.
2. **Dynamic Prop Injection**: Inject titles, subtitles, branding colors, and screen recordings via JSON props.
3. **Audio Mixing**: Apply voiceover tracks, background music ducking (-14dB), and SFX hit points.
4. **Encoding & Export**: Execute headless rendering and transcode to optimized H.264 / AV1 video.
