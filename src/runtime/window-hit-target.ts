import type { Intersection, Object3D } from 'three'
import { DOOR_TARGETS, WINDOW_TARGETS } from '../pack/su7-concept.pack'
import type { DoorTarget, WindowTarget } from '../types'

type ConcreteWindowTarget = Exclude<WindowTarget, 'all'>

export type VehicleHitTarget =
  | { type: 'window'; target: ConcreteWindowTarget }
  | { type: 'lights'; target: 'headlight' | 'taillight' }
  | { type: 'trunk' }
  | { type: 'frunk' }
  | { type: 'door'; target: Exclude<DoorTarget, 'all'> }

/**
 * Resolve a raycast hit back to a semantic window target. The raycaster may
 * return a child mesh, so walk upward until a Product Pack node-map name is
 * found. Generic runtime code never embeds a model-specific GLB node name.
 */
export function resolveWindowTargetFromHit(
  object: Object3D,
  nodeMap: Readonly<Record<string, string>>,
): ConcreteWindowTarget | null {
  let cursor: Object3D | null = object
  while (cursor) {
    const proxyTarget = cursor.userData.windowTarget as ConcreteWindowTarget | undefined
    if (proxyTarget && WINDOW_TARGETS.includes(proxyTarget)) return proxyTarget
    for (const target of WINDOW_TARGETS) {
      if (cursor.name === nodeMap[`window_${target}`]) return target
    }
    cursor = cursor.parent
  }
  return null
}

function lineageContainsMappedNode(
  object: Object3D,
  semanticIds: readonly string[],
  nodeMap: Readonly<Record<string, string>>,
): boolean {
  const names = new Set(semanticIds.map((semanticId) => nodeMap[semanticId]).filter(Boolean))
  let cursor: Object3D | null = object
  while (cursor) {
    if (names.has(cursor.name)) return true
    cursor = cursor.parent
  }
  return false
}

/** Resolve all directly clickable registered vehicle parts from one raycast hit. */
export function resolveVehicleTargetFromHit(
  object: Object3D,
  nodeMap: Readonly<Record<string, string>>,
  hatchNodeIds: readonly string[],
): VehicleHitTarget | null {
  // Glass is part of a door pivot, but its direct interaction remains the
  // window action. Resolve it before the inherited doorTarget marker.
  const windowTarget = resolveWindowTargetFromHit(object, nodeMap)
  if (windowTarget) return { type: 'window', target: windowTarget }

  let cursor: Object3D | null = object
  while (cursor) {
    const directTarget = cursor.userData.vehicleHitTarget as string | undefined
    if (directTarget === 'headlight' || directTarget === 'taillight') return { type: 'lights', target: directTarget }
    if (directTarget === 'frunk') return { type: 'frunk' }
    const doorTarget = cursor.userData.doorTarget as Exclude<DoorTarget, 'all'> | undefined
    if (doorTarget && DOOR_TARGETS.includes(doorTarget)) return { type: 'door', target: doorTarget }
    cursor = cursor.parent
  }
  if (lineageContainsMappedNode(object, ['headlight_left', 'headlight_right'], nodeMap)) {
    return { type: 'lights', target: 'headlight' }
  }
  if (lineageContainsMappedNode(object, [
    'taillight_left',
    'taillight_right',
    'trunk_taillight_lens',
    'trunk_taillight_housing',
    'trunk_taillight_emitter',
  ], nodeMap)) {
    return { type: 'lights', target: 'taillight' }
  }
  if (lineageContainsMappedNode(object, ['trunk', ...hatchNodeIds], nodeMap)) return { type: 'trunk' }
  return null
}

/**
 * Resolve only the closest visible intersection. A non-interactive body panel
 * is an intentional occluder: targets on the far side of the vehicle must not
 * receive the click through it.
 */
export function resolveVehicleTargetFromIntersections(
  intersections: readonly Pick<Intersection<Object3D>, 'distance' | 'object'>[],
  nodeMap: Readonly<Record<string, string>>,
  hatchNodeIds: readonly string[],
): VehicleHitTarget | null {
  const nearest = intersections.reduce<(typeof intersections)[number] | undefined>(
    (closest, intersection) => !closest || intersection.distance < closest.distance ? intersection : closest,
    undefined,
  )
  if (!nearest) return null
  return resolveVehicleTargetFromHit(nearest.object, nodeMap, hatchNodeIds)
}
