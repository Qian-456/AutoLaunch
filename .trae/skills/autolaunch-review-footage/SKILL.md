---
name: autolaunch-review-footage
description: Inspect and prepare AutoLaunch screen recordings before editing. Use when selecting the newest recording, locating startup stutter, permission or verification popups, dead time, recorder shutdown footage, cursor mistakes, or producing a clean non-destructive source cut from MP4, MKV, or MOV footage.
---

# AutoLaunch 素材验收与裁切

## Guardrails

- Read `AGENTS.md` first and preserve the required attribution and unofficial disclaimer.
- Keep every recording and derivative under ignored `videos/`; confirm with `git check-ignore -v`.
- Never overwrite or delete a source recording. Write a clearly suffixed derivative such as `_clean`, `_trimmed`, or `_smooth-start`.
- Do not infer quality from filename or duration alone. Inspect frames, timing, audio, and the final seconds.

## Workflow

1. Enumerate recordings by modification time and identify the newest plausible source.
2. Use `ffprobe` to record duration, resolution, frame rate, codec, pixel format, and audio streams.
3. Generate low-resolution contact sheets or short proxy clips around:
   - the first 3 seconds;
   - every permission, microphone, or verification interruption;
   - the final 10 seconds.
4. Build a cut list in source timecode. Mark each interval as keep, remove, or repair.
5. Render to a new file. Prefer stream copy only when cuts land safely on keyframes; otherwise re-encode H.264 with `yuv420p`.
6. Probe the derivative and visually inspect the first second, every edit boundary, and the last second.

## AutoLaunch-specific repairs

### Opening stutter

Do not merely cut to another unstable frame. Find the first visually stable frame, clone it for roughly 0.8–1.3 seconds, add a short 0.2–0.3 second fade, then continue from that stable source time. Recalculate audio timing deliberately; do not let video-only trimming shift narration.

For the known August 3 edit, the successful shape was:

```text
stable frame near 1.3 s -> cloned hold about 1.28 s -> short fade -> source continues at 1.3 s
```

Treat those values as a reference, not a universal constant.

### Popups and recorder shutdown

- Remove the whole visual interruption, including cursor travel into and out of it.
- Prefer a clean jump cut at a camera or chapter transition.
- Remove the trailing stop-recording interaction completely.
- If narration crosses a removed interval, rebuild that audio transition in the final edit rather than cutting words.

## Acceptance gate

- Opening has no one-frame jump, repeated countdown glitch, or black flash.
- No permission, verification, desktop, recorder UI, or stop-recording content remains.
- Cursor is present only during intentional takeover/control demonstrations.
- Audio stays synchronized across every cut.
- The original recording remains unchanged and the derivative is Git-ignored.
