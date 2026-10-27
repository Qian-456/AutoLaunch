import { expect, it, vi } from 'vitest'
import { Color, MeshPhysicalMaterial, Texture } from 'three'
import { bindPaintAppearance } from '../runtime/paint-appearance'

it('keeps texture detail and existing shader hooks while sharing live paint uniforms', () => {
  const map = new Texture()
  const material = new MeshPhysicalMaterial({ map, clearcoat: 0.85 })
  const previousCompile = vi.fn()
  material.onBeforeCompile = previousCompile
  const uniforms = { color: { value: new Color('#c6cdd1') }, blend: { value: 1 } }
  bindPaintAppearance(material, uniforms)
  const key = material.customProgramCacheKey()
  const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>\n#include <normal_fragment_begin>' }
  material.onBeforeCompile(shader as never, {} as never)
  expect(previousCompile).toHaveBeenCalledOnce()
  expect(shader.uniforms).toMatchObject({ conceptPaintColor: uniforms.color, conceptPaintBlend: uniforms.blend })
  uniforms.color.value.set('#42657d')
  uniforms.blend.value = 0
  expect((shader.uniforms as typeof shader.uniforms & { conceptPaintBlend: { value: number } }).conceptPaintBlend.value).toBe(0)
  expect(material.customProgramCacheKey()).toBe(key)
  expect(material.map).toBe(map)
  expect(material.clearcoat).toBe(0.85)
  expect(shader.fragmentShader).toContain('#include <normal_fragment_begin>')
})
