import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import generatedRegistry from '../../public/fallbacks/registry-whitelist.json'
import generatedChapters from '../../public/fallbacks/chapter-pool.json'
import apiFixture from './fixtures/offline-api.json'
import { chapterPool, registry } from '../pack/ai-registry'
import { validateDirector, validateRag, registeredAction, type DirectorResponse, type RagResponse } from '../runtime/ai-contract'
import { localDirector, requestDirector, RequestGate } from '../runtime/ai-client'
import { routeInput } from '../runtime/input-router'
import { LaunchTimeline } from '../runtime/launch-timeline'
import { validateEntityAction, type EntityInstance } from '../runtime/entity-registry'
import { useExperienceStore } from '../store/experience-store'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'

beforeEach(() => {
  useExperienceStore.setState({ playback: 'idle', playbackScript: null, planId: 0, controlEpoch: 0,
    takeoverPromptDismissed: false, showTakeoverPrompt: false, activeActions: new Map(), manualOrbit: false,
    windowProgress: new Map([['driver_front', 0], ['passenger_front', 0], ['driver_rear', 0], ['passenger_rear', 0]]) })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('generated registries exactly match Pack/prop authority', () => {
  expect(generatedRegistry).toEqual(registry)
  expect(generatedChapters).toEqual(chapterPool)
  for (const chapter of chapterPool) {
    expect(registry.cameras).toContain(chapter.camera)
    for (const scheduled of chapter.actions) expect(registeredAction(scheduled.action)).toBe(true)
  }
})

it('accepts actual Python offline responses across the frontend boundary', () => {
  expect(validateDirector(apiFixture.director as DirectorResponse).selection.persona).toBe('family')
  expect(validateRag(apiFixture.rag as RagResponse).linkedActions).toHaveLength(2)
  expect(apiFixture.rag.answer).toContain('454')
  expect(apiFixture.rag.answer).toContain('559')
})

it('routes actual commands first, requirement text and raw voice identically', () => {
  expect(routeInput('打开主驾车窗').kind).toBe('command')
  expect(routeInput('主驾车窗50%').kind).toBe('command')
  for (const text of ['不用介绍性能，看看后备箱和车窗就好。', '一家三口周末出游，看看装东西', '主驾车窗有什么功能？']) {
    expect(routeInput(text)).toEqual({ kind: 'requirement', text })
  }
})

it('validates reviewed whole timelines and rejects modified coordinates/params/narration', () => {
  const response = localDirector('家庭出游', 'test')
  expect(validateDirector(response)).toBe(response)
  const changed = structuredClone(response)
  changed.chapters[0].narration = 'untrusted instructions'
  expect(() => validateDirector(changed)).toThrow()
  expect(() => validateDirector({ ...response, packVersion: 'unknown' })).toThrow()
  expect(() => validateDirector({ ...response, selection: { persona: 'family', chapterIds: ['evil'] } })).toThrow()
  expect(registeredAction({ type: 'window', target: 'driver_front', open: true, progress: 200 })).toBe(false)
  expect(registeredAction({ type: 'trunk', open: true, coordinates: [0, 1, 2] })).toBe(false)
  expect(registeredAction({ type: 'cargo', operation: 'spawn', propId: 'carry_on_20' })).toBe(false)
})

it('rejects RAG actions without applicable evidence', () => {
  const meta = localDirector('家庭出游', 'test')
  expect(() => validateRag({ ...meta, answer: 'invented', citations: [], linkedActions: [{ type: 'trunk', open: true }], suggestedFollowUps: [] })).toThrow()
})

it('does not accept late responses after another request or manual takeover', () => {
  const gate = new RequestGate(() => useExperienceStore.getState().controlEpoch)
  const old = gate.begin(), current = gate.begin()
  expect(old.signal.aborted).toBe(true)
  expect(gate.accepts(old)).toBe(false)
  expect(gate.accepts(current)).toBe(true)
  dispatchVehicleAction({ type: 'lights', target: 'headlight', on: true })
  expect(gate.accepts(current)).toBe(false)
  gate.cancel()
  expect(current.signal.aborted).toBe(true)
})

it('backend unavailable uses an explicitly labeled finite local plan', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
  const result = await requestDirector('一家三口出游', new AbortController().signal)
  expect(result.mode).toBe('fallback')
  expect(result.selection.persona).toBe('family')
  expect(result.fallbackReason).toContain('backend_unavailable')
})

it('aborted generation does not turn into an auto-playing fallback', async () => {
  const controller = new AbortController(); controller.abort()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
  await expect(requestDirector('family', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
})

describe('plan clock and takeover lifecycle', () => {
  function clock(script = chapterPool.slice(0, 2)) {
    const action = vi.fn(), chapter = vi.fn(), finished = vi.fn()
    const id = useExperienceStore.getState().planId
    const timeline = new LaunchTimeline(script, { action, chapter, finished, view: vi.fn(),
      allowed: () => useExperienceStore.getState().planId === id && useExperienceStore.getState().playback === 'playing' }, () => Date.now())
    return { timeline, action, chapter, finished }
  }
  it('manual takeover cancels script actions and only explicit resume advances the next chapter', () => {
    vi.useFakeTimers()
    useExperienceStore.getState().playScript(chapterPool.slice(0, 2))
    const c = clock(); c.timeline.start()
    vi.advanceTimersByTime(2100)
    expect(c.action).toHaveBeenCalledTimes(1)
    const result = dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true, progress: 100 }, 'script')
    useExperienceStore.getState().beginManualOrbit()
    expect(useExperienceStore.getState().playback).toBe('paused')
    if (result.ok && result.actionId) expect(useExperienceStore.getState().activeActions.has(result.actionId)).toBe(false)
    vi.advanceTimersByTime(60_000)
    expect(c.action).toHaveBeenCalledTimes(1)
    expect(useExperienceStore.getState().showTakeoverPrompt).toBe(true)
    useExperienceStore.getState().keepManual()
    useExperienceStore.getState().resumePlayback(); c.timeline.start()
    expect(c.chapter.mock.lastCall?.[0].id).toBe('frameless-windows')
    useExperienceStore.getState().interruptPlayback()
    expect(useExperienceStore.getState().showTakeoverPrompt).toBe(false)
    c.timeline.dispose()
  })
  it('replaced plans and disposed timers cannot dispatch old actions', () => {
    vi.useFakeTimers()
    useExperienceStore.getState().playScript(chapterPool.slice(0, 2))
    const old = clock(); old.timeline.start()
    useExperienceStore.getState().playScript(chapterPool.slice(2, 3))
    vi.advanceTimersByTime(60_000)
    expect(old.action).not.toHaveBeenCalled()
    old.timeline.dispose()
    const next = clock(chapterPool.slice(2, 3)); next.timeline.start(); next.timeline.dispose()
    vi.advanceTimersByTime(60_000)
    expect(next.action).not.toHaveBeenCalled()
  })
  it('manual part control also stops an active scripted turntable', () => {
    useExperienceStore.getState().playScript(chapterPool.slice(3, 4))
    dispatchVehicleAction({ type: 'orbit', preset: 'turntable' }, 'script')
    dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true, progress: 100 })
    expect(useExperienceStore.getState().playback).toBe('paused')
    expect(useExperienceStore.getState().manualOrbit).toBe(true)
    expect(useExperienceStore.getState().cameraControlOwner).toBe('orbit')
    useExperienceStore.getState().resumePlayback()
    useExperienceStore.getState().finishPlayback()
    expect(useExperienceStore.getState().manualOrbit).toBe(true)
  })
  it('empty scripts are harmless and completed scripts never restart themselves', () => {
    vi.useFakeTimers()
    const empty = clock([]); empty.timeline.start()
    useExperienceStore.getState().playScript([])
    expect(useExperienceStore.getState().cameraControlOwner).toBe('orbit')
    vi.advanceTimersByTime(100_000)
    expect(empty.action).not.toHaveBeenCalled()
    useExperienceStore.getState().playScript(chapterPool.slice(0, 1))
    const c = clock(chapterPool.slice(0, 1)); c.timeline.start()
    vi.advanceTimersByTime(60_000); c.timeline.start()
    expect(c.finished).toHaveBeenCalledTimes(1)
    expect(c.action).toHaveBeenCalledTimes(1)
    c.timeline.dispose()
  })
  it('stops pending script cargo transitions on takeover without removing completed user cargo', () => {
    useExperienceStore.setState({ cargoPlacements: new Map() })
    useExperienceStore.getState().playScript(chapterPool.slice(-1))
    const result = dispatchVehicleAction({ type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' }, 'script')
    expect(result.ok).toBe(true)
    expect(useExperienceStore.getState().cargoPlacements.size).toBe(2)
    const placement = [...useExperienceStore.getState().cargoPlacements.values()][0]
    useExperienceStore.getState().setCargoPlacement({ ...placement, state: 'loaded' })
    useExperienceStore.getState().interruptPlayback()
    expect(useExperienceStore.getState().cargoPlacements.size).toBe(1)
    expect(useExperienceStore.getState().cargoPlacements.get(placement.instanceId)?.state).toBe('loaded')
  })
})

it('validates instance identity, supported capabilities, and cross-Pack isolation', () => {
  const command = { packId: registry.packId, entityId: 'prop:carry_on_20', targetInstanceId: 'bag-2',
    actionId: 'cargo:move', action: { type: 'cargo', operation: 'move', instanceId: 'bag-2' } as const }
  const instances: EntityInstance[] = [
    { packId: 'other-pack-fixture', entityId: command.entityId, instanceId: 'bag-1' },
    { packId: registry.packId, entityId: command.entityId, instanceId: 'bag-2', parentInstanceId: 'vehicle:main' },
  ]
  expect(validateEntityAction(command, instances)).toBe(true)
  expect(validateEntityAction({ ...command, targetInstanceId: 'bag-1' }, instances)).toBe(false)
  expect(validateEntityAction({ ...command, targetInstanceId: 'missing' }, instances)).toBe(false)
  expect(validateEntityAction({ ...command, entityId: 'lights_headlight' }, instances)).toBe(false)
})
