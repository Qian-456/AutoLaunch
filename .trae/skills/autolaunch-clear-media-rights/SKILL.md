---
name: autolaunch-clear-media-rights
description: Audit media licensing, attribution, privacy, and Git exposure for AutoLaunch videos. Use before publishing or committing when checking BGM rights, model attribution, platform copyright risk, local license evidence, API-key leakage, tracked recordings, voice files, subtitles, editing scripts, or generated release artifacts.
---

# AutoLaunch 媒体合规留证

Run this as the final gate after `$autolaunch-edit-release-video`, and run it independently whenever a new music track, model, recording, voice provider, or public distribution channel is introduced.

## Separate permission from ownership

Never describe royalty-free music as ownerless or guarantee that a platform will never issue a fingerprint claim. Confirm the exact item, exact license, permitted distribution channel, attribution requirement, restrictions, and evidence date.

## Music clearance workflow

1. Identify track title, artist, provider, item page, direct downloaded asset when known, and intended use.
2. Read the provider's current official item page, license page, and terms. Do not rely only on a search snippet or third-party summary.
3. Confirm that online video and social-media distribution are permitted. Check monetization separately.
4. Save dated screenshots or PDFs of the item and license pages under ignored `videos/edit-work/licenses/`.
5. Record local filename, byte size, download date, source URLs, intended project, and SHA-256 hash in the same ignored directory.
6. Credit the artist and provider in the description even when attribution is optional.
7. Upload privately or as a draft first when the platform offers automated copyright scanning. Treat a clean scan as risk reduction, not legal proof.

For the current edit, the known record is `Coffee or Tea` by Michael Ramir C. from Mixkit under its Stock Music Free License. Recheck official terms on the publication date instead of copying an old conclusion.

## AutoLaunch attribution gate

The SU7 model remains subject to CC BY-NC-SA 4.0. Every public video, screenshot, page, or README must show:

- Ddiaz Design as author;
- Sketchfab as source;
- CC BY-NC-SA 4.0 as license;
- the non-official concept-demo disclaimer.

Music permission does not remove the model's non-commercial and share-alike restrictions.

## Git privacy audit

Before staging or publishing, run checks equivalent to:

```powershell
git ls-files -- "*.mp4" "*.mkv" "*.mov" "*.wav" "*.mp3" "*.aac" "*.m4a" "*.flac" "*.srt" "*.ass" "*.vtt" "videos/**"
git check-ignore -v "videos/example.mp4" "videos/edit-work/voice_01.wav" ".env"
git diff --check
git status --short
```

Require no media result from `git ls-files`. Verify `.env`, production scripts, narration, subtitles, license snapshots, BGM, recordings, and final renders are ignored. Never read or print a secret merely to prove that it exists.

If a private artifact was already committed, `.gitignore` is insufficient: stop and report that removing it from current tracking does not erase Git history. Do not rewrite shared history without explicit authorization.

## Release decision

Return one of:

- `PASS`: permission, attribution, evidence, and Git privacy checks are complete;
- `PASS WITH RISKS`: use appears permitted but a platform claim or evidence gap remains;
- `FAIL`: source/license cannot be verified, use is outside scope, attribution is missing, or private media is tracked.
