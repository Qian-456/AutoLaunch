import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Edges, useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Box3, Group, MathUtils, Mesh, type Material, Vector3 } from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import type { PropCatalogEntry } from '../props/prop-catalog'
import { useExperienceStore } from '../store/experience-store'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'

export function computePropHorizontalOffset(startOffset: number, pointerDeltaX: number) {
  return Math.max(-0.9, Math.min(0.9, startOffset + pointerDeltaX * 0.003))
}

const smoothStep = (value: number) => value * value * (3 - 2 * value)
export function computeCargoDragPosition(
  start: Vector3,
  lift: Vector3,
  sill: Vector3,
  end: Vector3,
  progress: number,
) {
  const t = MathUtils.clamp(progress, 0, 1)
  const inverse = 1 - t
  return new Vector3(
    inverse ** 3 * start.x + 3 * inverse ** 2 * t * lift.x + 3 * inverse * t ** 2 * sill.x + t ** 3 * end.x,
    inverse ** 3 * start.y + 3 * inverse ** 2 * t * lift.y + 3 * inverse * t ** 2 * sill.y + t ** 3 * end.y,
    inverse ** 3 * start.z + 3 * inverse ** 2 * t * lift.z + 3 * inverse * t ** 2 * sill.z + t ** 3 * end.z,
  )
}

