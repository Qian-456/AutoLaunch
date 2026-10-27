import { beforeEach, describe, expect, it } from 'vitest'
import { parseCommand } from '../runtime/command-parser'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { useExperienceStore } from '../store/experience-store'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import type { WindowTarget } from '../types'
import { Object3D } from 'three'
import {
  resolveVehicleTargetFromHit,
  resolveVehicleTargetFromIntersections,
  resolveWindowTargetFromHit,
} from '../runtime/window-hit-target'
import { windowOpacityForProgress } from '../components/VehicleModel'

describe('window glass concealment', () => {
  it('keeps the glass opaque above the door and fully hides it when open', () => {
    expect(windowOpacityForProgress(0, 0.72)).toBeCloseTo(0.72)
    expect(windowOpacityForProgress(68, 0.72)).toBeCloseTo(0.72)
    expect(windowOpacityForProgress(84, 0.72)).toBeGreaterThan(0)
    expect(windowOpacityForProgress(84, 0.72)).toBeLessThan(0.72)
    expect(windowOpacityForProgress(100, 0.72)).toBe(0)
  })
})

describe('rear hatch moving assembly', () => {
  it('keeps the rear badges attached to the opening hatch', () => {
    expect(su7ConceptPack.actions.hatch_rear.movingNodeIds).toContain('rear_badges')
    expect(su7ConceptPack.nodeMap.rear_badges).toBeTruthy()
  })
})

describe('cargo camera composition', () => {
  it('uses a centred rear view instead of locking the user into a side angle', () => {
    const cargoRear = su7ConceptPack.orbitActions.cargo_rear
    expect(cargoRear.position[0]).toBeGreaterThan(cargoRear.target[0])
    expect(cargoRear.position[2]).toBe(0)
    expect(cargoRear.target[2]).toBe(0)
  })
})

