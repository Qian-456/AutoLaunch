import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Color, type Mesh, type MeshStandardMaterial } from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import { VehiclePlate } from './VehiclePlate'

export function VehicleModel() {
  const gltf = useGLTF(su7ConceptPack.model.path)
  const renderer = useThree((state) => state.gl)
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])
  const setModelStatus = useExperienceStore((state) => state.setModelStatus)
  const setNotice = useExperienceStore((state) => state.setNotice)

  useEffect(() => {
    const missingNodes = Object.entries(su7ConceptPack.nodeMap)
      .filter(([, rawName]) => !scene.getObjectByName(rawName))
      .map(([semanticId]) => semanticId)
    console.info('[AutoLaunch] GLB nodes:', scene.children.map((node) => node.name))
    if (missingNodes.length) {
      console.warn('[AutoLaunch] missing node-map entries:', missingNodes)
      setNotice('⚠ 当前演示模型部分动作节点暂未映射，仅展示交互闭环。')
    }
    scene.traverse((object) => {
      object.castShadow = true
      object.receiveShadow = true
      if (su7ConceptPack.appearance.hiddenNodes.includes(object.name as never)) {
        object.visible = false
      }
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const clonedMaterials = sourceMaterials.map((source) => {
        const material = source.clone() as MeshStandardMaterial
        const maximumAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
        const textureMaps = [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
          material.aoMap,
        ]
        textureMaps.forEach((texture) => {
          if (texture) texture.anisotropy = maximumAnisotropy
        })
        const override = su7ConceptPack.appearance.materialOverrides.find((item) => item.material === material.name)
        if (override && material.isMeshStandardMaterial) {
          material.color = new Color(override.color)
          material.metalness = override.metalness
          material.roughness = override.roughness
          if ('removeColorMap' in override && override.removeColorMap) {
            material.map = null
            material.emissive.set('#000000')
            material.emissiveMap = null
            material.vertexColors = false
          }
          material.needsUpdate = true
        }
        return material
      })
      mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]
    })
    setModelStatus('ready')
  }, [renderer, scene, setModelStatus, setNotice])

  return (
    <group>
      <primitive
        object={scene}
        scale={su7ConceptPack.model.scale}
        position={su7ConceptPack.model.position}
        rotation={su7ConceptPack.model.rotation}
      />
      {su7ConceptPack.appearance.plates.map((plate) => (
        <VehiclePlate key={plate.id} {...plate} />
      ))}
    </group>
  )
}

useGLTF.preload(su7ConceptPack.model.path)
