import { useLayoutEffect, useMemo, useRef } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Box3, Color, Group, MathUtils, Mesh, type Material, Vector3 } from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import type { PropCatalogEntry } from '../props/prop-catalog'
import type { CargoPlacement } from '../types'
import { useExperienceStore } from '../store/experience-store'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'

const smoothStep = (value: number) => value * value * (3 - 2 * value)

export function preloadCargoProps() {
  useGLTF.preload('/assets/suitcase-carry-on-20.glb')
  useGLTF.preload('/assets/suitcase-checked-24.glb')
}

export function computeCargoDragPosition(start: Vector3, lift: Vector3, sill: Vector3, end: Vector3, progress: number) {
  const t = MathUtils.clamp(progress, 0, 1)
  const inverse = 1 - t
  return new Vector3(
    inverse ** 3 * start.x + 3 * inverse ** 2 * t * lift.x + 3 * inverse * t ** 2 * sill.x + t ** 3 * end.x,
    inverse ** 3 * start.y + 3 * inverse ** 2 * t * lift.y + 3 * inverse * t ** 2 * sill.y + t ** 3 * end.y,
    inverse ** 3 * start.z + 3 * inverse ** 2 * t * lift.z + 3 * inverse * t ** 2 * sill.z + t ** 3 * end.z,
  )
}

function useNormalizedProp(entry: PropCatalogEntry, tint?: string) {
  const gltf = useGLTF(entry.modelPath)
  const [height, width, depth] = entry.dimensionsM
  return useMemo(() => {
    const scene = SkeletonUtils.clone(gltf.scene)
    const materials: Material[] = []
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const cloned = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone()
      object.material = cloned
      const list = Array.isArray(cloned) ? cloned : [cloned]
      for (const material of list) {
        if (tint && 'color' in material) (material as Material & { color: Color }).color = new Color(tint)
        material.transparent = Boolean(tint)
        material.opacity = tint ? 0.42 : 1
        material.depthWrite = !tint
        material.needsUpdate = true
      }
      materials.push(...list)
    })
    const bounds = new Box3().setFromObject(scene)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    return {
      scene,
      scale: [width / size.x, height / size.y, depth / size.z] as const,
      offset: [-center.x, -center.y, -center.z] as const,
      materials,
    }
  }, [depth, gltf.scene, height, tint, width])
}

export function CargoGhost({ entry, placement, valid }: {
  entry: PropCatalogEntry
  placement: CargoPlacement
  valid: boolean
}) {
  const model = useNormalizedProp(entry, valid ? '#25e6c2' : '#ff5d66')
  return (
    <group position={placement.position} rotation-y={placement.rotation[1]}>
      <group rotation={[placement.rotation[0], 0, placement.rotation[2]]}>
        <group scale={model.scale}>
          <primitive object={model.scene} position={model.offset} />
        </group>
      </group>
    </group>
  )
}

export function PropDisplay({
  entry,
  placement,
  selected,
  onFeedback,
}: {
  entry: PropCatalogEntry
  placement: CargoPlacement
  selected: boolean
  onFeedback: (message: string) => void
}) {
  const model = useNormalizedProp(entry)
  const root = useRef<Group>(null)
  const animation = useRef<null | { startedAt: number; from: Vector3; to: Vector3; returning: boolean }>(null)
  const setCargoPlacement = useExperienceStore((state) => state.setCargoPlacement)
  const removeCargoPlacement = useExperienceStore((state) => state.removeCargoPlacement)
  const setSelectedCargoInstance = useExperienceStore((state) => state.setSelectedCargoInstance)

  useLayoutEffect(() => {
    const group = root.current
    if (!group) return
    if ((placement.state === 'loading' || placement.state === 'returning') && placement.transitionFrom) {
      const from = new Vector3(...placement.transitionFrom)
      animation.current = { startedAt: performance.now(), from, to: new Vector3(...placement.position), returning: placement.state === 'returning' }
      group.position.copy(from)
    } else {
      animation.current = null
      group.position.set(...placement.position)
    }
    // Yaw is applied by the outer group. The stable 90° pose is applied by a
    // nested group below so the visual transform follows the same order as the
    // collision solver: pose first, then horizontal yaw.
    group.rotation.set(0, placement.rotation[1], 0)
  }, [placement.position, placement.rotation, placement.state, placement.transitionFrom])

  useFrame(() => {
    const group = root.current
    const active = animation.current
    if (!group || !active) return
    const raw = Math.min(1, (performance.now() - active.startedAt) / 420)
    const progress = smoothStep(raw)
    group.position.lerpVectors(active.from, active.to, progress)
    group.position.y += Math.sin(progress * Math.PI) * 0.08
    if (raw < 1) return
    animation.current = null
    if (active.returning) {
      removeCargoPlacement(placement.instanceId)
      onFeedback(`${entry.name}已收回道具仓库`)
    } else {
      setCargoPlacement({ ...placement, state: 'loaded', transitionFrom: undefined })
    }
  })

  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (placement.state !== 'loaded') return
    setSelectedCargoInstance(selected ? null : placement.instanceId)
  }

  const adjust = (operation: 'rotate' | 'pose') => {
    const move = dispatchVehicleAction({ type: 'cargo', operation: 'move', instanceId: placement.instanceId })
    if (!move.ok) return onFeedback(move.message)
    const result = operation === 'rotate'
      ? dispatchVehicleAction({ type: 'cargo', operation: 'rotate', direction: 1 })
      : dispatchVehicleAction({ type: 'cargo', operation: 'rotate' })
    onFeedback(result.message)
  }

  return (
    <group ref={root} onClick={select} onPointerOver={() => { document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}>
      <group rotation={[placement.rotation[0], 0, placement.rotation[2]]}>
        <group scale={model.scale}>
          <primitive object={model.scene} position={model.offset} castShadow />
        </group>
      </group>
      {selected && placement.state === 'loaded' && (
        <Html position={[0, placement.occupiedBounds.halfSize[1] + 0.14, 0]} center>
          <div className="cargo-instance-toolbar" onPointerDown={(event) => event.stopPropagation()}>
            <strong>{entry.name}</strong>
            <button onClick={() => onFeedback(dispatchVehicleAction({ type: 'cargo', operation: 'move', instanceId: placement.instanceId }).message)}>移动</button>
            <button onClick={() => adjust('rotate')}>旋转</button>
            <button onClick={() => adjust('pose')}>换姿态</button>
            <button onClick={() => onFeedback(dispatchVehicleAction({ type: 'cargo', operation: 'remove', instanceId: placement.instanceId }).message)}>取出</button>
          </div>
        </Html>
      )}
    </group>
  )
}
