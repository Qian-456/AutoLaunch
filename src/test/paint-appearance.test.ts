import { expect, it, vi } from 'vitest'
import { Color, MeshPhysicalMaterial, Texture } from 'three'
import { bindPaintAppearance } from '../runtime/paint-appearance'

it('keeps texture detail and existing shader hooks while sharing live paint uniforms', () => {
  const map = new Texture()
  const material = new MeshPhysicalMaterial({ map, clearcoat: 0.85 })
  const previousCompile = vi.fn()
  material.onBeforeCompile = previousCompile
  const uniforms = { color: { value: new Color('#b8bec6') }, blend: { value: 1 }, keepLivery: { value: 1 } }
  bindPaintAppearance(material, uniforms)
  const key = material.customProgramCacheKey()
  const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>\n#include <normal_fragment_begin>' }
  material.onBeforeCompile(shader as never, {} as never)
  expect(previousCompile).toHaveBeenCalledOnce()
  expect(shader.uniforms).toMatchObject({ conceptPaintColor: uniforms.color, conceptPaintBlend: uniforms.blend, keepPaintLivery: uniforms.keepLivery })
  uniforms.color.value.set('#42657d')
  uniforms.blend.value = 0
  uniforms.keepLivery.value = 0
  expect((shader.uniforms as typeof shader.uniforms & { conceptPaintBlend: { value: number } }).conceptPaintBlend.value).toBe(0)
  expect((shader.uniforms as typeof shader.uniforms & { keepPaintLivery: { value: number } }).keepPaintLivery.value).toBe(0)
  expect(material.customProgramCacheKey()).toBe(key)
  expect(material.map).toBe(map)
  expect(material.clearcoat).toBe(0.85)
  expect(shader.fragmentShader).toContain('#include <normal_fragment_begin>')
})

it('keeps seat stitching independent of exterior livery changes', () => {
  const body = new MeshPhysicalMaterial(), seat = new MeshPhysicalMaterial()
  const bodyUniforms = { color: { value: new Color() }, blend: { value: 1 }, keepLivery: { value: 0 } }
  const seatUniforms = { color: { value: new Color() }, blend: { value: 0 } }
  bindPaintAppearance(body, bodyUniforms)
  bindPaintAppearance(seat, seatUniforms)
  const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>' }
  seat.onBeforeCompile(shader as never, {} as never)
  expect(shader.uniforms).toMatchObject({ keepPaintLivery: { value: 1 }, conceptPaintBlend: seatUniforms.blend })
  expect((shader.uniforms as { conceptPaintColor: unknown }).conceptPaintColor).not.toBe(bodyUniforms.color)
})
