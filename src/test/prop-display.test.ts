import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { computeCargoDragPosition } from '../components/PropDisplay'

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
