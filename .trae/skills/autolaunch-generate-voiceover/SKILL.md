---
name: autolaunch-generate-voiceover
description: Generate segmented Chinese AI narration for AutoLaunch with DashScope while keeping credentials and production artifacts local. Use when drafting narration segments, tuning an overly synthetic voice, regenerating WAV clips, aligning voice timing, or recreating the ignored local TTS helper without exposing secrets or media in the open-source repository.
---

# AutoLaunch AI 旁白生成

## Privacy boundary

- Keep `.env`, narration JSON, synthesis scripts, caches, WAV files, and generated audio under Git ignore rules.
- Never use a `VITE_` prefix for a server-side API key and never print the key.
- Do not add local voice-generation commands to public `package.json` or TTS settings to public `.env.example`.
- If the ignored helper is absent, recreate it locally at `scripts/generate-dashscope-voiceover.py`; do not stage it.

## Input contract

Use an ignored UTF-8 JSON array:

```json
[
  {"File": "voice_01.wav", "Text": "这里是第一段旁白。"},
  {"File": "voice_02.wav", "Text": "这里是第二段旁白。"}
]
```

Require non-empty `File` and `Text`, deterministic ordering, and unique filenames. Split by edit point or chapter; avoid one long narration file.

## Workflow

1. Read the final picture timing before changing text.
2. Edit for natural spoken Chinese: short clauses, restrained adjectives, and intentional pauses.
3. Load `DASHSCOPE_API_KEY` only from the process environment or ignored project `.env`.
4. Keep model and voice versions compatible. Prefer a natural, restrained technology-creator delivery over broadcast or customer-service intonation.
5. Run a dry pass that prints filenames and text but makes no API call.
6. Synthesize each segment independently with retry and skip-existing behavior.
7. Validate every output with `ffprobe`; reject empty, tiny, clipped, or wrong-format files.
8. Listen to the first, longest, and most emotional segment before rendering all clips.

Recommended defaults from the successful local workflow are 24 kHz WAV, moderate volume, speech rate near `0.95`, neutral pitch, and a fixed seed. Adjust by listening rather than treating defaults as requirements.

## Voice quality rules

- Rewrite text before applying extreme speed or pitch changes.
- Preserve product terms such as `VehicleAction`, `Product Pack`, and `3D READY`; add phonetic spacing only when necessary.
- Regenerate a weak segment instead of processing the whole narration destructively.
- Leave short silence between clauses; do not pack every visual beat with speech.

## Acceptance gate

- No key or workspace identifier appears in logs, diffs, browser bundles, or tracked files.
- Every requested segment exists, is decodable, and matches its script.
- Voice sounds consistent across segments and avoids obvious announcement-style cadence.
- Generated files and helper scripts pass `git check-ignore -v`.
