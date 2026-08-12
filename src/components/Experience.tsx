import { Component, Suspense, useCallback, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from 'react'
import { ContactShadows, Edges, Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MathUtils, PointLight, SpotLight } from 'three'
import { VehicleModel } from './VehicleModel'
import { OrbitCameraRig } from './OrbitCameraRig'
import { useExperienceStore } from '../store/experience-store'
import { CargoGhost, PropDisplay } from './PropDisplay'
import { findProp } from '../props/prop-catalog'
import { candidateAtPosition } from '../runtime/cargo-layout'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { su7ConceptPack } from '../pack/su7-concept.pack'

class PropDisplayBoundary extends Component<{
  children: ReactNode
  assetId: string
  onError: (assetId: string) => void
}, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AutoLaunch] prop failed to load:', error, info)
    this.props.onError(this.props.assetId)
  }
  render() { return this.state.failed ? null : this.props.children }
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
      <spotLight position={[0, 7, 0]} intensity={4.2} angle={0.5} penumbra={0.9} color="#bfffee" />
    </group>
  )
}

function CargoVolumeVisualizer({ invalid }: { invalid: boolean }) {
  const geometry = useMemo(() => {
    const sections = su7ConceptPack.cargoVolume.collider.sections
    const vertices: number[] = []
    const indices: number[] = []
    const ringSize = sections[0].polygon.length
    for (const section of sections) {
      for (const [x, z] of section.polygon) vertices.push(x, section.y, z)
    }
    for (let ring = 0; ring < sections.length - 1; ring += 1) {
      for (let index = 0; index < ringSize; index += 1) {
        const next = (index + 1) % ringSize
        const lower = ring * ringSize + index
        const lowerNext = ring * ringSize + next
        const upper = (ring + 1) * ringSize + index
        const upperNext = (ring + 1) * ringSize + next
        indices.push(lower, lowerNext, upperNext, lower, upperNext, upper)
      }
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    result.setIndex(indices)
    result.computeVertexNormals()
    return result
  }, [])
  const color = invalid ? '#ff5d66' : su7ConceptPack.cargoVolume.collider.color
  return (
    <mesh geometry={geometry} renderOrder={4}>
      <meshBasicMaterial color={color} transparent opacity={0.09} side={DoubleSide} depthWrite={false} toneMapped={false} />
      <Edges color={color} threshold={12} />
    </mesh>
  )
}

const reasonLabels = {
  'incomplete-floor-support': '底部未被后备厢地板完整支撑',
  'intersects-interior': '与内饰、轮拱或门槛重叠',
  'hatch-sweep-conflict': '占用尾门关闭空间',
  'outside-volume': '超出后备箱可用容积',
  'intersects-wall': '碰到内壁或轮拱',
  'blocked-opening': '当前姿态无法通过尾门开口',
  occupied: '与已有箱子重叠',
  'floor-support-required': '只能放在后备箱地板上',
} as const

function CargoInteriorLights() {
  const point = useRef<PointLight>(null)
  const fill = useRef<SpotLight>(null)
  const trunkOpen = useExperienceStore((state) => state.vehiclePartStates.get('trunk') === 'open')
  const activeOrbitPreset = useExperienceStore((state) => state.activeOrbitPreset)
  const cargoActive = trunkOpen || activeOrbitPreset === 'cargo_rear' || activeOrbitPreset === 'cargo_overview'
  useFrame((_, delta) => {
    const targetPoint = cargoActive ? 2.4 : 0
    const targetFill = cargoActive ? 1.15 : 0
    if (point.current) point.current.intensity = MathUtils.damp(point.current.intensity, targetPoint, 7, delta)
    if (fill.current) fill.current.intensity = MathUtils.damp(fill.current.intensity, targetFill, 7, delta)
  })
  return (
    <>
      <pointLight ref={point} position={[1.72, 1.26, -0.34]} intensity={0} distance={1.35} decay={2.1} color="#ffe2b0" />
      <spotLight ref={fill} position={[2.38, 1.38, 0]} target-position={[1.83, 0.78, 0]} intensity={0} distance={1.7} angle={0.62} penumbra={0.82} decay={2} color="#d7ebff" />
    </>
  )
}

function CargoPlacementController({ onFeedback }: { onFeedback: (message: string) => void }) {
  const session = useExperienceStore((state) => state.cargoPlacementSession)
  const placements = useExperienceStore((state) => state.cargoPlacements)
  const setSession = useExperienceStore((state) => state.setCargoPlacementSession)
  const entry = findProp(session?.catalogPropId ?? null)
  const existing = useMemo(() => [...placements.values()].filter(
    (placement) => placement.instanceId !== session?.instanceId && placement.state !== 'returning',
  ), [placements, session?.instanceId])

  const updateAt = useCallback((x: number, z: number) => {
    if (!session) return
    const result = candidateAtPosition(
      session.catalogPropId,
      x,
      z,
      session.orientation,
      session.rotationY,
      existing,
      session.precisionMode,
    )
    setSession({
      ...session,
      candidate: result.candidate ? {
        instanceId: session.instanceId,
        catalogPropId: session.catalogPropId,
        state: 'dragging',
        orientation: result.candidate.orientation,
        position: result.candidate.position,
        rotation: result.candidate.rotation,
        occupiedBounds: result.candidate.bounds,
        supportHeight: result.candidate.supportHeight,
        contactOffsetY: result.candidate.contactOffsetY,
        anchorId: null,
      } : null,
      valid: result.ok,
      reason: result.ok ? null : result.reason,
      snappedToInstanceId: result.ok ? result.candidate.snappedToInstanceId : null,
    })
  }, [existing, session, setSession])

  useEffect(() => {
    if (!session) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFeedback(dispatchVehicleAction({ type: 'cargo', operation: 'cancel' }).message)
      if (event.key.toLowerCase() === 'q') onFeedback(dispatchVehicleAction({ type: 'cargo', operation: 'rotate', direction: -1 }).message)
      if (event.key.toLowerCase() === 'e') onFeedback(dispatchVehicleAction({ type: 'cargo', operation: 'rotate', direction: 1 }).message)
      if (event.key.toLowerCase() === 'r') onFeedback(dispatchVehicleAction({ type: 'cargo', operation: 'rotate' }).message)
      if (event.key === 'Shift') setSession({ ...useExperienceStore.getState().cargoPlacementSession!, precisionMode: true })
    }
    const keyup = (event: KeyboardEvent) => {
      const current = useExperienceStore.getState().cargoPlacementSession
      if (event.key === 'Shift' && current) setSession({ ...current, precisionMode: false })
    }
    const contextmenu = (event: MouseEvent) => {
      event.preventDefault()
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('contextmenu', contextmenu)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('contextmenu', contextmenu)
    }
  }, [onFeedback, session, setSession, updateAt])

  if (!session || !entry) return null
  const pointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    updateAt(event.point.x, event.point.z)
  }
  const confirm = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onFeedback(dispatchVehicleAction({ type: 'cargo', operation: 'confirm' }).message)
  }

  return (
    <group>
      <CargoVolumeVisualizer invalid={!session.valid} />
      <mesh
        position={[1.95, su7ConceptPack.cargoVolume.floorY + 0.006, 0]}
        rotation-x={-Math.PI / 2}
        onPointerMove={pointerMove}
        onClick={confirm}
      >
        <planeGeometry args={[1.3, 1.35]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {session.candidate && (
        <>
          <Suspense fallback={null}>
            <CargoGhost entry={entry} placement={session.candidate} valid={session.valid} />
          </Suspense>
          <Html position={[session.candidate.position[0], session.candidate.position[1] + session.candidate.occupiedBounds.halfSize[1] + 0.12, session.candidate.position[2]]} center>
            <div className={`cargo-placement-hint${session.valid ? ' valid' : ' invalid'}`}>
              <strong>{session.valid ? (session.snappedToInstanceId ? '已吸附 · 单击放置' : '单击放置') : reasonLabels[session.reason ?? 'outside-volume']}</strong>
              <span>Q/E 旋转 · R 换姿态 · 滚轮缩放视线 · 右键拖动镜头 · Esc 取消</span>
            </div>
          </Html>
        </>
      )}
    </group>
  )
}