describe('registered VehicleAction pipeline', () => {
  beforeEach(() => {
    useExperienceStore.setState({
      activeOrbitPreset: 'hero_front_left',
      stageMode: 'studio',
      orbitRequestId: 0,
      manualOrbit: false,
      notice: null,
      inputMode: { text: true, voice: 'unsupported' },
      vehiclePartStates: new Map([
        ['window_driver_front', 'closed'],
        ['window_passenger_front', 'closed'],
        ['window_driver_rear', 'closed'],
        ['window_passenger_rear', 'closed'],
        ['trunk', 'closed'],
      ]),
      windowProgress: new Map<Exclude<WindowTarget, 'all'>, number>([
        ['driver_front', 0],
        ['passenger_front', 0],
        ['driver_rear', 0],
        ['passenger_rear', 0],
      ]),
      lightStates: new Map([
        ['headlight', false],
        ['taillight', false],
      ]),
      activeActions: new Map(),
      lastActionOutcome: null,
    })
  })

  it('parses deterministic orbit commands', () => {
    expect(parseCommand('参考图 视角')).toEqual({
      matched: true,
      action: { type: 'orbit', preset: 'hero_front_left' },
    })
    expect(parseCommand('旋转一圈')).toEqual({
      matched: true,
      action: { type: 'orbit', preset: 'turntable' },
    })
  })

  it('parses window commands for all four windows', () => {
    expect(parseCommand('打开主驾车窗')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_front', open: true, progress: 100 },
    })
    expect(parseCommand('打开副驾车窗')).toEqual({
      matched: true,
      action: { type: 'window', target: 'passenger_front', open: true, progress: 100 },
    })
    expect(parseCommand('打开主驾后车窗')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_rear', open: true, progress: 100 },
    })
    expect(parseCommand('打开副驾后车窗')).toEqual({
      matched: true,
      action: { type: 'window', target: 'passenger_rear', open: true, progress: 100 },
    })
  })

  it('parses window commands with percentage progress', () => {
    expect(parseCommand('主驾车窗打开50%')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_front', open: true, progress: 50 },
    })
    expect(parseCommand('副驾车窗降到30%')).toEqual({
      matched: true,
      action: { type: 'window', target: 'passenger_front', open: true, progress: 30 },
    })
    expect(parseCommand('主驾后窗70%')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_rear', open: true, progress: 70 },
    })
    expect(parseCommand('副驾后车窗关闭0%')).toEqual({
      matched: true,
      action: { type: 'window', target: 'passenger_rear', open: false, progress: 0 },
    })
  })

  it('parses natural spoken window progress phrases', () => {
    expect(parseCommand('主驾驶车窗开一半')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_front', open: true, progress: 50 },
    })
    expect(parseCommand('车窗打开百分之五十')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_front', open: true, progress: 50 },
    })
    expect(parseCommand('副驾驶车窗降到三成')).toEqual({
      matched: true,
      action: { type: 'window', target: 'passenger_front', open: true, progress: 30 },
    })
    expect(parseCommand('主驾车窗打开百分之七十五')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_front', open: true, progress: 75 },
    })
    expect(parseCommand('打开５０％')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_front', open: true, progress: 50 },
    })
  })

  it('parses bulk window commands (全部车窗)', () => {
    expect(parseCommand('全部车窗打开')).toEqual({
      matched: true,
      action: { type: 'window', target: 'all', open: true, progress: 100 },
    })
    expect(parseCommand('所有车窗关闭')).toEqual({
      matched: true,
      action: { type: 'window', target: 'all', open: false, progress: 0 },
    })
    expect(parseCommand('全车车窗50%')).toEqual({
      matched: true,
      action: { type: 'window', target: 'all', open: true, progress: 50 },
    })
  })

  it('parses trunk and light commands into VehicleAction', () => {
    expect(parseCommand('开后备箱')).toEqual({ matched: true, action: { type: 'trunk', open: true } })
    expect(parseCommand('开灯')).toEqual({
      matched: true,
      action: { type: 'lights', target: 'headlight', on: true },
    })
    expect(parseCommand('刹车灯')).toEqual({
      matched: true,
      action: { type: 'lights', target: 'taillight', on: true },
    })
  })

  it('returns the fixed vehicle-action suggestion for unknown commands', () => {
    expect(parseCommand('起飞')).toEqual({
      matched: false,
      suggestion: '暂不支持该命令，请尝试：打开主驾车窗、打开主驾车门、打开前备箱',
    })
  })

  it('dispatches a registered orbit preset into the domain store', () => {
    const result = dispatchVehicleAction({ type: 'orbit', preset: 'driver_side' })
    expect(result.ok).toBe(true)
    expect(useExperienceStore.getState().activeOrbitPreset).toBe('driver_side')
    expect(useExperienceStore.getState().orbitRequestId).toBe(1)
  })

  it('keeps a repeated target idempotent while an action is running', () => {
    const first = dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true, progress: 100 })
    const firstActions = useExperienceStore.getState().activeActions
    const second = dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true, progress: 100 })
    expect(first.ok).toBe(true)
    expect(second).toMatchObject({ ok: true })
    expect(firstActions.size).toBe(1)
    expect(useExperienceStore.getState().activeActions.size).toBe(1)
  })

  it('cancels the previous action when a conflict-group target reverses', () => {
    dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true, progress: 100 })
    const firstId = [...useExperienceStore.getState().activeActions.keys()][0]
    dispatchVehicleAction({ type: 'window', target: 'driver_front', open: false, progress: 0 })
    const activeActions = useExperienceStore.getState().activeActions
    expect(activeActions.size).toBe(1)
    expect(activeActions.has(firstId)).toBe(false)
    expect([...activeActions.values()][0].targetValue).toBe(false)
    expect(useExperienceStore.getState().lastActionOutcome).toEqual({ id: firstId, status: 'cancelled' })
  })

  it('stores window progress percentage after completion', () => {
    const result = dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true, progress: 65 })
    if (!result.ok || !result.actionId) throw new Error('expected an action id')
    useExperienceStore.getState().finishAction(result.actionId, 'completed')
    expect(useExperienceStore.getState().windowProgress.get('driver_front')).toBe(65)
    expect(useExperienceStore.getState().vehiclePartStates.get('window_driver_front')).toBe('open')
  })

  it('commits the domain state only after runtime completion', () => {
    const result = dispatchVehicleAction({ type: 'lights', target: 'headlight', on: true })
    expect(useExperienceStore.getState().lightStates.get('headlight')).toBe(false)
    if (!result.ok || !result.actionId) throw new Error('expected an action id')
    useExperienceStore.getState().finishAction(result.actionId, 'completed')
    expect(useExperienceStore.getState().lightStates.get('headlight')).toBe(true)
    expect(useExperienceStore.getState().lastActionOutcome).toEqual({ id: result.actionId, status: 'completed' })
  })

  it('routes trunk actions to the registered real multi-mesh hatch', () => {
    const result = dispatchVehicleAction({ type: 'trunk', open: true })
    expect(result.ok).toBe(true)
    expect(useExperienceStore.getState().activeOrbitPreset).toBe('hero_front_left')
    expect(useExperienceStore.getState().orbitRequestId).toBe(0)
    expect(su7ConceptPack.nodeMap.trunk).toBe(su7ConceptPack.nodeMap.trunk_outer_upper)
    expect(su7ConceptPack.actions.hatch_rear.movingNodeIds).toEqual([
      'trunk_outer_upper',
      'trunk_outer_lip',
      'trunk_inner_liner',
      'rear_badges',
      'trunk_spoiler_base',
      'trunk_spoiler',
      'trunk_spoiler_support',
      'trunk_taillight_lens',
      'trunk_taillight_housing',
      'trunk_taillight_emitter',
    ])
    expect(su7ConceptPack.nodeMap.trunk_taillight_lens).toBe(su7ConceptPack.nodeMap.taillight_right)
    expect(su7ConceptPack.actions.hatch_rear.movingNodeIds).not.toContain('taillight_left')
    expect(su7ConceptPack.actions.trunk.mode).toBe('real-mesh')
  })

  it('keeps the current camera when lights or registered parts are operated', () => {
    useExperienceStore.getState().requestOrbit('driver_side')
    const requestId = useExperienceStore.getState().orbitRequestId
    dispatchVehicleAction({ type: 'lights', target: 'taillight', on: true })
    dispatchVehicleAction({ type: 'trunk', open: true })
    dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true, progress: 100 })

    expect(useExperienceStore.getState().activeOrbitPreset).toBe('driver_side')
    expect(useExperienceStore.getState().orbitRequestId).toBe(requestId)
  })

  it('reverses the real hatch smoothly through the rear conflict group', () => {
    const opening = dispatchVehicleAction({ type: 'trunk', open: true })
    if (!opening.ok || !opening.actionId) throw new Error('expected opening action id')
    const closing = dispatchVehicleAction({ type: 'trunk', open: false })
    if (!closing.ok || !closing.actionId) throw new Error('expected closing action id')

    const activeActions = useExperienceStore.getState().activeActions
    expect(activeActions.size).toBe(1)
    expect(activeActions.has(opening.actionId)).toBe(false)
    expect(activeActions.get(closing.actionId)?.targetValue).toBe(false)
    expect(useExperienceStore.getState().lastActionOutcome).toEqual({
      id: opening.actionId,
      status: 'cancelled',
    })
  })

  it('product pack contains all four window definitions', () => {
    const packWindows = Object.keys(su7ConceptPack.actions).filter((k) => k.startsWith('window_'))
    expect(packWindows).toContain('window_driver_front')
    expect(packWindows).toContain('window_passenger_front')
    expect(packWindows).toContain('window_driver_rear')
    expect(packWindows).toContain('window_passenger_rear')
  })

  it('switches the presentation stage without creating another action path', () => {
    useExperienceStore.getState().setStageMode('launch')
    expect(useExperienceStore.getState().stageMode).toBe('launch')
    expect(useExperienceStore.getState().activeActions.size).toBe(0)
  })

  it('keeps the launch timeline active when the user takes over the camera', () => {
    useExperienceStore.getState().setStageMode('launch')
    useExperienceStore.getState().requestOrbit('rear_three_quarter')
    useExperienceStore.getState().beginManualOrbit()

    expect(useExperienceStore.getState().stageMode).toBe('launch')
    expect(useExperienceStore.getState().manualOrbit).toBe(true)
    expect(useExperienceStore.getState().cameraControlOwner).toBe('orbit')
  })

  it('registers a real 90-second four-chapter launch script', () => {
    expect(su7ConceptPack.orbitActions.turntable.autoRotateSpeed).toBe(2.25)
    expect(su7ConceptPack.launchScript).toHaveLength(4)
    expect(su7ConceptPack.launchScript.reduce((sum, chapter) => sum + chapter.durationMs, 0)).toBe(90_000)
    expect(su7ConceptPack.launchScript.map((chapter) => chapter.camera)).toEqual([
      'front',
      'driver_side',
      'rear_three_quarter',
      'turntable',
    ])
    expect(su7ConceptPack.launchScript.some((chapter) => chapter.actions.some(({ action }) => action.type === 'trunk'))).toBe(true)
  })

  it('registers a compact recording timeline that reuses VehicleAction', () => {
    expect(su7ConceptPack.recordingScript).toHaveLength(6)
    expect(su7ConceptPack.recordingScript.reduce((sum, chapter) => sum + chapter.durationMs, 0)).toBe(69_000)
    const actionTypes = new Set(su7ConceptPack.recordingScript.flatMap((chapter) => (
      chapter.actions.map(({ action }) => action.type)
    )))
    expect(actionTypes).toEqual(new Set(['trunk', 'window', 'lights']))
    expect(su7ConceptPack.recordingScript.every((chapter) => chapter.narration.length > 0)).toBe(true)
  })

  it('maps a clicked child mesh back to its Product Pack window target', () => {
    const windowNode = new Object3D()
    windowNode.name = su7ConceptPack.nodeMap.window_driver_front
    const raycastChild = new Object3D()
    windowNode.add(raycastChild)

    expect(resolveWindowTargetFromHit(raycastChild, su7ConceptPack.nodeMap)).toBe('driver_front')
    expect(resolveWindowTargetFromHit(new Object3D(), su7ConceptPack.nodeMap)).toBeNull()
  })

  it('keeps the closed window aperture clickable after the glass moves away', () => {
    const fixedHitTarget = new Object3D()
    fixedHitTarget.userData.windowTarget = 'driver_front'
    expect(resolveVehicleTargetFromHit(
      fixedHitTarget,
      su7ConceptPack.nodeMap,
      su7ConceptPack.actions.hatch_rear.movingNodeIds,
    )).toEqual({ type: 'window', target: 'driver_front' })
  })

  it('treats the closest non-interactive body panel as an occluder', () => {
    const visibleBody = new Object3D()
    visibleBody.name = 'visible-body-panel'
    const hiddenPassengerDoor = new Object3D()
    hiddenPassengerDoor.userData.doorTarget = 'passenger_rear'

    expect(resolveVehicleTargetFromIntersections(
      [
        { distance: 2, object: hiddenPassengerDoor },
        { distance: 1, object: visibleBody },
      ],
      su7ConceptPack.nodeMap,
      su7ConceptPack.actions.hatch_rear.movingNodeIds,
    )).toBeNull()
  })

  it('keeps glass interaction ahead of its inherited door marker', () => {
    const window = new Object3D()
    window.name = su7ConceptPack.nodeMap.window_driver_front
    window.userData.doorTarget = 'driver_front'

    expect(resolveVehicleTargetFromHit(
      window,
      su7ConceptPack.nodeMap,
      su7ConceptPack.actions.hatch_rear.movingNodeIds,
    )).toEqual({ type: 'window', target: 'driver_front' })
  })

  it('uses visible rear-surface order for the light strip and XIAOMI badge', () => {
    const badge = new Object3D()
    badge.name = su7ConceptPack.nodeMap.rear_badges
    const lightStrip = new Object3D()
    lightStrip.name = su7ConceptPack.nodeMap.taillight_left
    const movingIds = su7ConceptPack.actions.hatch_rear.movingNodeIds

    expect(resolveVehicleTargetFromIntersections(
      [{ distance: 1, object: badge }, { distance: 2, object: lightStrip }],
      su7ConceptPack.nodeMap,
      movingIds,
    )).toEqual({ type: 'trunk' })
    expect(resolveVehicleTargetFromIntersections(
      [{ distance: 1, object: lightStrip }, { distance: 2, object: badge }],
      su7ConceptPack.nodeMap,
      movingIds,
    )).toEqual({ type: 'lights', target: 'taillight' })
  })

  it('maps registered headlight, taillight and hatch meshes to direct-click targets', () => {
    const headlight = new Object3D()
    headlight.name = su7ConceptPack.nodeMap.headlight_left
    const taillight = new Object3D()
    taillight.name = su7ConceptPack.nodeMap.taillight_left
    const hatch = new Object3D()
    hatch.name = su7ConceptPack.nodeMap.trunk_outer_upper
    const movingIds = su7ConceptPack.actions.hatch_rear.movingNodeIds

    expect(resolveVehicleTargetFromHit(headlight, su7ConceptPack.nodeMap, movingIds)).toEqual({ type: 'lights', target: 'headlight' })
    expect(resolveVehicleTargetFromHit(taillight, su7ConceptPack.nodeMap, movingIds)).toEqual({ type: 'lights', target: 'taillight' })
    expect(resolveVehicleTargetFromHit(hatch, su7ConceptPack.nodeMap, movingIds)).toEqual({ type: 'trunk' })
  })

  it('uses the corrected driver/passenger side node mapping', () => {
    expect(su7ConceptPack.nodeMap.window_driver_front).toContain('Side_2')
    expect(su7ConceptPack.nodeMap.window_passenger_front).toContain('Side_1')
    expect(su7ConceptPack.nodeMap.window_driver_rear).toContain('Side_1')
    expect(su7ConceptPack.nodeMap.window_passenger_rear).toContain('Side_2')
    expect(su7ConceptPack.orbitActions.driver_side.position[2]).toBeGreaterThan(0)
  })

  it('keeps model-specific corrections and vehicle actions inside the Product Pack', () => {
    expect(su7ConceptPack.appearance.hiddenNodes).toContain('XiaomicarPlate_carPlate_aaa_Details_0')
    expect(su7ConceptPack.appearance.plates.map((plate) => plate.id)).toEqual(['front', 'rear'])
    expect(su7ConceptPack.appearance.materialOverrides.find((item) => item.material === 'CarPaint')).toMatchObject({
      color: '#d8d8d2',
      removeColorMap: false,
      clearcoat: 0.85,
    })
    expect(su7ConceptPack.actions.window_driver_front).toMatchObject({ durationMs: 900, conflictGroup: 'window_driver_front' })
    expect(su7ConceptPack.actions.lights_headlight.conflictGroup).toBe('lights_front')
    expect(su7ConceptPack.actions.lights_taillight.conflictGroup).toBe('lights_rear')
    expect(Object.keys(su7ConceptPack.nodeMap)).toEqual(expect.arrayContaining([
      'window_driver_front',
      'window_passenger_front',
      'window_driver_rear',
      'window_passenger_rear',
      'trunk',
    ]))
  })
})
