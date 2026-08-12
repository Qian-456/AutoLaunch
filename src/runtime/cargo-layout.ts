import { su7ConceptPack } from '../pack/su7-concept.pack'
import { findProp, type PropCatalogEntry, type PropId } from '../props/prop-catalog'
import type {
  CargoBounds,
  CargoInstanceId,
  CargoOrientation,
  CargoPlacement,
  CargoPlacementReason,
} from '../types'

export type CargoPlacementCandidate = {
  position: readonly [number, number, number]
  rotation: readonly [number, number, number]
  orientation: CargoOrientation
  bounds: CargoBounds
  anchorId: null
  snappedToInstanceId: CargoInstanceId | null
}

export type CargoPlacementResult =
  | { ok: true; candidate: CargoPlacementCandidate }
  | { ok: false; reason: CargoPlacementReason; candidate?: CargoPlacementCandidate }

const cargo = su7ConceptPack.cargoVolume
const EPSILON = 0.002

export const CARGO_ORIENTATIONS: readonly CargoOrientation[] = ['flat', 'side', 'upright']

function rotate2d(x: number, z: number, angle: number): readonly [number, number] {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return [x * cosine - z * sine, x * sine + z * cosine]
}

/** Physical X/Y/Z size after applying one of the three stable 90-degree poses. */
export function dimensionsForOrientation(
  entry: PropCatalogEntry,
  orientation: CargoOrientation,
): readonly [number, number, number] {
  const [height, width, depth] = entry.dimensionsM
  if (orientation === 'flat') return [width, depth, height]
  if (orientation === 'side') return [height, width, depth]
  return [width, height, depth]
}

export function rotationForOrientation(orientation: CargoOrientation, rotationY: number): readonly [number, number, number] {
  if (orientation === 'flat') return [Math.PI / 2, rotationY, 0]
  if (orientation === 'side') return [0, rotationY, Math.PI / 2]
  return [0, rotationY, 0]
}

export function boundsForPose(
  entry: PropCatalogEntry,
  center: readonly [number, number, number],
  orientation: CargoOrientation,
  rotationY: number,
): CargoBounds {
  const [sizeX, sizeY, sizeZ] = dimensionsForOrientation(entry, orientation)
  return { center, halfSize: [sizeX / 2, sizeY / 2, sizeZ / 2], rotationY }
}

/** Backwards-compatible helper used by older callers and comparison tests. Position is now the visual centre. */
export function boundsForProp(
  entry: PropCatalogEntry,
  position: readonly [number, number, number],
  rotationY: number,
  rotationX = 0,
): CargoBounds {
  return boundsForPose(entry, position, Math.abs(rotationX) > Math.PI / 4 ? 'flat' : 'upright', rotationY)
}

export function cornersOf(bounds: CargoBounds): readonly (readonly [number, number])[] {
  const [halfX, , halfZ] = bounds.halfSize
  return [
    [-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ],
  ].map(([x, z]) => {
    const rotated = rotate2d(x, z, bounds.rotationY)
    return [bounds.center[0] + rotated[0], bounds.center[2] + rotated[1]] as const
  })
}

function pointOnSegment(point: readonly [number, number], a: readonly [number, number], b: readonly [number, number]) {
  const cross = (point[1] - a[1]) * (b[0] - a[0]) - (point[0] - a[0]) * (b[1] - a[1])
  if (Math.abs(cross) > EPSILON) return false
  return point[0] >= Math.min(a[0], b[0]) - EPSILON && point[0] <= Math.max(a[0], b[0]) + EPSILON
    && point[1] >= Math.min(a[1], b[1]) - EPSILON && point[1] <= Math.max(a[1], b[1]) + EPSILON
}

export function pointInPolygon(point: readonly [number, number], polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index]
    const prior = polygon[previous]
    if (pointOnSegment(point, current, prior)) return true
    const crosses = (current[1] > point[1]) !== (prior[1] > point[1])
      && point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0]
    if (crosses) inside = !inside
  }
  return inside
}

function polygonAtHeight(y: number): readonly (readonly [number, number])[] | null {
  const sections = cargo.collider.sections
  if (y < sections[0].y - EPSILON || y > sections[sections.length - 1].y + EPSILON) return null
  const upperIndex = sections.findIndex((section) => section.y >= y)
  if (upperIndex <= 0) return sections[0].polygon
  const lower = sections[upperIndex - 1]
  const upper = sections[upperIndex]
  const t = (y - lower.y) / (upper.y - lower.y)
  return lower.polygon.map(([x, z], index) => [
    x + (upper.polygon[index][0] - x) * t,
    z + (upper.polygon[index][1] - z) * t,
  ] as const)
}

function projection(corners: readonly (readonly [number, number])[], axis: readonly [number, number]) {
  const values = corners.map(([x, z]) => x * axis[0] + z * axis[1])
  return { min: Math.min(...values), max: Math.max(...values) }
}

/** Separating-axis test. Exact touching and the configured 5mm snap gap are legal. */
export function cargoBoundsIntersect(left: CargoBounds, right: CargoBounds): boolean {
  const leftCorners = cornersOf(left)
  const rightCorners = cornersOf(right)
  const axes = [left.rotationY, left.rotationY + Math.PI / 2, right.rotationY, right.rotationY + Math.PI / 2]
    .map((angle) => [Math.cos(angle), Math.sin(angle)] as const)
  const horizontalOverlap = axes.every((axis) => {
    const a = projection(leftCorners, axis)
    const b = projection(rightCorners, axis)
    return a.max > b.min + EPSILON && b.max > a.min + EPSILON
  })
  if (!horizontalOverlap) return false
  const leftMinY = left.center[1] - left.halfSize[1]
  const leftMaxY = left.center[1] + left.halfSize[1]
  const rightMinY = right.center[1] - right.halfSize[1]
  const rightMaxY = right.center[1] + right.halfSize[1]
  return leftMaxY > rightMinY + EPSILON && rightMaxY > leftMinY + EPSILON
}

