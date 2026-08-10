import { Component, Suspense, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import { ContactShadows, Edges, Html, useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { Box3, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import { VehicleModel } from './VehicleModel'
import { OrbitCameraRig } from './OrbitCameraRig'
import { useExperienceStore } from '../store/experience-store'
import { PropDisplay } from './PropDisplay'
import { propCatalog, type PropCatalogEntry } from '../props/prop-catalog'
import { findCargoPlacement } from '../runtime/cargo-layout'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import type { CargoAnchorId } from '../types'

class PropDisplayBoundary extends Component<{
  children: ReactNode
  assetId: string
  onError: (assetId: string) => void
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AutoLaunch] prop failed to load:', error, info)
    this.props.onError(this.props.assetId)
  }

  componentDidUpdate(previous: Readonly<{ assetId: string }>) {
    if (previous.assetId !== this.props.assetId && this.state.failed) this.setState({ failed: false })
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function LaunchStage() {
  return (
    <group>
      <mesh position={[0, -0.085, 0]} receiveShadow>
        <cylinderGeometry args={[4.65, 4.82, 0.13, 96]} />
        <meshStandardMaterial color="#0a1012" roughness={0.28} metalness={0.78} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.012, 0]}>
        <ringGeometry args={[4.02, 4.07, 128]} />
        <meshBasicMaterial color="#24e6c1" toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <ringGeometry args={[3.35, 3.38, 128]} />
        <meshBasicMaterial color="#467067" toneMapped={false} />
      </mesh>
      <spotLight position={[0, 7, 0]} intensity={4.2} angle={0.5} penumbra={0.9} color="#bfffee" />
    </group>
  )
}

function CargoPlacementTargets({ onFeedback }: { onFeedback: (message: string) => void }) {
  const armedPropId = useExperienceStore((state) => state.cargoArmedPropId)
  const cargoPlacements = useExperienceStore((state) => state.cargoPlacements)
  if (!armedPropId) return null
  const existing = [...cargoPlacements.values()].filter(
    (placement) => placement.propId !== armedPropId && placement.state !== 'returning',
  )
  const targetDefinitions: Array<{ anchorId: CargoAnchorId; label: string; color: string }> = [
    { anchorId: 'rear_left', label: '左侧', color: '#24e6c1' },
    { anchorId: 'rear_right', label: '右侧', color: '#55aaff' },
  ]

  return (
    <>
      {targetDefinitions.map(({ anchorId, label, color }) => {
        const result = findCargoPlacement(armedPropId, existing, anchorId)
        if (!result.ok) return null
        const candidate = result.candidate
        const placeHere = (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          event.nativeEvent.stopImmediatePropagation()
          const dispatched = dispatchVehicleAction({
            type: 'cargo',
            operation: 'place',
            propId: armedPropId,
            preferredAnchor: anchorId,
          })
          onFeedback(dispatched.message)
        }
        return (
          <group key={anchorId}>
            <mesh
              position={[candidate.bounds.center[0], su7ConceptPack.cargoVolume.floorY + 0.014, candidate.bounds.center[2]]}
              rotation-y={candidate.bounds.rotationY}
              onClick={placeHere}
              onPointerOver={() => { document.body.style.cursor = 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = '' }}
            >
              <boxGeometry args={[candidate.bounds.halfSize[0] * 2 + 0.04, 0.022, candidate.bounds.halfSize[2] * 2 + 0.04]} />
              <meshStandardMaterial color={color} transparent opacity={0.2} depthWrite={false} />
              <Edges color={color} />
            </mesh>
            <Html
              position={[candidate.bounds.center[0], su7ConceptPack.cargoVolume.floorY + 0.08, candidate.bounds.center[2]]}
              center
              style={{ pointerEvents: 'none' }}
            >
              <span className="cargo-target-label">点击放在{label}</span>
            </Html>
          </group>
        )
      })}
    </>
  )
}

function CargoGhost({ entry, position, rotationX, rotationY }: {
  entry: PropCatalogEntry
  position: readonly [number, number, number]
  rotationX: number
  rotationY: number
}) {
  const gltf = useGLTF(entry.modelPath)
  const [height, width, depth] = entry.dimensionsM
  const ghost = useMemo(() => {
    const scene = SkeletonUtils.clone(gltf.scene)
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const makePlacementMaterial = () => new MeshBasicMaterial({
        color: '#36b8ff',
        transparent: true,
        opacity: 0.34,
        wireframe: false,
        depthWrite: false,
        toneMapped: false,
      })
      object.material = Array.isArray(object.material)
        ? object.material.map(makePlacementMaterial)
        : makePlacementMaterial()
    })
    const bounds = new Box3().setFromObject(scene)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    return {
      scene,
      scale: [width / size.x, height / size.y, depth / size.z] as const,
      offset: [-center.x, -bounds.min.y, -center.z] as const,
    }
  }, [depth, gltf.scene, height, width])

  return (
    <group position={position} rotation-y={rotationY}>
      <group rotation-x={rotationX}>
        <group scale={ghost.scale}>
          <primitive object={ghost.scene} position={ghost.offset} />
        </group>
      </group>
    </group>
  )
}

