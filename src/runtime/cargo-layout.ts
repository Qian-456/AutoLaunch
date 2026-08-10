import { su7ConceptPack } from '../pack/su7-concept.pack'
import { findProp, type PropCatalogEntry, type PropId } from '../props/prop-catalog'
import type { CargoAnchorId, CargoBounds, CargoPlacement } from '../types'

export type CargoPlacementCandidate = {
  position: readonly [number, number, number]
  rotation: readonly [number, number, number]
  bounds: CargoBounds
  anchorId: CargoAnchorId
}

export type CargoPlacementResult =
  | { ok: true; candidate: CargoPlacementCandidate }
  | { ok: false; reason: 'too-large-for-opening' | 'outside-cargo-volume' | 'occupied' }

const cargo = su7ConceptPack.cargoVolume
const EPSILON = 0.008

function rotate2d(x: number, z: number, angle: number): readonly [number, number] {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return [x * cosine - z * sine, x * sine + z * cosine]
}

export function boundsForProp(
  entry: PropCatalogEntry,
  position: readonly [number, number, number],
  rotationY: number,
  rotationX = 0,
): CargoBounds {
  const box = entry.collisionBoxes[0]
  const cosineX = Math.cos(rotationX)
  const sineX = Math.sin(rotationX)
  const rotatedOffsetY = box.offset[1] * cosineX - box.offset[2] * sineX
  const rotatedOffsetZ = box.offset[1] * sineX + box.offset[2] * cosineX
  const [offsetX, offsetZ] = rotate2d(box.offset[0], rotatedOffsetZ, rotationY)
  const rotatedSizeY = Math.abs(box.size[1] * cosineX) + Math.abs(box.size[2] * sineX)
  const rotatedSizeZ = Math.abs(box.size[1] * sineX) + Math.abs(box.size[2] * cosineX)
  return {
    center: [position[0] + offsetX, position[1] + rotatedOffsetY, position[2] + offsetZ],
    halfSize: [box.size[0] / 2, rotatedSizeY / 2, rotatedSizeZ / 2],
    rotationY,
  }
}

function positionForAnchor(
  entry: PropCatalogEntry,
  anchor: { position: readonly [number, number, number]; rotationX: number; rotationY: number },
  offsetX: number,
  offsetZ: number,
): readonly [number, number, number] {
  const atOrigin = boundsForProp(entry, [0, 0, 0], anchor.rotationY, anchor.rotationX)
  return [
    anchor.position[0] + offsetX - atOrigin.center[0],
    cargo.floorY + atOrigin.halfSize[1] - atOrigin.center[1],
    anchor.position[2] + offsetZ - atOrigin.center[2],
  ]
}

function cornersOf(bounds: CargoBounds): readonly (readonly [number, number])[] {
  const [halfX, , halfZ] = bounds.halfSize
  return [
    [-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ],
  ].map(([x, z]) => {
    const rotated = rotate2d(x, z, bounds.rotationY)
    return [bounds.center[0] + rotated[0], bounds.center[2] + rotated[1]] as const
  })
}

export function pointInPolygon(point: readonly [number, number], polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x, z] = polygon[index]
    const [previousX, previousZ] = polygon[previous]
    const crosses = (z > point[1]) !== (previousZ > point[1])
      && point[0] < ((previousX - x) * (point[1] - z)) / (previousZ - z) + x
    if (crosses) inside = !inside
  }
  return inside
}

function projection(corners: readonly (readonly [number, number])[], axis: readonly [number, number]) {
  const values = corners.map(([x, z]) => x * axis[0] + z * axis[1])
  return { min: Math.min(...values), max: Math.max(...values) }
}

/** Separating-axis test for two yaw-only oriented cargo boxes. */
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

export function validateCargoCandidate(
  entry: PropCatalogEntry,
  candidate: CargoPlacementCandidate,
  existing: readonly CargoPlacement[],
): CargoPlacementResult {
  const widthAtOpening = Math.max(...cornersOf(candidate.bounds).map((corner) => corner[1]))
    - Math.min(...cornersOf(candidate.bounds).map((corner) => corner[1]))
  const height = candidate.bounds.halfSize[1] * 2
  if (widthAtOpening > cargo.opening.width || height > cargo.opening.height) {
    return { ok: false, reason: 'too-large-for-opening' }
  }
  const withinFloor = cornersOf(candidate.bounds).every((corner) => pointInPolygon(corner, cargo.floorPolygon))
  const top = candidate.bounds.center[1] + candidate.bounds.halfSize[1]
  if (!withinFloor || top > cargo.floorY + cargo.maxHeight + EPSILON) {
    return { ok: false, reason: 'outside-cargo-volume' }
  }
  if (existing.some((placement) => placement.propId !== entry.id && cargoBoundsIntersect(candidate.bounds, placement.occupiedBounds))) {
    return { ok: false, reason: 'occupied' }
  }
  return { ok: true, candidate }
}

function searchOffsets(radius: number, step: number): readonly (readonly [number, number])[] {
  const offsets: Array<readonly [number, number]> = [[0, 0]]
  for (let distance = step; distance <= radius + EPSILON; distance += step) {
    offsets.push([distance, 0], [-distance, 0], [0, distance], [0, -distance])
    offsets.push([distance, distance], [distance, -distance], [-distance, distance], [-distance, -distance])
  }
  return offsets
}

export function findCargoPlacement(
  propId: PropId,
  existing: readonly CargoPlacement[],
  preferredAnchor?: CargoAnchorId,
): CargoPlacementResult {
  const entry = findProp(propId)
  if (!entry) return { ok: false, reason: 'outside-cargo-volume' }
  const anchorIds = preferredAnchor
    ? [preferredAnchor]
    : Object.keys(cargo.anchors) as CargoAnchorId[]
  let lastReason: CargoPlacementResult = { ok: false, reason: 'outside-cargo-volume' }
  for (const anchorId of anchorIds) {
    const anchor = cargo.anchors[anchorId]
    for (const orientation of entry.allowedOrientations) {
      const rotationY = anchor.rotationY + orientation
      for (const [offsetX, offsetZ] of searchOffsets(cargo.searchRadius, cargo.searchStep)) {
        const position = positionForAnchor(entry, { ...anchor, rotationY }, offsetX, offsetZ)
        const candidate: CargoPlacementCandidate = {
          position,
          rotation: [anchor.rotationX, rotationY, 0],
          bounds: boundsForProp(entry, position, rotationY, anchor.rotationX),
          anchorId,
        }
        const result = validateCargoCandidate(entry, candidate, existing)
        if (result.ok) return result
        lastReason = result
      }
    }
  }
  return lastReason
}

export function placementFromLayout(propId: PropId, layoutId: 'two_suitcases'): CargoPlacementCandidate | null {
  const entry = findProp(propId)
  const configured = su7ConceptPack.cargoVolume.layouts[layoutId].placements[propId]
  if (!entry || !configured) return null
  return {
    position: configured.position,
    rotation: [configured.rotationX, configured.rotationY, 0],
    bounds: boundsForProp(entry, configured.position, configured.rotationY, configured.rotationX),
    anchorId: configured.anchorId,
  }
}