function aabbHalfExtents(bounds: CargoBounds): readonly [number, number] {
  const c = Math.abs(Math.cos(bounds.rotationY))
  const s = Math.abs(Math.sin(bounds.rotationY))
  return [bounds.halfSize[0] * c + bounds.halfSize[2] * s, bounds.halfSize[0] * s + bounds.halfSize[2] * c]
}

export function validateCargoCandidate(
  entry: PropCatalogEntry,
  candidate: CargoPlacementCandidate,
  existing: readonly CargoPlacement[],
): CargoPlacementResult {
  const bottom = candidate.bounds.center[1] - candidate.bounds.halfSize[1]
  if (Math.abs(bottom - cargo.floorY) > EPSILON) return { ok: false, reason: 'floor-support-required', candidate }

  const height = candidate.bounds.halfSize[1] * 2
  const [, projectedHalfZ] = aabbHalfExtents(candidate.bounds)
  if (projectedHalfZ * 2 > cargo.opening.width + EPSILON || height > cargo.opening.height + EPSILON) {
    return { ok: false, reason: 'blocked-opening', candidate }
  }

  const verticalSamples = [bottom + EPSILON, candidate.bounds.center[1], candidate.bounds.center[1] + candidate.bounds.halfSize[1] - EPSILON]
  for (const y of verticalSamples) {
    const polygon = polygonAtHeight(y)
    if (!polygon) return { ok: false, reason: 'outside-volume', candidate }
    if (!cornersOf(candidate.bounds).every((corner) => pointInPolygon(corner, polygon))) {
      return { ok: false, reason: y <= cargo.floorY + 0.12 ? 'intersects-wall' : 'outside-volume', candidate }
    }
  }

  if (existing.some((placement) => cargoBoundsIntersect(candidate.bounds, placement.occupiedBounds))) {
    return { ok: false, reason: 'occupied', candidate }
  }
  return { ok: true, candidate }
}

function makeCandidate(
  entry: PropCatalogEntry,
  x: number,
  z: number,
  orientation: CargoOrientation,
  rotationY: number,
  snappedToInstanceId: CargoInstanceId | null = null,
): CargoPlacementCandidate {
  const [, height] = dimensionsForOrientation(entry, orientation)
  const position = [x, cargo.floorY + height / 2, z] as const
  return {
    position,
    rotation: rotationForOrientation(orientation, rotationY),
    orientation,
    bounds: boundsForPose(entry, position, orientation, rotationY),
    anchorId: null,
    snappedToInstanceId,
  }
}

export function candidateAtPosition(
  propId: PropId,
  x: number,
  z: number,
  orientation: CargoOrientation,
  rotationY: number,
  existing: readonly CargoPlacement[],
  disableSnap = false,
): CargoPlacementResult {
  const entry = findProp(propId)
  if (!entry) return { ok: false, reason: 'outside-volume' }
  const raw = makeCandidate(entry, x, z, orientation, rotationY)
  if (!disableSnap) {
    const rawExtents = aabbHalfExtents(raw.bounds)
    const snapOptions: Array<{ distance: number; candidate: CargoPlacementCandidate }> = []
    for (const placement of existing) {
      const other = aabbHalfExtents(placement.occupiedBounds)
      const targets: Array<readonly [number, number]> = [
        [placement.position[0] - other[0] - rawExtents[0] - cargo.collider.snapGap, z],
        [placement.position[0] + other[0] + rawExtents[0] + cargo.collider.snapGap, z],
        [x, placement.position[2] - other[1] - rawExtents[1] - cargo.collider.snapGap],
        [x, placement.position[2] + other[1] + rawExtents[1] + cargo.collider.snapGap],
      ]
      for (const [targetX, targetZ] of targets) {
        const distance = Math.hypot(targetX - x, targetZ - z)
        if (distance <= cargo.collider.snapDistance) {
          snapOptions.push({
            distance,
            candidate: makeCandidate(entry, targetX, targetZ, orientation, rotationY, placement.instanceId),
          })
        }
      }
    }
    snapOptions.sort((a, b) => a.distance - b.distance)
    for (const option of snapOptions) {
      const validated = validateCargoCandidate(entry, option.candidate, existing)
      if (validated.ok) return validated
    }
  }
  return validateCargoCandidate(entry, raw, existing)
}

export function findCargoPlacement(
  propId: PropId,
  existing: readonly CargoPlacement[],
  preferredAnchor?: string,
  orientation: CargoOrientation = 'flat',
): CargoPlacementResult {
  const anchorOrder = preferredAnchor === 'rear_right'
    ? [cargo.anchors.rear_right, cargo.anchors.rear_left, cargo.anchors.front_center]
    : [cargo.anchors.rear_left, cargo.anchors.rear_right, cargo.anchors.front_center]
  for (const anchor of anchorOrder) {
    for (let radius = 0; radius <= cargo.searchRadius + EPSILON; radius += cargo.searchStep) {
      for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]] as const) {
        const result = candidateAtPosition(propId, anchor.position[0] + dx, anchor.position[2] + dz, orientation, anchor.rotationY, existing)
        if (result.ok) return result
      }
    }
  }
  return { ok: false, reason: 'outside-volume' }
}

export function placementFromLayout(propId: PropId, _layoutId: 'two_suitcases'): CargoPlacementCandidate | null {
  const result = findCargoPlacement(propId, [], propId === 'checked_24' ? 'rear_left' : 'rear_right', 'flat')
  return result.ok ? result.candidate : null
}
