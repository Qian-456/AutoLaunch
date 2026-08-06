import { describe, expect, it } from 'vitest'
import { computePropHorizontalOffset } from '../components/PropDisplay'

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
