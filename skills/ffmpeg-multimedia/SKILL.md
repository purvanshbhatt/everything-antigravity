---
name: ffmpeg-multimedia
description: "Process, transcode, compress, filter, concatenate, and optimize audio and video using FFmpeg and Python wrappers."
---

# FFmpeg Multimedia Engineering

## Overview
Automate audio and video processing, transcoding, format conversions, subtitle burned-in overlays, and high-performance compression pipelines using FFmpeg.

## Essential FFmpeg Recipes
1. **Lossless / High-Efficiency Video Compression (H.265 / AV1)**:
   ```bash
   ffmpeg -i input.mov -c:v libx264 -crf 22 -preset slow -c:a aac -b:a 192k output.mp4
   ```
2. **Crop & Resize for Social Media (9:16 Shorts/Reels)**:
   ```bash
   ffmpeg -i input.mp4 -vf "crop=ih*(9/16):ih,scale=1080:1920" -c:a copy vertical.mp4
   ```
3. **Hardcode Subtitles (Burned-in Ass / Srt)**:
   ```bash
   ffmpeg -i video.mp4 -vf "subtitles=subtitles.srt:force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3'" -c:a copy subtitled.mp4
   ```
4. **Fast Thumbnail Extraction**:
   ```bash
   ffmpeg -ss 00:00:03 -i video.mp4 -frames:v 1 -q:v 2 thumbnail.jpg
   ```
5. **Video Concatenation**:
   ```bash
   ffmpeg -f concat -safe 0 -i filelist.txt -c copy merged.mp4
   ```