export function Experience({
  onPropLoadError,
  onCargoFeedback,
}: {
  onPropLoadError: (assetId: string) => void
  onCargoFeedback: (message: string) => void
}) {
  const stageMode = useExperienceStore((state) => state.stageMode)
  const cargoPlacements = useExperienceStore((state) => state.cargoPlacements)
  const selectedInstanceId = useExperienceStore((state) => state.selectedCargoInstanceId)
  const sessionInstanceId = useExperienceStore((state) => state.cargoPlacementSession?.instanceId)

  return (
    <>
      <color attach="background" args={['#090b0e']} />
      <fog attach="fog" args={['#090b0e', 10, 22]} />
      <ambientLight intensity={0.82} />
      <directionalLight castShadow position={[4, 8, 6]} intensity={2.35} color="#fff8e8" shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 3, -4]} intensity={1.35} color="#91b9ff" />
      <spotLight position={[0, 6, -5]} intensity={3.2} angle={0.55} penumbra={0.8} color="#ffd15c" />
      <pointLight position={[1.45, 1.65, 0]} intensity={1.8} distance={2.6} decay={1.8} color="#e8fff9" />
      <CargoInteriorLights />
      <Suspense fallback={null}><VehicleModel /></Suspense>
      {stageMode === 'studio' && [...cargoPlacements.values()]
        .filter((placement) => placement.instanceId !== sessionInstanceId)
        .map((placement) => {
          const entry = findProp(placement.catalogPropId)
          if (!entry) return null
          return (
            <PropDisplayBoundary key={placement.instanceId} assetId={placement.catalogPropId} onError={onPropLoadError}>
              <Suspense fallback={null}>
                <PropDisplay entry={entry} placement={placement} selected={selectedInstanceId === placement.instanceId} onFeedback={onCargoFeedback} />
              </Suspense>
            </PropDisplayBoundary>
          )
        })}
      {stageMode === 'studio' && <CargoPlacementController onFeedback={onCargoFeedback} />}
      {stageMode === 'studio' && [...cargoPlacements.values()].filter((placement) => placement.state !== 'returning').map((placement) => (
        <ContactShadows
          key={`contact-${placement.instanceId}`}
          position={[placement.position[0], placement.supportHeight + 0.002, placement.position[2]]}
          opacity={0.78}
          scale={Math.max(placement.occupiedBounds.halfSize[0], placement.occupiedBounds.halfSize[2]) * 2.35}
          blur={1.1}
          far={0.32}
          resolution={256}
          frames={8}
        />
      ))}
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
