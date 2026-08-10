import { beforeEach, describe, expect, it } from 'vitest'
import { findProp } from '../props/prop-catalog'
import {
  boundsForProp,
  cargoBoundsIntersect,
  findCargoPlacement,
  placementFromLayout,
  validateCargoCandidate,
} from '../runtime/cargo-layout'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { useExperienceStore } from '../store/experience-store'
import type { CargoPlacement } from '../types'
import { su7ConceptPack } from '../pack/su7-concept.pack'

function loaded(propId: 'carry_on_20' | 'checked_24', layout: 'two_suitcases'): CargoPlacement {
  const candidate = placementFromLayout(propId, layout)
  if (!candidate) throw new Error(`missing layout for ${propId}`)
  return {
    propId,
    state: 'loaded',
    position: candidate.position,
    rotation: candidate.rotation,
    occupiedBounds: candidate.bounds,
    anchorId: candidate.anchorId,
  }
}

describe('continuous cargo layout', () => {
  beforeEach(() => {
    useExperienceStore.setState({ cargoPlacements: new Map(), cargoReflowProposal: null })
  })

  it('derives collision height from the real metre dimensions', () => {
    const checked = findProp('checked_24')!
    const bounds = boundsForProp(checked, [1.35, su7ConceptPack.cargoVolume.floorY, -0.28], 0)
    expect(bounds.halfSize).toEqual([0.433 / 2, 0.665 / 2, 0.275 / 2])
    expect(bounds.center[1] - bounds.halfSize[1]).toBeCloseTo(su7ConceptPack.cargoVolume.floorY)
  })

  it('distinguishes intersecting and separated oriented boxes', () => {
    const carryOn = findProp('carry_on_20')!
    const first = boundsForProp(carryOn, [1.7, 0.43, -0.25], 0)
    const overlapping = boundsForProp(carryOn, [1.7, 0.43, -0.15], Math.PI / 2)
    const separated = boundsForProp(carryOn, [1.7, 0.43, 0.25], 0)
    expect(cargoBoundsIntersect(first, overlapping)).toBe(true)
    expect(cargoBoundsIntersect(first, separated)).toBe(false)
  })

  it('rejects a candidate outside the calibrated cargo floor', () => {
    const carryOn = findProp('carry_on_20')!
    const position = [2.45, 0.43, 0] as const
    const candidate = {
      position,
      rotation: [0, 0, 0] as const,
      bounds: boundsForProp(carryOn, position, 0),
      anchorId: 'rear_left' as const,
    }
    expect(validateCargoCandidate(carryOn, candidate, [])).toEqual({ ok: false, reason: 'outside-cargo-volume' })
  })

  it('keeps unused continuous space available instead of locking an anchor region', () => {
    const first = findCargoPlacement('carry_on_20', [], 'rear_left')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const occupied: CargoPlacement = {
      propId: 'carry_on_20',
      state: 'loaded',
      position: first.candidate.position,
      rotation: first.candidate.rotation,
      occupiedBounds: first.candidate.bounds,
      anchorId: first.candidate.anchorId,
    }
    // A second physical box definition can still find room at another nearby anchor;
    // occupancy is its OBB, not a boolean lock on the whole cargo volume.
    const second = findCargoPlacement('checked_24', [occupied], 'rear_right')
    expect(second.ok).toBe(true)
  })

  it('registers a non-overlapping two-suitcase fallback layout', () => {
    const checked = loaded('checked_24', 'two_suitcases')
    const carryOn = loaded('carry_on_20', 'two_suitcases')
    expect(checked.rotation[0]).toBeCloseTo(Math.PI / 2)
    expect(carryOn.rotation[0]).toBeCloseTo(Math.PI / 2)
    expect(checked.occupiedBounds.halfSize[1] * 2).toBeCloseTo(0.275)
    expect(carryOn.occupiedBounds.halfSize[1] * 2).toBeCloseTo(0.23)
    expect(cargoBoundsIntersect(checked.occupiedBounds, carryOn.occupiedBounds)).toBe(false)
    expect(validateCargoCandidate(findProp('checked_24')!, placementFromLayout('checked_24', 'two_suitcases')!, [])?.ok).toBe(true)
    expect(validateCargoCandidate(findProp('carry_on_20')!, placementFromLayout('carry_on_20', 'two_suitcases')!, [checked])?.ok).toBe(true)
  })

  it('routes deterministic combination actions through the shared dispatcher', () => {
    const result = dispatchVehicleAction({ type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' })
    const placements = useExperienceStore.getState().cargoPlacements
    expect(result.ok).toBe(true)
    expect([...placements.keys()]).toEqual(['checked_24', 'carry_on_20'])
    expect([...placements.values()].every((placement) => placement.state === 'loading')).toBe(true)
    expect(useExperienceStore.getState().activeOrbitPreset).toBe('cargo_rear')
  })

  it('prevents the rear hatch from closing during a cargo transition', () => {
    dispatchVehicleAction({ type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' })
    const result = dispatchVehicleAction({ type: 'trunk', open: false })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('行李箱正在移动')
  })
})
