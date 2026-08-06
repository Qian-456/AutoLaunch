import { useEffect, useMemo, useRef, useState } from 'react'
import { Edges, useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import type { PropCatalogEntry } from '../props/prop-catalog'

export function computePropHorizontalOffset(startOffset: number, pointerDeltaX: number) {
  return Math.max(-0.9, Math.min(0.9, startOffset + pointerDeltaX * 0.003))
}

export function PropDisplay({
  entry,
  showPropReferenceBox,
}: {
  entry: PropCatalogEntry
  showPropReferenceBox: boolean
}) {
  const gltf = useGLTF(entry.modelPath)
  const [horizontalOffset, setHorizontalOffset] = useState(0)
  const dragStart = useRef<{ clientX: number; offset: number } | null>(null)
  const [height, width, depth] = entry.dimensionsM
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])
  const referenceBoxPosition: [number, number, number] = [width + 0.16, height / 2, 0]

  useEffect(() => {
    if (showPropReferenceBox) return
    dragStart.current = null
    setHorizontalOffset(0)
    document.body.style.cursor = ''
  }, [showPropReferenceBox])

  const startHorizontalDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!showPropReferenceBox) return
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    const pointerTarget = event.nativeEvent.target
    if (pointerTarget instanceof Element) pointerTarget.setPointerCapture(event.pointerId)
    dragStart.current = { clientX: event.clientX, offset: horizontalOffset }
  }

  const moveHorizontally = (event: ThreeEvent<PointerEvent>) => {
    if (!showPropReferenceBox || !dragStart.current) return
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    setHorizontalOffset(computePropHorizontalOffset(dragStart.current.offset, event.clientX - dragStart.current.clientX))
  }

  const stopHorizontalDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragStart.current) return
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    dragStart.current = null
    const pointerTarget = event.nativeEvent.target
    if (pointerTarget instanceof Element && pointerTarget.hasPointerCapture(event.pointerId)) {
      pointerTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <group position={[...entry.stagePosition]} rotation={[...entry.stageRotation]}>
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.48, 0.52, 0.08, 64]} />
        <meshStandardMaterial color="#0d1215" roughness={0.3} metalness={0.72} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
        <ringGeometry args={[0.41, 0.445, 64]} />
        <meshBasicMaterial color={entry.previewColor} toneMapped={false} />
      </mesh>
      <group
        position-x={horizontalOffset}
        onPointerDown={startHorizontalDrag}
        onPointerMove={moveHorizontally}
        onPointerUp={stopHorizontalDrag}
        onPointerCancel={stopHorizontalDrag}
        onPointerOver={() => { if (showPropReferenceBox) document.body.style.cursor = 'ew-resize' }}
        onPointerOut={() => { if (!dragStart.current) document.body.style.cursor = '' }}
      >
        <primitive object={scene} />
      </group>
      {showPropReferenceBox && (
        <mesh position={referenceBoxPosition} castShadow receiveShadow>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color="#35a7ff" transparent opacity={0.16} roughness={0.5} depthWrite={false} />
          <Edges color="#74c5ff" />
        </mesh>
      )}
    </group>
  )
}
