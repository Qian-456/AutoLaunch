import { beforeEach, describe, expect, it } from 'vitest'
import { Group, Object3D } from 'three'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { parseCommand } from '../runtime/command-parser'
import { useExperienceStore } from '../store/experience-store'
import { buildDoorRefs, buildHatchFrontRefs } from '../components/VehicleModel'
import { DOOR_LABELS, DOOR_TARGETS, su7ConceptPack } from '../pack/su7-concept.pack'
import type { VehiclePartId } from '../types'

const closedParts = (): Map<VehiclePartId, 'closed'> => new Map([
  ['window_driver_front', 'closed'], ['window_passenger_front', 'closed'],
  ['window_driver_rear', 'closed'], ['window_passenger_rear', 'closed'],
  ['hatch_rear', 'closed'], ['hatch_front', 'closed'], ['frunk', 'closed'],
  ['door_driver_front', 'closed'], ['door_passenger_front', 'closed'],
  ['door_driver_rear', 'closed'], ['door_passenger_rear', 'closed'],
  ['trunk', 'closed'],
])

describe('front hatch and real-door pipeline', () => {
  beforeEach(() => {
    useExperienceStore.setState({
      vehiclePartStates: closedParts(),
      activeActions: new Map(),
      lastActionOutcome: null,
    })
  })

  it('routes the frunk legacy alias without changing the rear hatch', () => {
    const result = dispatchVehicleAction({ type: 'trunk', frunk: true, open: true })
    expect(result.ok).toBe(true)
    expect(useExperienceStore.getState().vehiclePartStates.get('hatch_front')).toBe('moving')
    expect(useExperienceStore.getState().vehiclePartStates.get('hatch_rear')).toBe('closed')
    if (!result.ok || !result.actionId) throw new Error('expected front hatch action id')
    useExperienceStore.getState().finishAction(result.actionId, 'completed')
    expect(useExperienceStore.getState().vehiclePartStates.get('hatch_front')).toBe('open')
    expect(useExperienceStore.getState().vehiclePartStates.get('frunk')).toBe('open')
  })

  it('keeps door conflict groups independent and repeated targets idempotent', () => {
    const first = dispatchVehicleAction({ type: 'door', target: 'driver_front', open: true, progress: 100 })
    const repeated = dispatchVehicleAction({ type: 'door', target: 'driver_front', open: true, progress: 100 })
    const passenger = dispatchVehicleAction({ type: 'door', target: 'passenger_front', open: true, progress: 100 })
    expect(first.ok && repeated.ok && passenger.ok).toBe(true)
    expect(useExperienceStore.getState().activeActions.size).toBe(2)
    expect(new Set([...useExperienceStore.getState().activeActions.values()].map((item) => item.conflictGroup))).toEqual(
      new Set(['door_driver_front', 'door_passenger_front']),
    )
  })

  const commandCases = [
    ['打开前备箱', 'hatch', 'front_hatch', 100], ['关闭前备箱', 'hatch', 'front_hatch', 0],
    ['打开前引擎盖', 'hatch', 'front_hatch', 100], ['盖上前盖', 'hatch', 'front_hatch', 0],
    ['打开主驾车门', 'door', 'driver_front', 100], ['关闭主驾车门', 'door', 'driver_front', 0],
    ['打开副驾车门', 'door', 'passenger_front', 100], ['关闭副驾车门', 'door', 'passenger_front', 0],
    ['打开主驾后车门', 'door', 'driver_rear', 100], ['关闭主驾后车门', 'door', 'driver_rear', 0],
    ['打开副驾后车门', 'door', 'passenger_rear', 100], ['关闭副驾后车门', 'door', 'passenger_rear', 0],
    ['全部车门打开', 'door', 'all', 100], ['doorDriverFront open', 'door', 'driver_front', 100],
  ] as const

  it.each(commandCases)('parses %s into a registered action', (input, type, target, progress) => {
    const result = parseCommand(input)
    expect(result.matched).toBe(true)
    if (!result.matched) return
    expect(result.action.type).toBe(type)
    if ('target' in result.action && target !== undefined) expect(result.action.target).toBe(target)
    if ('progress' in result.action) expect(result.action.progress).toBe(progress)
  })

  it('assembles registered real door skins, inner panels, windows and hood', () => {
    const scene = new Object3D()
    const root = new Group()
    const semanticIds = [
      ...DOOR_TARGETS.flatMap((target) => (su7ConceptPack.actions[`door_${target}`].movingNodeIds)),
      ...su7ConceptPack.actions.hatch_front.movingNodeIds,
    ]
    for (const semanticId of new Set(semanticIds)) {
      const node = new Object3D()
      node.name = su7ConceptPack.nodeMap[semanticId as keyof typeof su7ConceptPack.nodeMap]
      scene.add(node)
    }
    const doors = buildDoorRefs(scene, root)
    const hatch = buildHatchFrontRefs(scene, root)
    expect(DOOR_TARGETS.every((target) => doors[target].movingNodes.length === su7ConceptPack.actions[`door_${target}`].movingNodeIds.length)).toBe(true)
    expect(DOOR_TARGETS.every((target) => !doors[target].pivot.getObjectByName(`VirtualDoor_${target}`))).toBe(true)
    expect(hatch.pivot.name).toBe('Hatch_Pivot_front_hatch')
    expect(hatch.isVirtual).toBe(false)
  })

  it('registers complete Product Pack definitions and labels', () => {
    expect(DOOR_TARGETS).toHaveLength(4)
    expect(DOOR_TARGETS.every((target) => DOOR_LABELS[target].length > 0)).toBe(true)
    expect(su7ConceptPack.nodeMap.hatch_front_outer).toContain('carPaint_3_1')
    expect(su7ConceptPack.actions.hatch_front.movingNodeIds).toEqual(
      expect.arrayContaining(['hatch_front_outer', 'front_logo_base', 'front_logo_mark']),
    )
    expect(su7ConceptPack.actions.hatch_front.openRotation).toBeLessThan(0)
    expect(su7ConceptPack.actions.door_driver_front.openRotation).toBeLessThan(0)
    expect(su7ConceptPack.actions.door_passenger_front.openRotation).toBeGreaterThan(0)
    expect(DOOR_TARGETS.every((target) => su7ConceptPack.nodeMap[`door_${target}_outer`].length > 0)).toBe(true)
  })
})
