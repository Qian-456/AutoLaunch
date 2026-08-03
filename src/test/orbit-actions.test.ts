import { beforeEach, describe, expect, it } from 'vitest'
import { parseCommand } from '../runtime/command-parser'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { useExperienceStore } from '../store/experience-store'
import { su7ConceptPack } from '../pack/su7-concept.pack'

describe('registered OrbitAction pipeline', () => {
  beforeEach(() => {
    useExperienceStore.setState({ activeOrbitPreset: 'hero_front_left', orbitRequestId: 0, manualOrbit: false, notice: null })
  })

  it('parses a deterministic front-left command', () => {
    expect(parseCommand('参考图 视角')).toEqual({
      matched: true,
      action: { type: 'orbit', preset: 'hero_front_left' },
    })
  })

  it('parses turntable commands into the same action type', () => {
    expect(parseCommand('旋转一圈')).toEqual({
      matched: true,
      action: { type: 'orbit', preset: 'turntable' },
    })
  })

  it('returns a fixed suggestion for unknown commands', () => {
    expect(parseCommand('起飞')).toEqual({
      matched: false,
      suggestion: '暂不支持该命令，请尝试：参考图视角、看侧面、旋转一圈',
    })
  })

  it('dispatches a registered orbit preset into the domain store', () => {
    const result = dispatchVehicleAction({ type: 'orbit', preset: 'driver_side' })
    expect(result.ok).toBe(true)
    expect(useExperienceStore.getState().activeOrbitPreset).toBe('driver_side')
    expect(useExperienceStore.getState().orbitRequestId).toBe(1)
  })

  it('keeps 360-degree rotation explicit and observable', () => {
    dispatchVehicleAction({ type: 'orbit', preset: 'turntable' })
    expect(useExperienceStore.getState().notice).toBe('已启动 360° 展台环绕')
  })

  it('stops auto-rotation on manual drag without changing the requested preset', () => {
    dispatchVehicleAction({ type: 'orbit', preset: 'turntable' })
    useExperienceStore.getState().beginManualOrbit()
    expect(useExperienceStore.getState().manualOrbit).toBe(true)
    expect(useExperienceStore.getState().activeOrbitPreset).toBe('turntable')
  })

  it('keeps model-specific trim and plate corrections inside the Product Pack', () => {
    expect(su7ConceptPack.appearance.hiddenNodes).not.toContain('XiaomicarFlankLogo_carFlankLogo_blinn11_CarPaint_0')
    expect(su7ConceptPack.appearance.hiddenNodes).not.toContain('XiaomicarFlankMesh_carFlankMesh_lambert229_001_Roof_0')
    expect(su7ConceptPack.appearance.hiddenNodes).toContain('XiaomicarPlate_carPlate_aaa_Details_0')
    expect(su7ConceptPack.appearance.hiddenNodes).toContain('Xiaomiempennage_img_empennage_img_lambert46_Details_0')
    expect(su7ConceptPack.appearance.plates.map((plate) => plate.id)).toEqual(['front', 'rear'])
    expect(su7ConceptPack.appearance.lightingExperiments).toHaveLength(2)
    expect(su7ConceptPack.appearance.lightingExperiments.every((experiment) => !experiment.enabled)).toBe(true)
    expect(su7ConceptPack.appearance.materialOverrides.find((item) => item.material === 'CarPaint')).toMatchObject({
      color: '#ffffff',
      removeColorMap: false,
    })
    for (const material of ['Roof', 'Roof_Glass', 'Brilliant_Black', 'BrilliantGray', 'Brilliant_Silver']) {
      expect(su7ConceptPack.appearance.materialOverrides.find((item) => item.material === material)?.removeColorMap).toBe(true)
    }
    expect(Object.keys(su7ConceptPack.nodeMap)).toEqual(expect.arrayContaining([
      'trim_front_silver',
      'trim_side_silver',
      'trim_rear_silver',
      'trim_rear_silver_center',
    ]))
    expect(su7ConceptPack.appearance.nodeOverrides.map((item) => item.semanticId)).toEqual([
      'front_logo_base',
      'front_logo_mark',
      'trim_front_silver',
      'trim_side_silver',
      'trim_rear_silver',
      'trim_rear_silver_center',
      'brake_disc_rear',
      'brake_disc_front',
      'brake_calipers',
      'brake_caliper_letters',
      'rear_badges',
      'mirror_left_top',
      'mirror_left_bottom',
      'mirror_left_glass',
      'mirror_right_top',
      'mirror_right_bottom',
      'mirror_right_glass',
      'taillight_left_dark',
      'taillight_right_dark',
      'taillight_rear_housing_dark',
      'rear_body_upper',
      'rear_body_lip',
    ])
    expect(su7ConceptPack.appearance.colorMapRestores).toHaveLength(1)
    expect(su7ConceptPack.appearance.colorMapRestores[0].semanticId).toBe('trim_side_silver_decal')
    expect(su7ConceptPack.appearance.colorMapRestores[0].nodes).toEqual([
      'XiaomicarFlankLogo_carFlankLogo_blinn11_CarPaint_0',
    ])
    expect(su7ConceptPack.appearance.nodeOverrides.find((item) => item.semanticId === 'taillight_rear_housing_dark')).toMatchObject({
      envMapIntensity: 0,
      removeAllMaps: true,
    })
  })
})
