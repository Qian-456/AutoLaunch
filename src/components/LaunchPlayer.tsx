import { useEffect, useMemo, useRef, useState } from 'react'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { useExperienceStore } from '../store/experience-store'
import type { LaunchChapter } from '../types'

type LaunchPlayerProps = {
  active: boolean
  onFinished: () => void
  script?: readonly LaunchChapter[]
}

export type LaunchPlaybackView = {
  chapterIndex: number
  elapsedMs: number
  finished: boolean
}

export function LaunchPlayer({ active, onFinished, script = su7ConceptPack.launchScript }: LaunchPlayerProps) {
  const [view, setView] = useState<LaunchPlaybackView>({ chapterIndex: 0, elapsedMs: 0, finished: false })
  const firedActions = useRef(new Set<number>())
  const chapterStartedAt = useRef(0)
  const requestOrbit = useExperienceStore((state) => state.requestOrbit)
  const manualOrbit = useExperienceStore((state) => state.manualOrbit)
  const chapter = script[view.chapterIndex]
  const totalDurationMs = useMemo(
    () => script.reduce((sum, item) => sum + item.durationMs, 0),
    [script],
  )
  const elapsedBeforeChapter = useMemo(
    () => script.slice(0, view.chapterIndex).reduce((sum, item) => sum + item.durationMs, 0),
    [script, view.chapterIndex],
  )

  useEffect(() => {
    if (active && !manualOrbit) requestOrbit(chapter.camera)
  }, [active, chapter.camera, manualOrbit, requestOrbit])

  useEffect(() => {
    if (!active) {
      setView({ chapterIndex: 0, elapsedMs: 0, finished: false })
      return
    }
    firedActions.current = new Set()
    chapterStartedAt.current = performance.now()

    const timer = window.setInterval(() => {
      const elapsedMs = performance.now() - chapterStartedAt.current
      chapter.actions.forEach((scheduled, index) => {
        if (elapsedMs >= scheduled.atMs && !firedActions.current.has(index)) {
          firedActions.current.add(index)
          dispatchVehicleAction(scheduled.action)
        }
      })

      if (elapsedMs >= chapter.durationMs) {
        const isLast = view.chapterIndex === script.length - 1
        if (isLast) {
          window.clearInterval(timer)
          setView((current) => ({ ...current, elapsedMs: chapter.durationMs, finished: true }))
          onFinished()
        } else {
          setView({ chapterIndex: view.chapterIndex + 1, elapsedMs: 0, finished: false })
        }
        return
      }
      setView((current) => ({ ...current, elapsedMs }))
    }, 100)

    return () => window.clearInterval(timer)
  }, [active, chapter, onFinished, script.length, view.chapterIndex])

  if (!active && !view.finished) return null

  const progress = Math.min(100, ((elapsedBeforeChapter + view.elapsedMs) / totalDurationMs) * 100)
  return (
    <aside className="launch-player" aria-live="polite">
      <div className="launch-player__meta">
        <span>{view.finished ? '发布会完成' : `CH ${view.chapterIndex + 1} / ${script.length}`}</span>
        <strong>{view.finished ? '您可以自由体验车辆' : chapter.title}</strong>
      </div>
      <p>{view.finished ? '点击车辆部件或退出发布会模式继续探索。' : chapter.narration}</p>
      <div className="launch-player__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </aside>
  )
}
