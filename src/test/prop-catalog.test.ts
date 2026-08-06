import { describe, expect, it } from 'vitest'
import { findProp, propCatalog, toggleSelectedProp, validatePropCatalog } from '../props/prop-catalog'

describe('prop catalog', () => {
  it('contains the two licensed, physically-sized luggage props', () => {
    expect(validatePropCatalog(propCatalog)).toEqual([])
    expect(propCatalog.map((entry) => entry.id)).toEqual(['carry_on_20', 'checked_24'])
    expect(findProp('carry_on_20')?.dimensionsM).toEqual([0.56, 0.37, 0.23])
    expect(findProp('checked_24')?.dimensionsM).toEqual([0.665, 0.433, 0.275])
    expect(findProp('carry_on_20')?.previewColor).toBe('#202428')
    expect(findProp('checked_24')?.previewColor).toBe('#b7bdc1')
    expect(findProp('carry_on_20')?.description).toContain('黑色阳极氧化铝')
    expect(findProp('checked_24')?.description).toContain('银色拉丝铝')
    expect(propCatalog.every((entry) => entry.description.includes('无拉链铝框'))).toBe(true)
    expect(new Set(propCatalog.map((entry) => entry.modelPath)).size).toBe(propCatalog.length)
    expect(propCatalog.every((entry) => entry.attribution.license === 'CC BY-NC-SA 4.0')).toBe(true)
    expect(propCatalog.every((entry) => entry.attribution.licenseUrl === 'https://creativecommons.org/licenses/by-nc-sa/4.0/')).toBe(true)
    expect(findProp('checked_24')?.stageRotation[1]).toBeCloseTo(-0.56)
  })

  it('switches, toggles off, and never returns more than one selected prop', () => {
    expect(toggleSelectedProp(null, 'carry_on_20')).toBe('carry_on_20')
    expect(toggleSelectedProp('carry_on_20', 'checked_24')).toBe('checked_24')
    expect(toggleSelectedProp('checked_24', 'checked_24')).toBeNull()
  })
})