export function PropDisplay({
  entry,
  selected,
  showPropReferenceBox,
  onFeedback,
}: {
  entry: PropCatalogEntry
  selected: boolean
  showPropReferenceBox: boolean
  onFeedback: (message: string) => void
}) {
  const gltf = useGLTF(entry.modelPath)
  const root = useRef<Group>(null)
  const modelTilt = useRef<Group>(null)
  const animation = useRef<null | {
    startedAt: number
    from: Vector3
    to: Vector3
    controlOne: Vector3 | null
    controlTwo: Vector3 | null
    fromRotationX: number
    fromRotationY: number
    toRotationX: number
    toRotationY: number
    returning: boolean
  }>(null)
  const placement = useExperienceStore((state) => state.cargoPlacements.get(entry.id))
  const armed = useExperienceStore((state) => state.cargoArmedPropId === entry.id)
  const setCargoArmedProp = useExperienceStore((state) => state.setCargoArmedProp)
  const setCargoPlacement = useExperienceStore((state) => state.setCargoPlacement)
  const removeCargoPlacement = useExperienceStore((state) => state.removeCargoPlacement)
  const [height, width, depth] = entry.dimensionsM

  const normalizedModel = useMemo(() => {
    const scene = SkeletonUtils.clone(gltf.scene)
    const materials: Material[] = []
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const cloned = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone()
      object.material = cloned
      materials.push(...(Array.isArray(cloned) ? cloned : [cloned]))
    })
    const bounds = new Box3().setFromObject(scene)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    return {
      scene,
      scale: [width / size.x, height / size.y, depth / size.z] as const,
      offset: [-center.x, -bounds.min.y, -center.z] as const,
      materials,
    }
  }, [depth, gltf.scene, height, width])

  useEffect(() => {
    normalizedModel.materials.forEach((material) => {
      material.transparent = armed
      material.opacity = armed ? 0.38 : 1
      material.depthWrite = !armed
      material.needsUpdate = true
    })
  }, [armed, normalizedModel.materials])

  const visiblePosition = placement?.position ?? entry.stagePosition
  const visibleRotation = placement?.rotation ?? entry.stageRotation
  const onStage = !placement || placement.state === 'staged' || placement.state === 'dragging' || placement.state === 'returning'

  useLayoutEffect(() => {
    const group = root.current
    const tilt = modelTilt.current
    if (!group || !tilt) return
    if (placement?.state === 'loading' || placement?.state === 'returning') {
      const from = new Vector3(...(placement.transitionFrom ?? (placement.state === 'loading' ? entry.stagePosition : visiblePosition)))
      const to = new Vector3(...placement.position)
      const useGuidedPath = from.distanceTo(to) > 0.35
      animation.current = {
        startedAt: performance.now(),
        from,
        to,
        controlOne: placement.state === 'returning'
          ? new Vector3(Math.max(2.08, from.x), Math.max(from.y, 1.02), MathUtils.lerp(from.z, entry.stagePosition[2], 0.25))
          : useGuidedPath ? new Vector3(from.x, from.y + 0.12, from.z) : null,
        controlTwo: placement.state === 'returning'
          ? new Vector3(entry.stagePosition[0], entry.stagePosition[1] + 0.12, entry.stagePosition[2])
          : useGuidedPath ? new Vector3(2.04, to.y + 0.15, MathUtils.lerp(from.z, to.z, 0.82)) : null,
        fromRotationX: tilt.rotation.x,
        fromRotationY: group.rotation.y,
        toRotationX: placement.rotation[0],
        toRotationY: placement.rotation[1],
        returning: placement.state === 'returning',
      }
      group.position.copy(from)
      return
    }
    animation.current = null
    group.position.set(...visiblePosition)
    group.rotation.set(0, visibleRotation[1], 0)
    tilt.rotation.set(visibleRotation[0], 0, 0)
  }, [entry.stagePosition, placement?.state, placement?.transitionFrom, visiblePosition, visibleRotation])

  useFrame(() => {
    const group = root.current
    const tilt = modelTilt.current
    const active = animation.current
    if (!group || !tilt || !active || !placement) return
    const rawProgress = Math.min(1, (performance.now() - active.startedAt) / 620)
    const progress = smoothStep(rawProgress)
    if (active.controlOne && active.controlTwo) {
      group.position.copy(computeCargoDragPosition(active.from, active.controlOne, active.controlTwo, active.to, progress))
    } else {
      group.position.lerpVectors(active.from, active.to, progress)
      group.position.y += Math.sin(progress * Math.PI) * 0.06
    }
    tilt.rotation.x = MathUtils.lerp(active.fromRotationX, active.toRotationX, progress)
    group.rotation.y = MathUtils.lerp(active.fromRotationY, active.toRotationY, progress)
    if (rawProgress < 1) return
    animation.current = null
    if (active.returning) {
      removeCargoPlacement(entry.id)
      onFeedback(`${entry.name}已回到道具展台`)
    } else {
      setCargoPlacement({ ...placement, state: 'loaded', transitionFrom: undefined })
      onFeedback(`${entry.name}已放入后备箱 · 示意布局，非官方测量结果`)
    }
  })

  const toggleArmed = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    if (placement?.state === 'loaded') {
      const result = dispatchVehicleAction({ type: 'cargo', operation: 'remove', propId: entry.id })
      onFeedback(result.message)
      return
    }
    if (!selected || placement) return
    setCargoArmedProp(armed ? null : entry.id)
    onFeedback(armed
      ? `${entry.name}已取消选择`
      : `${entry.name}已选中；请点击后备箱内的左侧或右侧区域`)
  }

  return (
    <>
      {onStage && (
        <group position={entry.stagePosition} rotation={[...entry.stageRotation]}>
          <mesh position={[0, -0.035, 0]} receiveShadow>
            <boxGeometry args={[0.72, 0.04, 0.5]} />
            <meshStandardMaterial color="#0d1215" roughness={0.3} metalness={0.72} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
            <planeGeometry args={[0.66, 0.44]} />
            <meshBasicMaterial color="#21483f" transparent opacity={0.55} toneMapped={false} />
          </mesh>
        </group>
      )}
      <group
        ref={root}
        onClick={toggleArmed}
        onPointerOver={() => { if ((selected && !placement) || placement?.state === 'loaded') document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = '' }}
      >
        <group ref={modelTilt}>
          <group scale={normalizedModel.scale}>
            <primitive object={normalizedModel.scene} position={normalizedModel.offset} castShadow />
          </group>
        </group>
      </group>
      {selected && showPropReferenceBox && onStage && !armed && (
        <mesh position={[entry.stagePosition[0] + width + 0.16, entry.stagePosition[1] + height / 2, entry.stagePosition[2]]} rotation={[...entry.stageRotation]}>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color="#35a7ff" transparent opacity={0.16} roughness={0.5} depthWrite={false} />
          <Edges color="#74c5ff" />
        </mesh>
      )}
    </>
  )
}
