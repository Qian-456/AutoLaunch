import { useEffect, useMemo, useRef, useState } from 'react'
import { Edges, useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Box3, Group, MathUtils, Plane, Vector3 } from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import type { PropCatalogEntry } from '../props/prop-catalog'
import { boundsForProp, findCargoPlacement, type CargoPlacementCandidate } from '../runtime/cargo-layout'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { useExperienceStore } from '../store/experience-store'

export function computePropHorizontalOffset(startOffset: number, pointerDeltaX: number) {
  return Math.max(-0.9, Math.min(0.9, startOffset + pointerDeltaX * 0.003))
}

const dragPlane = new Plane(new Vector3(0, 1, 0), 0)
const dragPoint = new Vector3()
const smoothStep = (value: number) => value * value * (3 - 2 * value)

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
  const dragActive = useRef(false)
  const animation = useRef<null | { startedAt: number; from: Vector3; to: Vector3; returning: boolean }>(null)
  const [candidate, setCandidate] = useState<CargoPlacementCandidate | null>(null)
  const placement = useExperienceStore((state) => state.cargoPlacements.get(entry.id))
  const cargoPlacements = useExperienceStore((state) => state.cargoPlacements)
  const setCargoPlacement = useExperienceStore((state) => state.setCargoPlacement)
  const removeCargoPlacement = useExperienceStore((state) => state.removeCargoPlacement)
  const [height, width, depth] = entry.dimensionsM

  const normalizedModel = useMemo(() => {
    const scene = SkeletonUtils.clone(gltf.scene)
    const bounds = new Box3().setFromObject(scene)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    return {
      scene,
      scale: [width / size.x, height / size.y, depth / size.z] as const,
      offset: [-center.x, -bounds.min.y, -center.z] as const,
    }
  }, [depth, gltf.scene, height, width])

  const visiblePosition = placement?.position ?? entry.stagePosition
  const visibleRotation = placement?.rotation ?? entry.stageRotation
  const onStage = !placement || placement.state === 'staged' || placement.state === 'dragging' || placement.state === 'returning'

  useEffect(() => {
    const group = root.current
    if (!group) return
    if (placement?.state === 'loading' || placement?.state === 'returning') {
      const from = new Vector3(...(placement.transitionFrom ?? (placement.state === 'loading' ? entry.stagePosition : visiblePosition)))
      animation.current = {
        startedAt: performance.now(),
        from,
        to: new Vector3(...placement.position),
        returning: placement.state === 'returning',
      }
      group.position.copy(from)
      return
    }
    animation.current = null
    group.position.set(...visiblePosition)
    group.rotation.set(0, visibleRotation[1], 0)
  }, [entry.stagePosition, placement?.state, placement?.transitionFrom, visiblePosition, visibleRotation])

  useFrame(() => {
    const group = root.current
    const active = animation.current
    if (!group || !active || !placement) return
    const rawProgress = Math.min(1, (performance.now() - active.startedAt) / 900)
    const progress = smoothStep(rawProgress)
    group.position.lerpVectors(active.from, active.to, progress)
    // A visible lift over the rear sill makes assisted placement read as a human-scale motion.
    group.position.y += Math.sin(progress * Math.PI) * 0.42
    group.rotation.y = MathUtils.lerp(group.rotation.y, placement.rotation[1], progress)
    if (rawProgress < 1) return
    animation.current = null
    if (active.returning) {
      removeCargoPlacement(entry.id)
      onFeedback(`${entry.name}已回到道具展台`)
    } else {
      setCargoPlacement({ ...placement, state: 'loaded', transitionFrom: undefined })
      useExperienceStore.getState().requestOrbit('cargo_overview')
      onFeedback(`${entry.name}已放入后备箱 · 示意布局，非官方测量结果`)
    }
  })

  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!selected || (placement && placement.state !== 'staged')) return
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    const target = event.nativeEvent.target
    if (target instanceof Element) target.setPointerCapture(event.pointerId)
    dragActive.current = true
    const position = root.current?.position.toArray() as [number, number, number] ?? [...entry.stagePosition]
    setCargoPlacement({
      propId: entry.id,
      state: 'dragging',
      position,
      rotation: entry.stageRotation,
      occupiedBounds: boundsForProp(entry, position, entry.stageRotation[1]),
      anchorId: null,
    })
    dispatchVehicleAction({ type: 'trunk', open: true })
    dispatchVehicleAction({ type: 'orbit', preset: 'cargo_rear' })
    onFeedback('拖向后备箱高亮区域，系统会自动寻找最近合法位置')
  }

  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragActive.current || !root.current) return
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    if (!event.ray.intersectPlane(dragPlane, dragPoint)) return
    const position = [dragPoint.x, Math.max(0.08, dragPoint.y), dragPoint.z] as const
    root.current.position.set(...position)
    const anchors = Object.entries(su7ConceptPack.cargoVolume.anchors)
      .map(([id, anchor]) => ({ id: id as keyof typeof su7ConceptPack.cargoVolume.anchors, distance: Math.hypot(position[0] - anchor.position[0], position[2] - anchor.position[2]) }))
      .sort((left, right) => left.distance - right.distance)
    const nearest = anchors[0]
    const existing = [...cargoPlacements.values()].filter((item) => item.propId !== entry.id && item.state !== 'returning')
    const result = nearest && nearest.distance < 1.15
      ? findCargoPlacement(entry.id, existing, nearest.id)
      : null
    setCandidate(result?.ok ? result.candidate : null)
    setCargoPlacement({
      propId: entry.id,
      state: 'dragging',
      position,
      rotation: entry.stageRotation,
      occupiedBounds: boundsForProp(entry, position, entry.stageRotation[1]),
      anchorId: result?.ok ? result.candidate.anchorId : null,
    })
  }

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragActive.current) return
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    dragActive.current = false
    const target = event.nativeEvent.target
    if (target instanceof Element && target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
    const currentPosition = root.current?.position.toArray() as [number, number, number] ?? [...entry.stagePosition]
    if (candidate) {
      const result = dispatchVehicleAction({ type: 'cargo', operation: 'place', propId: entry.id, preferredAnchor: candidate.anchorId })
      onFeedback(result.message)
    } else {
      setCargoPlacement({
        propId: entry.id,
        state: 'returning',
        transitionFrom: currentPosition,
        position: entry.stagePosition,
        rotation: entry.stageRotation,
        occupiedBounds: boundsForProp(entry, entry.stagePosition, entry.stageRotation[1]),
        anchorId: null,
      })
      onFeedback('未找到合法装载位置，行李箱将返回展台')
    }
    setCandidate(null)
  }

  return (
    <>
      {onStage && (
        <group position={entry.stagePosition} rotation={[...entry.stageRotation]}>
          <mesh position={[0, -0.04, 0]} receiveShadow>
            <cylinderGeometry args={[0.48, 0.52, 0.08, 64]} />
            <meshStandardMaterial color="#0d1215" roughness={0.3} metalness={0.72} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
            <ringGeometry args={[0.41, 0.445, 64]} />
            <meshBasicMaterial color={entry.previewColor} toneMapped={false} />
          </mesh>
        </group>
      )}
      <group
        ref={root}
        position={visiblePosition}
        rotation={[0, visibleRotation[1], 0]}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={() => { if (selected && !placement) document.body.style.cursor = 'grab' }}
        onPointerOut={() => { if (!dragActive.current) document.body.style.cursor = '' }}
      >
        <group rotation-x={visibleRotation[0]}>
          <group scale={normalizedModel.scale}>
            <primitive object={normalizedModel.scene} position={normalizedModel.offset} castShadow />
          </group>
        </group>
      </group>
      {candidate && (
        <mesh position={candidate.bounds.center} rotation-y={candidate.bounds.rotationY}>
          <boxGeometry args={[candidate.bounds.halfSize[0] * 2, candidate.bounds.halfSize[1] * 2, candidate.bounds.halfSize[2] * 2]} />
          <meshStandardMaterial color="#24e6c1" transparent opacity={0.18} depthWrite={false} />
          <Edges color="#65ffe2" />
        </mesh>
      )}
      {selected && showPropReferenceBox && onStage && !dragActive.current && (
        <mesh position={[entry.stagePosition[0] + width + 0.16, entry.stagePosition[1] + height / 2, entry.stagePosition[2]]} rotation={[...entry.stageRotation]}>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color="#35a7ff" transparent opacity={0.16} roughness={0.5} depthWrite={false} />
          <Edges color="#74c5ff" />
        </mesh>
      )}
    </>
  )
}
