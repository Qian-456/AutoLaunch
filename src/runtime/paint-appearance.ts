import { Color, type MeshStandardMaterial } from 'three'

export type PaintUniforms = { color: { value: Color }; blend: { value: number }; keepLivery?: { value: number } }

/** Recolour yellow pigment and optionally hide livery without rebuilding model materials. */
export function bindPaintAppearance(material: MeshStandardMaterial, uniforms: PaintUniforms) {
  const previousCompile = material.onBeforeCompile.bind(material)
  const previousKey = material.customProgramCacheKey.bind(material)()
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer)
    shader.uniforms.conceptPaintColor = uniforms.color
    shader.uniforms.conceptPaintBlend = uniforms.blend
    shader.uniforms.keepPaintLivery = uniforms.keepLivery ?? { value: 1 }
    shader.fragmentShader = 'uniform vec3 conceptPaintColor;\nuniform float conceptPaintBlend;\nuniform float keepPaintLivery;\n' + shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       float paintChroma = (min(diffuseColor.r, diffuseColor.g) - diffuseColor.b) / max(max(diffuseColor.r, diffuseColor.g), 0.001);
       float paintMask = smoothstep(0.25, 0.55, paintChroma);
       float paintValue = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
       // The pack's paint map contains only pigment, livery and a black trim island.
       paintMask = mix(smoothstep(0.005, 0.025, max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b)), paintMask, keepPaintLivery);
       paintValue = mix(0.72, paintValue, keepPaintLivery);
       diffuseColor.rgb = mix(diffuseColor.rgb, conceptPaintColor * paintValue, paintMask * conceptPaintBlend);`,
    )
  }
  material.customProgramCacheKey = () => `${previousKey}:concept-paint-v2`
  material.needsUpdate = true
}
