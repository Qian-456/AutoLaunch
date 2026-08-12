import { beforeEach, describe, expect, it } from 'vitest'
import { findProp } from '../props/prop-catalog'
import {
  boundsForPose,
  candidateAtPosition,
  cargoBoundsIntersect,
  dimensionsForOrientation,
  conflictsWithHatchSweep,
  contactOffsetForOrientation,
  transformGroundContact,
  solveGroundContacts,
} from '../runtime/cargo-layout'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { useExperienceStore } from '../store/experience-store'
import type { CargoPlacement } from '../types'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import { registerCargoSurfaceSampler } from '../runtime/cargo-surface'

function loaded(instanceId: string, propId: 'carry_on_20' | 'checked_24', x: number, z: number): CargoPlacement {
  const result = candidateAtPosition(propId, x, z, 'flat', Math.PI / 2, [])
  if (!result.ok) throw new Error(`invalid fixture: ${result.reason}`)
  return {
    instanceId,
    catalogPropId: propId,
    state: 'loaded',
    orientation: 'flat',
    position: result.candidate.position,
    rotation: result.candidate.rotation,
    occupiedBounds: result.candidate.bounds,
    supportHeight: result.candidate.supportHeight,
    collisionCenter: result.candidate.collisionCenter,
    worldGroundContacts: result.candidate.worldGroundContacts,
    anchorId: null,
  }
}

