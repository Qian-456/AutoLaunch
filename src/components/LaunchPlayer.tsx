import { useEffect, useRef, useState } from 'react'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { LaunchTimeline, type PlaybackView } from '../runtime/launch-timeline'
import { useExperienceStore } from '../store/experience-store'
import type { LaunchChapter } from '../types'

export type LaunchPlaybackView = PlaybackView
type Props = { active: boolean; onFinished: () => void; script?: readonly LaunchChapter[] }

export function LaunchPlayer({ active, onFinished, script = su7ConceptPack.launchScript }: Props) {
  const [view, setView] = useState<PlaybackView>({ chapterIndex: 0, elapsedMs: 0, finished: false })
  const engine = useRef<LaunchTimeline | null>(null)
  const finishRef = useRef(onFinished)
  finishRef.current = onFinished
  const planId = useExperienceStore((s) => s.planId)
  const playback = useExperienceStore((s) => s.playback)
  useEffect(() => {
    const allowed = () => {
      const state = useExperienceStore.getState()
      return state.planId === planId && state.playback === 'playing'
    }
    const timeline = new LaunchTimeline(script, {
      allowed, view: setView,
      chapter: (ch) => { if (allowed()) dispatchVehicleAction({ type: 'orbit', preset: ch.camera }, 'script') },
      action: (action) => { if (allowed()) {
        const result = dispatchVehicleAction(action, 'script')
        if (!result.ok) useExperienceStore.getState().setNotice(result.message)
      } },
      finished: () => finishRef.current(),
    })
    engine.current = timeline
    setView({ chapterIndex: 0, elapsedMs: 0, finished: false })
    return () => { timeline.dispose(); engine.current = null }
  }, [script, planId])
  useEffect(() => {
    if (active) engine.current?.start()
    else engine.current?.pause()
  }, [active, script, planId])
  const chapter = script[view.chapterIndex]
  if (!chapter || (!active && playback !== 'paused' && !view.finished)) return null
  const total = script.reduce((sum, ch) => sum + ch.durationMs, 0)
  const before = script.slice(0, view.chapterIndex).reduce((sum, ch) => sum + ch.durationMs, 0)
  const progress = Math.min(100, ((before + view.elapsedMs) / total) * 100)
  return <aside className="launch-player" aria-live="polite">
    <div className="launch-player__meta">
      <span>{view.finished ? '发布会完成' : `${active ? '' : '已暂停 · '}CH ${view.chapterIndex + 1} / ${script.length}`}</span>
      <strong>{view.finished ? '您可以自由体验车辆' : chapter.title}</strong>
    </div>
    <p>{view.finished ? '演示已完成，您可自由体验。' : chapter.narration}</p>
    <div className="launch-player__track" role="progressbar" aria-label="发布会进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
      <span style={{ width: `${progress}%` }} />
    </div>
  </aside>
}
