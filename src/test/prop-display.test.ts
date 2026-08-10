import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { computeCargoDragPosition, computePropHorizontalOffset } from '../components/PropDisplay'

describe('prop size comparison drag', () => {
  it('converts pointer movement into horizontal-only scene offset', () => {
    expect(computePropHorizontalOffset(0, 100)).toBeCloseTo(0.3)
    expect(computePropHorizontalOffset(0.2, -50)).toBeCloseTo(0.05)
  })

  it('clamps horizontal movement to the comparison stage', () => {
    expect(computePropHorizontalOffset(0, 1000)).toBe(0.9)
    expect(computePropHorizontalOffset(0, -1000)).toBe(-0.9)
  })
})

describe('guided cargo drag path', () => {
  it('starts on the luggage mat and ends exactly at the registered cargo target', () => {
    const start = new Vector3(2.84, 0.03, -0.85)
    const lift = new Vector3(2.84, 0.15, -0.85)
    const sill = new Vector3(2.04, 1.05, -0.32)
    const end = new Vector3(1.68, 0.9, -0.23)
    expect(computeCargoDragPosition(start, lift, sill, end, 0).toArray()).toEqual(start.toArray())
    expect(computeCargoDragPosition(start, lift, sill, end, 1).toArray()).toEqual(end.toArray())
    expect(computeCargoDragPosition(start, lift, sill, end, 0.75).y).toBeGreaterThan(0.7)
  })

})
