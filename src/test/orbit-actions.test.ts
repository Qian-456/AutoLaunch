import { beforeEach, describe, expect, it } from 'vitest'
import { parseCommand } from '../runtime/command-parser'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { useExperienceStore } from '../store/experience-store'
import { su7ConceptPack } from '../pack/su7-concept.pack'

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
        ['trunk', 'closed'],
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

  it('parses window, trunk and light commands into VehicleAction', () => {
    expect(parseCommand('打开主驾车窗')).toEqual({
      matched: true,
      action: { type: 'window', target: 'driver_front', open: true },
    })
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
      suggestion: '暂不支持该命令，请尝试：打开主驾车窗、打开后备箱、开灯',
    })
  })

  it('dispatches a registered orbit preset into the domain store', () => {
    const result = dispatchVehicleAction({ type: 'orbit', preset: 'driver_side' })
    expect(result.ok).toBe(true)
    expect(useExperienceStore.getState().activeOrbitPreset).toBe('driver_side')
    expect(useExperienceStore.getState().orbitRequestId).toBe(1)
  })

  it('keeps a repeated target idempotent while an action is running', () => {
    const first = dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true })
    const firstActions = useExperienceStore.getState().activeActions
    const second = dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true })
    expect(first.ok).toBe(true)
    expect(second).toMatchObject({ ok: true, message: '主驾车窗打开动作正在执行' })
    expect(firstActions.size).toBe(1)
    expect(useExperienceStore.getState().activeActions.size).toBe(1)
  })

  it('cancels the previous action when a conflict-group target reverses', () => {
    dispatchVehicleAction({ type: 'window', target: 'driver_front', open: true })
    const firstId = [...useExperienceStore.getState().activeActions.keys()][0]
    dispatchVehicleAction({ type: 'window', target: 'driver_front', open: false })
    const activeActions = useExperienceStore.getState().activeActions
    expect(activeActions.size).toBe(1)
    expect(activeActions.has(firstId)).toBe(false)
    expect([...activeActions.values()][0].targetValue).toBe(false)
    expect(useExperienceStore.getState().lastActionOutcome).toEqual({ id: firstId, status: 'cancelled' })
  })

  it('commits the domain state only after runtime completion', () => {
    const result = dispatchVehicleAction({ type: 'lights', target: 'headlight', on: true })
    expect(useExperienceStore.getState().lightStates.get('headlight')).toBe(false)
    if (!result.ok || !result.actionId) throw new Error('expected an action id')
    useExperienceStore.getState().finishAction(result.actionId, 'completed')
    expect(useExperienceStore.getState().lightStates.get('headlight')).toBe(true)
    expect(useExperienceStore.getState().lastActionOutcome).toEqual({ id: result.actionId, status: 'completed' })
  })

  it('uses the registered rear-camera fallback for the unmapped trunk hatch', () => {
    const result = dispatchVehicleAction({ type: 'trunk', open: true })
    expect(result.ok).toBe(true)
    expect(useExperienceStore.getState().activeOrbitPreset).toBe('rear_three_quarter')
    expect(useExperienceStore.getState().notice).toContain('没有完整尾门节点')
    expect(su7ConceptPack.nodeMap.trunk).toBe('UNMAPPED_TRUNK_HATCH')
    expect(su7ConceptPack.actions.trunk.mode).toBe('fallback')
  })

  it('keeps 360-degree rotation explicit and stops it on manual drag', () => {
    dispatchVehicleAction({ type: 'orbit', preset: 'turntable' })
    expect(useExperienceStore.getState().notice).toBe('已启动 360° 展台环绕')
    useExperienceStore.getState().beginManualOrbit()
    expect(useExperienceStore.getState().manualOrbit).toBe(true)
    expect(useExperienceStore.getState().activeOrbitPreset).toBe('turntable')
    expect(su7ConceptPack.orbitActions.turntable.autoRotateSpeed).toBe(2.25)
  })

  it('switches the presentation stage without creating another action path', () => {
    useExperienceStore.getState().setStageMode('launch')
    expect(useExperienceStore.getState().stageMode).toBe('launch')
    expect(useExperienceStore.getState().activeActions.size).toBe(0)
  })

  it('keeps model-specific corrections and vehicle actions inside the Product Pack', () => {
    expect(su7ConceptPack.appearance.hiddenNodes).toContain('XiaomicarPlate_carPlate_aaa_Details_0')
    expect(su7ConceptPack.appearance.plates.map((plate) => plate.id)).toEqual(['front', 'rear'])
    expect(su7ConceptPack.appearance.materialOverrides.find((item) => item.material === 'CarPaint')).toMatchObject({
      color: '#ffffff',
      removeColorMap: false,
    })
    expect(su7ConceptPack.actions.window_driver_front).toMatchObject({ durationMs: 800, conflictGroup: 'windows' })
    expect(su7ConceptPack.actions.lights_headlight.conflictGroup).toBe('lights_front')
    expect(su7ConceptPack.actions.lights_taillight.conflictGroup).toBe('lights_rear')
    expect(su7ConceptPack.actions.lights_headlight.emissiveNodes).toHaveLength(4)
    expect(su7ConceptPack.actions.lights_taillight.emissiveNodes).toHaveLength(0)
    expect(su7ConceptPack.actions.lights_headlight.emissiveIntensity[1]).toBeGreaterThanOrEqual(5)
    expect(su7ConceptPack.actions.lights_taillight.emissiveIntensity[1]).toBeGreaterThan(2)
    expect(su7ConceptPack.actions.lights_headlight.lensEmissiveIntensity[1]).toBeLessThan(1)
    expect(su7ConceptPack.actions.lights_taillight.lensEmissiveIntensity[1]).toBeLessThan(1.5)
    expect(su7ConceptPack.actions.lights_headlight.environmentLights).toHaveLength(2)
    expect(su7ConceptPack.actions.lights_headlight.environmentLights.every((light) => light.intensity > 0)).toBe(true)
    expect(su7ConceptPack.actions.lights_taillight.environmentLights).toHaveLength(2)
    expect(su7ConceptPack.actions.lights_taillight.environmentLights.every((light) => light.intensity > 0)).toBe(true)
    expect(Object.keys(su7ConceptPack.nodeMap)).toEqual(expect.arrayContaining([
      'window_driver_front',
      'trunk',
      'headlight_left',
      'headlight_right',
      'taillight_left',
      'taillight_right',
    ]))
  })
})
