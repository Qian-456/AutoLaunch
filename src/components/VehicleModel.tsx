import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, Group, MathUtils, Mesh, Object3D, type MeshStandardMaterial } from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import type { ActiveVehicleAction } from '../types'
import { VehicleLightEffects } from './VehicleLightEffects'
import { VehiclePlate } from './VehiclePlate'

type TransformAnimation = {
  kind: 'window' | 'trunk'
  execution: ActiveVehicleAction
  object: Object3D
  from: number
  to: number
  startedAt: number
  materials?: MeshStandardMaterial[]
  fromOpacity?: number
  toOpacity?: number
}

type LightAnimation = {
  kind: 'lights'
  execution: ActiveVehicleAction
  materials: MeshStandardMaterial[]
  from: number
  to: number
  color: Color
  lensMaterials: MeshStandardMaterial[]
  lensFrom: number
  lensTo: number
  startedAt: number
}

type FallbackAnimation = {
  kind: 'fallback'
  execution: ActiveVehicleAction
  startedAt: number
}

type RuntimeAnimation = TransformAnimation | LightAnimation | FallbackAnimation

function collectStandardMaterials(root: Object3D | null | undefined) {
  const materials: MeshStandardMaterial[] = []
  root?.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of sourceMaterials) {
      const standard = material as MeshStandardMaterial
      if (standard.isMeshStandardMaterial && !materials.includes(standard)) materials.push(standard)
    }
  })
  return materials
}