describe('real cargo volume placement', () => {
  beforeEach(() => {
    registerCargoSurfaceSampler(null)
    useExperienceStore.setState({
      cargoPlacements: new Map(),
      cargoPlacementSession: null,
      selectedCargoInstanceId: null,
      activeActions: new Map(),
    })
  })

  it('uses the registered vehicle surface sampler when available', () => {
    registerCargoSurfaceSampler(() => 0.692)
    const result = candidateAtPosition('carry_on_20', 1.95, 0, 'flat', 0, [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.candidate.supportHeight).toBeCloseTo(0.692)
    expect(result.candidate.worldGroundContacts.every(([, y]) => Math.abs(y - 0.692) <= 0.002)).toBe(true)
  })

  it('rejects an uneven real surface that cannot stably support the pose', () => {
    registerCargoSurfaceSampler((_x, z) => z < 0 ? 0.69 : 0.73)
    const result = candidateAtPosition('carry_on_20', 1.95, 0, 'flat', Math.PI / 2, [], true)
    expect(result).toMatchObject({ ok: false, reason: 'incomplete-floor-support' })
  })

  it('maps stable poses to their real physical dimensions', () => {
    const checked = findProp('checked_24')!
    expect(dimensionsForOrientation(checked, 'upright')).toEqual([0.433, 0.665, 0.275])
    expect(dimensionsForOrientation(checked, 'flat')).toEqual([0.433, 0.275, 0.665])
    expect(dimensionsForOrientation(checked, 'side')).toEqual([0.665, 0.433, 0.275])
  })

  it('places every pose exactly on the cargo floor', () => {
    const entry = findProp('carry_on_20')!
    for (const orientation of ['upright', 'flat', 'side'] as const) {
      const [, height] = dimensionsForOrientation(entry, orientation)
      const center = [2, su7ConceptPack.cargoVolume.floorY + height / 2, 0] as const
      const bounds = boundsForPose(entry, center, orientation, 0.37)
      expect(bounds.center[1] - bounds.halfSize[1]).toBeCloseTo(su7ConceptPack.cargoVolume.floorY)
    }
  })

  it('derives every stable pose center from the sampled support surface', () => {
    const entry = findProp('carry_on_20')!
    for (const orientation of ['upright', 'flat', 'side'] as const) {
      const result = candidateAtPosition(entry.id, 1.95, 0, orientation, Math.PI / 2, [])
      if (!result.ok && ['blocked-opening', 'hatch-sweep-conflict'].includes(result.reason)) continue
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.candidate.bounds.center[1] - result.candidate.bounds.halfSize[1])
        .toBeCloseTo(result.candidate.supportHeight)
    }
  })

  it('uses wheels for upright and shell contacts for flat and side poses', () => {
    for (const propId of ['carry_on_20', 'checked_24'] as const) {
      const entry = findProp(propId)!
      const upright = contactOffsetForOrientation(entry, 'upright', 0)
      const flat = contactOffsetForOrientation(entry, 'flat', 0)
      const side = contactOffsetForOrientation(entry, 'side', 0)
      expect(upright).toBeCloseTo(entry.dimensionsM[0] / 2)
      expect(flat).toBeLessThan(entry.dimensionsM[2] / 2)
      expect(side).toBeLessThan(entry.dimensionsM[1] / 2)
    }
  })

  it('keeps contact height invariant under horizontal yaw', () => {
    const entry = findProp('carry_on_20')!
    for (const orientation of ['upright', 'flat', 'side'] as const) {
      const base = contactOffsetForOrientation(entry, orientation, 0)
      for (const yaw of [0.37, Math.PI / 2, Math.PI * 1.73]) {
        expect(contactOffsetForOrientation(entry, orientation, yaw)).toBeCloseTo(base)
        const transformed = entry.groundContacts[orientation].map((point) => transformGroundContact(point, orientation, yaw))
        expect(Math.min(...transformed.map((point) => point[1])) + base).toBeCloseTo(0)
      }
    }
  })

  it('samples the registered world contacts rather than collision-box corners', () => {
    const entry = findProp('carry_on_20')!
    for (const orientation of ['upright', 'flat', 'side'] as const) {
      const solved = solveGroundContacts(entry, 1.95, 0, orientation, 0.37)
      expect(solved).not.toBeNull()
      expect(solved?.worldGroundContacts).toHaveLength(entry.groundContacts[orientation].length)
      expect(solved?.worldGroundContacts.every(([, y]) => Math.abs(y - su7ConceptPack.cargoVolume.floorY) <= 0.002)).toBe(true)
    }
  })

  it('keeps visual position and collision center explicit and internally aligned', () => {
    const result = candidateAtPosition('carry_on_20', 1.95, 0, 'flat', 0, [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.candidate.collisionCenter).toEqual(result.candidate.bounds.center)
    expect(result.candidate.position[1]).not.toBe(result.candidate.collisionCenter[1])
    expect(result.candidate.worldGroundContacts.every(([, y]) => Math.abs(y - result.candidate.supportHeight) <= 0.002)).toBe(true)
  })

  it('declares a twelve-item rendering safety ceiling', () => {
    expect(su7ConceptPack.cargoVolume.collider.maxInstances).toBe(12)
  })

  it('rejects a bottom footprint that is only partially supported', () => {
    const result = candidateAtPosition('checked_24', 2.30, 0.34, 'flat', 0, [], true)
    expect(result).toMatchObject({ ok: false, reason: 'incomplete-floor-support' })
  })

  it('rejects calibrated seat-back and sill overlap', () => {
    const seat = candidateAtPosition('carry_on_20', 1.50, 0, 'flat', 0, [], true)
    expect(seat.ok).toBe(false)
    if (!seat.ok) expect(['intersects-interior', 'incomplete-floor-support', 'intersects-wall']).toContain(seat.reason)
  })

  it('reports luggage intersecting the calibrated hatch sweep', () => {
    const bounds = boundsForPose(findProp('carry_on_20')!, [2.31, 1.13, 0], 'upright', 0)
    expect(conflictsWithHatchSweep(bounds)).toBe(true)
  })

  it('rejects hatch interference before placement is confirmed', () => {
    const result = candidateAtPosition('carry_on_20', 2.27, 0, 'side', 0, [], true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(['hatch-sweep-conflict', 'incomplete-floor-support', 'intersects-interior']).toContain(result.reason)
  })

  it('rejects wheel-arch/side-wall penetration from the closed proxy volume', () => {
    const result = candidateAtPosition('carry_on_20', 1.54, -0.52, 'flat', 0, [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(['intersects-wall', 'outside-volume', 'incomplete-floor-support']).toContain(result.reason)
  })

  it('rejects a pose that cannot pass through the hatch opening', () => {
    const result = candidateAtPosition('checked_24', 2, 0, 'upright', 0, [])
    expect(result).toMatchObject({ ok: false, reason: 'blocked-opening' })
  })

  it('distinguishes overlap from legal side contact', () => {
    const carryOn = findProp('carry_on_20')!
    const first = boundsForPose(carryOn, [2, 0.875, -0.22], 'flat', Math.PI / 2)
    const overlapping = boundsForPose(carryOn, [2, 0.875, -0.1], 'flat', Math.PI / 2)
    const separated = boundsForPose(carryOn, [2, 0.875, 0.36], 'flat', Math.PI / 2)
    expect(cargoBoundsIntersect(first, overlapping)).toBe(true)
    expect(cargoBoundsIntersect(first, separated)).toBe(false)
  })

  it('soft-snaps a second floor item to a legal neighbouring side', () => {
    const first = loaded('carry-1', 'carry_on_20', 2, -0.25)
    // With a 90° yaw the 37cm width lies on world Z; start 3.5cm short of the
    // legal 5mm side gap so the soft magnet can finish the alignment.
    const rawZ = first.position[2] + 0.34
    const second = candidateAtPosition('carry_on_20', first.position[0], rawZ, 'flat', Math.PI / 2, [first])
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.candidate.snappedToInstanceId).toBe('carry-1')
    expect(cargoBoundsIntersect(first.occupiedBounds, second.candidate.bounds)).toBe(false)
  })

  it('creates independent instances for repeated additions', () => {
    expect(dispatchVehicleAction({ type: 'cargo', operation: 'spawn', propId: 'carry_on_20' }).ok).toBe(true)
    expect(dispatchVehicleAction({ type: 'cargo', operation: 'confirm' }).ok).toBe(true)
    expect(dispatchVehicleAction({ type: 'cargo', operation: 'spawn', propId: 'carry_on_20' }).ok).toBe(true)
    const session = useExperienceStore.getState().cargoPlacementSession
    expect(session).not.toBeNull()
    expect(session?.instanceId).not.toBe([...useExperienceStore.getState().cargoPlacements.keys()][0])
  })

  it('never confirms an overlapping ghost into the placement map', () => {
    const first = loaded('carry-locked', 'carry_on_20', 2, 0)
    useExperienceStore.getState().setCargoPlacement(first)
    dispatchVehicleAction({ type: 'cargo', operation: 'spawn', propId: 'carry_on_20' })
    const session = useExperienceStore.getState().cargoPlacementSession!
    const overlap = candidateAtPosition('carry_on_20', first.position[0], first.position[2], 'flat', Math.PI / 2, [first], true)
    expect(overlap).toMatchObject({ ok: false, reason: 'occupied' })
    useExperienceStore.getState().setCargoPlacementSession({
      ...session,
      candidate: overlap.candidate ? {
        instanceId: session.instanceId,
        catalogPropId: session.catalogPropId,
        state: 'dragging',
        orientation: overlap.candidate.orientation,
        position: overlap.candidate.position,
        rotation: overlap.candidate.rotation,
        occupiedBounds: overlap.candidate.bounds,
        supportHeight: overlap.candidate.supportHeight,
        collisionCenter: overlap.candidate.collisionCenter,
        worldGroundContacts: overlap.candidate.worldGroundContacts,
        anchorId: null,
      } : null,
      valid: false,
      reason: 'occupied',
    })
    expect(dispatchVehicleAction({ type: 'cargo', operation: 'confirm' }).ok).toBe(false)
    expect(useExperienceStore.getState().cargoPlacements.size).toBe(1)
  })

  it('builds the demonstration through the shared floor solver', () => {
    const result = dispatchVehicleAction({ type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' })
    const placements = [...useExperienceStore.getState().cargoPlacements.values()]
    expect(result.ok).toBe(true)
    expect(placements).toHaveLength(2)
    expect(placements.every((placement) => placement.orientation === 'flat')).toBe(true)
    expect(placements.every((placement) => placement.state === 'loading' && placement.transitionFrom)).toBe(true)
    expect(cargoBoundsIntersect(placements[0].occupiedBounds, placements[1].occupiedBounds)).toBe(false)
    expect(placements.every((placement) => !conflictsWithHatchSweep(placement.occupiedBounds))).toBe(true)
  })

  it('prevents the rear hatch from closing during a cargo transition', () => {
    dispatchVehicleAction({ type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' })
    const result = dispatchVehicleAction({ type: 'trunk', open: false })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('行李箱正在移动')
  })
})
