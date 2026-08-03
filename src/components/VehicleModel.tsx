import { useEffect, useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Color, Mesh, MeshPhysicalMaterial, type MeshStandardMaterial } from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import { VehiclePlate } from './VehiclePlate'

export function VehicleModel() {
  const gltf = useGLTF(su7ConceptPack.model.path)
  const renderer = useThree((state) => state.gl)
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])
  const silverStripeMask = useTexture(su7ConceptPack.appearance.decalMeshes[0].alphaMap)
  const setModelStatus = useExperienceStore((state) => state.setModelStatus)
  const setNotice = useExperienceStore((state) => state.setNotice)

  useEffect(() => {
    const decalOverlays: Mesh[] = []
    silverStripeMask.flipY = false
    silverStripeMask.needsUpdate = true

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
        const nodeOverride = su7ConceptPack.appearance.nodeOverrides.find((item) => item.node === object.name)
        if (nodeOverride && material.isMeshStandardMaterial) {
          material.color = new Color(nodeOverride.color)
          material.metalness = nodeOverride.metalness
          material.roughness = nodeOverride.roughness
          material.map = null
          material.emissive.set('#000000')
          material.emissiveMap = null
          material.vertexColors = false
          if ('envMapIntensity' in nodeOverride) {
            material.envMapIntensity = nodeOverride.envMapIntensity
          }
          if ('removeAllMaps' in nodeOverride && nodeOverride.removeAllMaps) {
            material.normalMap = null
            material.roughnessMap = null
            material.metalnessMap = null
            material.aoMap = null
          }
          material.needsUpdate = true
        }
        const colorMapRestore = su7ConceptPack.appearance.colorMapRestores.find((item) =>
          item.nodes.includes(object.name as never),
        )
        if (colorMapRestore && material.isMeshStandardMaterial) {
          material.color = new Color(colorMapRestore.color)
          material.metalness = colorMapRestore.metalness
          material.roughness = colorMapRestore.roughness
          material.map = (source as MeshStandardMaterial).map
          material.emissive.set('#000000')
          material.emissiveMap = null
          material.vertexColors = false
          material.needsUpdate = true
        }
        return material
      })
      mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]
    })

    for (const decal of su7ConceptPack.appearance.decalMeshes) {
      const sourceMeshes: Mesh[] = []
      scene.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh || decal.excludeNodes.includes(mesh.name as never)) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        if (materials.some((material) => material.name === decal.sourceMaterial)) {
          sourceMeshes.push(mesh)
        }
      })

      for (const sourceMesh of sourceMeshes) {
        const material = new MeshPhysicalMaterial({
          name: `${decal.name}_Material`,
          color: decal.color,
          metalness: decal.metalness,
          roughness: decal.roughness,
          alphaMap: silverStripeMask,
          alphaTest: decal.alphaTest,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: decal.polygonOffsetFactor,
          polygonOffsetUnits: decal.polygonOffsetFactor,
        })
        const overlay = new Mesh(sourceMesh.geometry, material)
        overlay.name = `${decal.name}__${sourceMesh.name}`
        overlay.position.copy(sourceMesh.position)
        overlay.quaternion.copy(sourceMesh.quaternion)
        overlay.scale.copy(sourceMesh.scale)
        overlay.renderOrder = 2
        overlay.castShadow = false
        overlay.receiveShadow = false
        sourceMesh.parent?.add(overlay)
        decalOverlays.push(overlay)
      }
    }
    setModelStatus('ready')
    return () => {
      for (const overlay of decalOverlays) {
        overlay.removeFromParent()
        const materials = Array.isArray(overlay.material) ? overlay.material : [overlay.material]
        materials.forEach((material) => material.dispose())
      }
    }
  }, [renderer, scene, setModelStatus, setNotice, silverStripeMask])

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
