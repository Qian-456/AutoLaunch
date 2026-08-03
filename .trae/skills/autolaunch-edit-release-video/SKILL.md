---
name: autolaunch-edit-release-video
description: Assemble and quality-check an AutoLaunch release video from clean footage, segmented narration, subtitles, and licensed background music. Use for FFmpeg timing, opening repair, audio mixing, loudness normalization, Bilibili-compatible encoding, subtitle verification, output naming, or diagnosing glitches in a rendered MP4.
---

# AutoLaunch 成片剪辑与质检

## Skill routing

- Invoke `$autolaunch-review-footage` first when the input is an unreviewed screen recording.
- Invoke `$autolaunch-generate-voiceover` when narration must be generated or replaced.
- Invoke `$autolaunch-clear-media-rights` before any public upload or Git handoff.

## Inputs

Require explicit paths for the clean source video, ordered narration clips, subtitle source when applicable, licensed BGM, filter graph, and output file. Keep all inputs and output beneath ignored `videos/`. Fail early if any required input is missing.

## Build the timeline

1. Lock picture timing before final narration placement.
2. Express narration starts as explicit millisecond delays in a filter graph.
3. Loop or trim BGM to picture duration; fade it in and out.
4. Keep BGM subordinate to narration. The successful AutoLaunch mix used BGM near `0.095` and voice near `1.15`, but measure and listen before reusing these values.
5. Mix, limit, then normalize near `I=-16 LUFS`, `TP=-1.5 dB`, `LRA=11` for online video.
6. Burn subtitles only from the approved final script, or verify that existing in-app captions remain readable and synchronized.
7. Apply the opening hold/fade repair from `$autolaunch-review-footage` before the main timeline when the source has the known first-second jump.

## Encode

Use a broadly compatible release profile unless the destination requires otherwise:

```text
video: H.264, CRF 18, medium preset, 60 fps, yuv420p
audio: AAC, 192 kbps, 48 kHz
container: MP4 with +faststart
```

Write a new output filename; never overwrite source footage or the last approved render.

## Quality control

Run `ffprobe` and verify:

- expected duration, dimensions, 60 fps, H.264 video, AAC audio, and 48 kHz sample rate;
- no audio stream unexpectedly copied from the raw recording;
- no black frame, frozen glitch, or visible jump at the opening;
- narration begins on the intended visual beats and never overlaps another segment accidentally;
- subtitles have safe margins, correct Chinese punctuation, and no one-frame flashes;
- BGM is audible in silent gaps but does not mask speech;
- the final two seconds contain no recorder controls or abrupt audio truncation.

Inspect representative frames at the opening, each chapter boundary, each manual takeover, and the ending. Listen on both headphones and ordinary speakers before approval.

## Handoff

Report the exact output path, duration, codec/profile, measured loudness when available, source files used, repairs applied, and any interval not visually or audibly verified.
