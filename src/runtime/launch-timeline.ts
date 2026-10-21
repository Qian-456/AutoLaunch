import type { LaunchChapter } from '../types'

export type PlaybackView = { chapterIndex: number; elapsedMs: number; finished: boolean }

/** One clock per plan; pause/dispose synchronously clears its only timer. */
export class LaunchTimeline {
  view: PlaybackView = { chapterIndex: 0, elapsedMs: 0, finished: false }
  private timer: ReturnType<typeof setInterval> | null = null
  private fired = new Set<number>()
  private started = 0
  private disposed = false
  private hasStarted = false
  constructor(readonly script: readonly LaunchChapter[], private callbacks: {
    chapter: (chapter: LaunchChapter) => void
    action: (action: LaunchChapter['actions'][number]['action']) => void
    view: (view: PlaybackView) => void
    finished: () => void
    allowed: () => boolean
  }, private now = () => performance.now()) {}
  start() {
    if (this.disposed || this.timer || !this.script.length || this.view.finished) return
    if (this.hasStarted && this.view.chapterIndex < this.script.length - 1) {
      this.view = { chapterIndex: this.view.chapterIndex + 1, elapsedMs: 0, finished: false }
      this.fired.clear()
    }
    this.hasStarted = true
    this.started = this.now() - this.view.elapsedMs
    this.callbacks.chapter(this.script[this.view.chapterIndex])
    this.callbacks.view({ ...this.view })
    this.timer = setInterval(() => this.tick(), 100)
  }
  pause() {
    if (this.timer) {
      this.view.elapsedMs = Math.min(this.script[this.view.chapterIndex].durationMs, this.now() - this.started)
      clearInterval(this.timer); this.timer = null
    }
  }
  dispose() { this.pause(); this.disposed = true }
  private tick() {
    if (!this.callbacks.allowed()) { this.pause(); return }
    const chapter = this.script[this.view.chapterIndex]
    this.view.elapsedMs = this.now() - this.started
    for (const [index, scheduled] of chapter.actions.entries()) {
      if (!this.callbacks.allowed()) { this.pause(); return }
      if (this.view.elapsedMs >= scheduled.atMs && !this.fired.has(index)) {
        this.fired.add(index); this.callbacks.action(scheduled.action)
      }
    }
    if (this.view.elapsedMs >= chapter.durationMs) {
      if (this.view.chapterIndex === this.script.length - 1) {
        this.pause()
        this.view = { ...this.view, elapsedMs: chapter.durationMs, finished: true }
        this.callbacks.view({ ...this.view }); this.callbacks.finished(); return
      }
      this.view = { chapterIndex: this.view.chapterIndex + 1, elapsedMs: 0, finished: false }
      this.started = this.now(); this.fired.clear()
      this.callbacks.chapter(this.script[this.view.chapterIndex])
    }
    this.callbacks.view({ ...this.view })
  }
}
