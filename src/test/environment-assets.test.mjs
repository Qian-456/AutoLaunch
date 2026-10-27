import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'
import manifest from '../../public/assets/environments/manifest.json'

const folder = new URL('../../public/assets/environments/', import.meta.url)

it('ships every environment asset with verified bytes and provenance', () => {
  expect(readdirSync(folder).filter((file) => file !== 'manifest.json').sort()).toEqual(manifest.assets.map((asset) => asset.file).sort())
  for (const asset of manifest.assets) {
    expect(asset.file).not.toMatch(/[/\\]|\.\./)
    expect(new URL(asset.source).hostname).toBe('polyhaven.com')
    expect(asset.license).toBe('CC0-1.0')
    expect(asset.authors.length).toBeGreaterThan(0)
    const bytes = readFileSync(new URL(asset.file, folder))
    expect(bytes.length, asset.file).toBe(asset.bytes)
    expect(createHash('sha256').update(bytes).digest('hex'), asset.file).toBe(asset.sha256)
    if (asset.file.endsWith('.hdr')) expect(bytes.subarray(0, 1000).toString()).toMatch(/-Y 512 \+X 1024/)
    if (asset.file.endsWith('.webp')) expect(bytes.subarray(8, 12).toString()).toBe('WEBP')
  }
})

it('keeps the desktop 8K environment library below 20 MiB', () => {
  expect(manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0)).toBeLessThan(20 * 1024 * 1024)
})