function CargoHoverPlacementTarget({ onFeedback }: { onFeedback: (message: string) => void }) {
  const armedPropId = useExperienceStore((state) => state.cargoArmedPropId)
  const cargoPlacements = useExperienceStore((state) => state.cargoPlacements)
  const [hoveredAnchor, setHoveredAnchor] = useState<CargoAnchorId | null>(null)
  if (!armedPropId) return null
  const entry = propCatalog.find((candidate) => candidate.id === armedPropId)
  if (!entry) return null
  const existing = [...cargoPlacements.values()].filter(
    (placement) => placement.propId !== armedPropId && placement.state !== 'returning',
  )
  const result = hoveredAnchor ? findCargoPlacement(armedPropId, existing, hoveredAnchor) : null
  const candidate = result?.ok ? result.candidate : null
  // Positive world Z appears on the left in the registered rear camera.
  const visualLabel = hoveredAnchor === 'rear_right' ? '左侧' : '右侧'

  const updateSide = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHoveredAnchor(event.point.z >= 0 ? 'rear_right' : 'rear_left')
  }

  const placeHere = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
    if (!hoveredAnchor || !candidate) return
    const dispatched = dispatchVehicleAction({
      type: 'cargo',
      operation: 'place',
      propId: armedPropId,
      preferredAnchor: hoveredAnchor,
    })
    onFeedback(dispatched.message)
    setHoveredAnchor(null)
  }

  return (
    <group>
      <mesh
        position={[1.56, su7ConceptPack.cargoVolume.floorY + 0.34, 0]}
        onPointerMove={updateSide}
        onPointerOver={(event) => {
          updateSide(event)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHoveredAnchor(null)
          document.body.style.cursor = ''
        }}
        onClick={placeHere}
      >
        <boxGeometry args={[0.92, 0.68, 1.12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {candidate && (
        <>
          <CargoGhost
            entry={entry}
            position={candidate.position}
            rotationX={candidate.rotation[0]}
            rotationY={candidate.rotation[1]}
          />
          <Html
            position={[candidate.bounds.center[0], su7ConceptPack.cargoVolume.floorY + 0.24, candidate.bounds.center[2]]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <span className="cargo-target-label">点击放在{visualLabel}</span>
          </Html>
        </>
      )}
    </group>
  )
}

export function Experience({
  selectedProp,
  showPropReferenceBox,
  onPropLoadError,
  onCargoFeedback,
}: {
  selectedProp: PropCatalogEntry | null
  showPropReferenceBox: boolean
  onPropLoadError: (assetId: string) => void
  onCargoFeedback: (message: string) => void
}) {
  const stageMode = useExperienceStore((state) => state.stageMode)
  const cargoPlacements = useExperienceStore((state) => state.cargoPlacements)

  return (
    <>
      <color attach="background" args={['#090b0e']} />
      <fog attach="fog" args={['#090b0e', 10, 22]} />
      <ambientLight intensity={0.82} />
      <directionalLight
        castShadow
        position={[4, 8, 6]}
        intensity={2.35}
        color="#fff8e8"
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 3, -4]} intensity={1.35} color="#91b9ff" />
      <spotLight position={[0, 6, -5]} intensity={3.2} angle={0.55} penumbra={0.8} color="#ffd15c" />
      <Suspense fallback={null}>
        <VehicleModel />
      </Suspense>
      {stageMode === 'studio' && propCatalog
        .filter((entry) => entry.id === selectedProp?.id || cargoPlacements.has(entry.id))
        .map((entry) => (
          <PropDisplayBoundary key={entry.id} assetId={entry.id} onError={onPropLoadError}>
            <Suspense fallback={null}>
              <PropDisplay
                entry={entry}
                selected={entry.id === selectedProp?.id}
                showPropReferenceBox={showPropReferenceBox}
                onFeedback={onCargoFeedback}
              />
            </Suspense>
          </PropDisplayBoundary>
        ))}
      {stageMode === 'studio' && <CargoHoverPlacementTarget onFeedback={onCargoFeedback} />}
      <ContactShadows position={[0, -0.015, 0]} opacity={0.72} scale={12} blur={2.6} far={5} frames={3} />
      {stageMode === 'launch' ? <LaunchStage /> : (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow>
          <circleGeometry args={[10, 96]} />
          <meshStandardMaterial color="#14171b" roughness={0.72} metalness={0.22} />
        </mesh>
      )}
      <OrbitCameraRig />
    </>
  )
}
