import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { paintOptions, su7ConceptPack } from '../pack/su7-concept.pack'

it('ships both original licensed black seat maps at their declared runtime paths', () => {
  const hashes = [
    '18f88a29eaf6c65c7e9c009ca77319090c8a93336f0adb01c13d0e28f17d926f',
    '8cd7bddf13f5ade6eff19ccec4b7972cb3b134fc46a4bd06530d139fac6072f9',
  ]
  for (const [index, path] of su7ConceptPack.appearance.seats.colorMaps.entries()) {
    const bytes = readFileSync(new URL(`../../public${path}`, import.meta.url))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(hashes[index])
    expect(bytes.subarray(1, 4).toString()).toBe('PNG')
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([512, 512])
  }
})

it('keeps the official exterior reference and headlight optics in the pack', () => {
  expect(paintOptions.map((option) => option.label)).toEqual(['闪电黄', '太空银', '鹦鹉绿', '珍珠白', '曜石黑'])
  expect(su7ConceptPack.appearance.reference.url).toBe('https://www.xiaomiev.com/ultra')
  for (const id of su7ConceptPack.appearance.headlightCover.semanticIds) expect(su7ConceptPack.nodeMap[id]).toBeTruthy()
  expect(su7ConceptPack.actions.lights_headlight.lensEmissiveIntensity).toEqual([0, 0])
  expect(su7ConceptPack.actions.lights_headlight.emissiveIntensity[1]).toBeGreaterThan(0)
})