export function VehicleModel() {
  const gltf = useGLTF(su7ConceptPack.model.path)
  const renderer = useThree((state) => state.gl)
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])
  const vehicleRoot = useRef<Group>(null)
  const windowClosedY = useRef<number | null>(null)
  const vehicleClosedY = useRef(0)
  const runtimeAnimations = useRef(new Map<string, RuntimeAnimation>())
  const activeActions = useExperienceStore((state) => state.activeActions)
  const setModelStatus = useExperienceStore((state) => state.setModelStatus)
  const setNotice = useExperienceStore((state) => state.setNotice)
  const requestOrbit = useExperienceStore((state) => state.requestOrbit)
  const finishAction = useExperienceStore((state) => state.finishAction)

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
      if (su7ConceptPack.appearance.hiddenNodes.includes(object.name as never)) object.visible = false
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const clonedMaterials = sourceMaterials.map((source) => {
        const material = source.clone() as MeshStandardMaterial
        const maximumAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
        const textureMaps = [material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap]
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
          if ('envMapIntensity' in nodeOverride) material.envMapIntensity = nodeOverride.envMapIntensity
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

    const windowNode = scene.getObjectByName(su7ConceptPack.nodeMap.window_driver_front)
    if (windowNode) windowClosedY.current = windowNode.position.y
    if (vehicleRoot.current) vehicleClosedY.current = vehicleRoot.current.position.y
    setModelStatus('ready')
  }, [renderer, scene, setModelStatus, setNotice])

  useEffect(() => {
    for (const id of runtimeAnimations.current.keys()) {
      if (!activeActions.has(id)) runtimeAnimations.current.delete(id)
    }

    for (const execution of activeActions.values()) {
      if (runtimeAnimations.current.has(execution.id)) continue
      const startedAt = performance.now()

      if (execution.action.type === 'window') {
        const node = scene.getObjectByName(su7ConceptPack.nodeMap.window_driver_front)
        if (!node || windowClosedY.current === null) {
          requestOrbit('driver_side')
          setNotice('当前演示模型车窗节点暂不可用，已用镜头聚焦代替。')
          runtimeAnimations.current.set(execution.id, { kind: 'fallback', execution, startedAt })
          continue
        }
        const definition = su7ConceptPack.actions.window_driver_front
        const materials = collectStandardMaterials(node)
        runtimeAnimations.current.set(execution.id, {
          kind: 'window',
          execution,
          object: node,
          from: node.position.y,
          to: windowClosedY.current + (execution.targetValue ? definition.openOffset : definition.closedOffset),
          startedAt,
          materials,
          fromOpacity: materials[0]?.opacity ?? 1,
          toOpacity: execution.targetValue ? 0.04 : 1,
        })
        continue
      }

      if (execution.action.type === 'trunk') {
        const root = vehicleRoot.current
        if (!root) {
          runtimeAnimations.current.set(execution.id, { kind: 'fallback', execution, startedAt })
          continue
        }
        runtimeAnimations.current.set(execution.id, {
          kind: 'trunk',
          execution,
          object: root,
          from: root.position.y,
          to: vehicleClosedY.current + (execution.targetValue ? su7ConceptPack.actions.trunk.visualLift : 0),
          startedAt,
        })
        continue
      }

      const definition = execution.action.target === 'headlight'
        ? su7ConceptPack.actions.lights_headlight
        : su7ConceptPack.actions.lights_taillight
      const materials = definition.emissiveNodes.flatMap((nodeName) =>
        collectStandardMaterials(scene.getObjectByName(nodeName)),
      )
      const lensSemanticIds = execution.action.target === 'headlight'
        ? ['headlight_left', 'headlight_right'] as const
        : ['taillight_left', 'taillight_right'] as const
      const lensMaterials = lensSemanticIds.flatMap((semanticId) =>
        collectStandardMaterials(scene.getObjectByName(su7ConceptPack.nodeMap[semanticId])),
      )
      if (!materials.length && !lensMaterials.length) {
        console.warn(`[AutoLaunch] missing ${execution.action.target} materials; using body emissive fallback`)
        materials.push(...collectStandardMaterials(scene.getObjectByName(su7ConceptPack.nodeMap.body)))
      }
      runtimeAnimations.current.set(execution.id, {
        kind: 'lights',
        execution,
        materials,
        from: materials[0]?.emissiveIntensity ?? 0,
        to: definition.emissiveIntensity[execution.targetValue ? 1 : 0],
        color: new Color(definition.color),
        lensMaterials,
        lensFrom: lensMaterials[0]?.emissiveIntensity ?? 0,
        lensTo: definition.lensEmissiveIntensity[execution.targetValue ? 1 : 0],
        startedAt,
      })
    }
  }, [activeActions, requestOrbit, scene, setNotice])

  useFrame(() => {
    const now = performance.now()
    const activeNow = useExperienceStore.getState().activeActions
    for (const [id, animation] of runtimeAnimations.current) {
      const execution = activeNow.get(id)
      if (!execution) {
        runtimeAnimations.current.delete(id)
        continue
      }
      if (Date.now() > execution.timeoutAt) {
        if (animation.kind === 'window' || animation.kind === 'trunk') {
          animation.object.position.y = animation.from
          if (animation.kind === 'window' && animation.materials && animation.fromOpacity !== undefined) {
            animation.materials.forEach((material) => { material.opacity = animation.fromOpacity! })
          }
        }
        if (animation.kind === 'lights') {
          animation.materials.forEach((material) => { material.emissiveIntensity = animation.from })
          animation.lensMaterials.forEach((material) => { material.emissiveIntensity = animation.lensFrom })
        }
        finishAction(id, 'failed')
        runtimeAnimations.current.delete(id)
        continue
      }

      const progress = Math.min(1, (now - animation.startedAt) / execution.durationMs)
      const eased = MathUtils.smoothstep(progress, 0, 1)
      if (animation.kind === 'window' || animation.kind === 'trunk') {
        animation.object.position.y = MathUtils.lerp(animation.from, animation.to, eased)
        if (
          animation.kind === 'window'
          && animation.materials
          && animation.fromOpacity !== undefined
          && animation.toOpacity !== undefined
        ) {
          const opacity = MathUtils.lerp(animation.fromOpacity, animation.toOpacity, eased)
          animation.materials.forEach((material) => {
            material.transparent = true
            material.opacity = opacity
            material.needsUpdate = true
          })
        }
      } else if (animation.kind === 'lights') {
        const intensity = MathUtils.lerp(animation.from, animation.to, eased)
        animation.materials.forEach((material) => {
          material.emissive.copy(animation.color)
          material.emissiveIntensity = intensity
          material.needsUpdate = true
        })
        const lensIntensity = MathUtils.lerp(animation.lensFrom, animation.lensTo, eased)
        animation.lensMaterials.forEach((material) => {
          material.emissive.copy(animation.color)
          material.emissiveIntensity = lensIntensity
          material.needsUpdate = true
        })
      }

      if (progress >= 1) {
        finishAction(id, 'completed')
        runtimeAnimations.current.delete(id)
      }
    }
  })

  return (
    <group ref={vehicleRoot}>
      <primitive
        object={scene}
        scale={su7ConceptPack.model.scale}
        position={su7ConceptPack.model.position}
        rotation={su7ConceptPack.model.rotation}
      />
      {su7ConceptPack.appearance.plates.map((plate) => (
        <VehiclePlate key={plate.id} {...plate} />
      ))}
      <VehicleLightEffects />
    </group>
  )
}

useGLTF.preload(su7ConceptPack.model.path)
