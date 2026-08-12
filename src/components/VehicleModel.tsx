import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Html, Outlines, useGLTF } from '@react-three/drei'
import { createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Box3, BoxGeometry, Color, Group, Matrix3, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Raycaster, Vector3 } from 'three'
import { SkeletonUtils } from 'three/examples/jsm/Addons.js'
import { KTX2Loader, type GLTFLoader } from 'three-stdlib'
import {
  DOOR_LABELS,
  DOOR_TARGETS,
  HatchActionDefinition,
  PARTS_VIRTUAL_HINT,
  WINDOW_TARGETS,
  WINDOW_LABELS,
  su7ConceptPack,
  type WindowActionDefinition,
  type DoorActionDefinition,
} from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import type { ActiveVehicleAction, DoorTarget, WindowTarget } from '../types'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import { registerCargoSurfaceSampler } from '../runtime/cargo-surface'
import {
  resolveVehicleTargetFromIntersections,
  type VehicleHitTarget,
} from '../runtime/window-hit-target'
import { VehicleLightEffects } from './VehicleLightEffects'
import { VehiclePlate } from './VehiclePlate'

type WindowAnimation = {
  kind: 'window'
  execution: ActiveVehicleAction
  /** Concrete target (never 'all'). */
  target: Exclude<WindowTarget, 'all'>
  /** Either the real GLB mesh or the fallback virtual placeholder mesh we spawn. */
  object: Object3D
  /** Mirrors the WindowNodeRefs.isVirtual flag so the rollback path is uniform. */
  isVirtual: boolean
  /**
   * Normalized animation range expressed as [startProgress, endProgress] 0..100.
   * We lerp the mesh using packDefinition.(axis + offsets) converted into absolute
   * translation values, so "50%" truly lands at the midpoint between closed and
   * fully-descended positions.
   */
  progressFrom: number
  progressTo: number
  /** Cached pack definition so we don't look it up per-frame. */
  definition: WindowActionDefinition
  /** Closed (0%) reference position captured at scene init. */
  closedBase: readonly [number, number, number]
  startedAt: number
  materials?: MeshStandardMaterial[]
  /** Opacity at the fully closed pose, before the glass enters the door shell. */
  closedOpacity: number
}

type HatchAnimation = {
  kind: 'hatch'
  execution: ActiveVehicleAction
  /** GLB-local pivot; we write rotation.x per frame. */
  pivot: Group
  definition: HatchActionDefinition
  fromRotation: number
  toRotation: number
  rotationAxis: 'x' | 'z'
  isVirtual: boolean
  startedAt: number
}

type DoorAnimation = {
  kind: 'door'
  execution: ActiveVehicleAction
  pivot: Group
  fromRotation: number
  toRotation: number
  startedAt: number
}

type TrunkAnimation = {
  kind: 'trunk'
  execution: ActiveVehicleAction
  object: Object3D
  from: number
  to: number
  startedAt: number
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

type RuntimeAnimation = WindowAnimation | HatchAnimation | DoorAnimation | TrunkAnimation | LightAnimation | FallbackAnimation

type WindowNodeRefs = {
  object: Object3D
  closedPosition: { x: number; y: number; z: number }
  isVirtual: boolean
  materials: MeshStandardMaterial[]
  closedOpacity: number
}

type HatchNodeRefs = {
  /** GLB-local pivot at the physical hinge line. */
  pivot: Group
  /** Exported GLB nodes attached to the pivot while preserving their pose. */
  movingNodes: Object3D[]
  /** Hatch-specific action definition cached for per-frame lerp math. */
  definition: HatchActionDefinition
  /** Optional cached rotation at the closed pose (used for timeouts/rollback). */
  closedRotation: number
  rotationAxis: 'x' | 'z'
  isVirtual: boolean
}

type DoorNodeRefs = { pivot: Group; definition: DoorActionDefinition; movingNodes: Object3D[] }

type HoverVisual = {
  key: string
  target: VehicleHitTarget
  meshes: Mesh[]
  point: Vector3
  label: string
}

function collectMeshes(nodes: readonly (Object3D | null | undefined)[]): Mesh[] {
  const meshes = new Map<string, Mesh>()
  nodes.forEach((node) => node?.traverse((object) => {
    const mesh = object as Mesh
    if (mesh.isMesh) meshes.set(mesh.uuid, mesh)
  }))
  return [...meshes.values()]
}

function vehicleHitKey(target: VehicleHitTarget): string {
  if (target.type === 'window' || target.type === 'door' || target.type === 'lights') {
    return `${target.type}:${target.target}`
  }
  return target.type
}

function vehicleHitLabel(target: VehicleHitTarget): string {
  const state = useExperienceStore.getState()
  if (target.type === 'window') {
    const progress = Math.round(state.windowProgress.get(target.target) ?? 0)
    const status = progress <= 0 ? '当前关闭' : progress >= 100 ? '当前打开' : `当前开启 ${progress}%`
    return `${WINDOW_LABELS[target.target]} · ${status}`
  }
  if (target.type === 'door') {
    const partState = state.vehiclePartStates.get(`door_${target.target}`)
    const status = partState === 'moving' ? '动作中' : partState === 'open' ? '当前打开' : '当前关闭'
    return `${DOOR_LABELS[target.target]} · ${status}`
  }
  if (target.type === 'lights') {
    const isOn = state.lightStates.get(target.target) ?? false
    const name = target.target === 'headlight' ? '大灯' : '贯穿尾灯'
    return `${name} · ${isOn ? '当前点亮' : '当前熄灭'}`
  }
  if (target.type === 'frunk') {
    const partState = state.vehiclePartStates.get('hatch_front')
    const status = partState === 'moving' ? '动作中' : partState === 'open' ? '当前打开' : '当前关闭'
    return `前备箱 · ${status}`
  }
  const partState = state.vehiclePartStates.get('trunk')
  const status = partState === 'moving' ? '动作中' : partState === 'open' ? '当前打开' : '当前关闭'
  return `后备箱 · ${status}`
}

function VehicleMeshOutline({ mesh, pulse = false }: { mesh: Mesh; pulse?: boolean }) {
  const outlineRef = useRef<Group>(null)
  useFrame((_, delta) => {
    const outlineMesh = outlineRef.current?.children[0] as Mesh | undefined
    if (!outlineMesh) return
    const materials = Array.isArray(outlineMesh.material) ? outlineMesh.material : [outlineMesh.material]
    materials.forEach((material) => {
      material.transparent = true
      material.opacity = MathUtils.damp(material.opacity, pulse ? 0.68 : 0.35, 12, delta)
    })
  })
  return createPortal(
    <Outlines
      ref={outlineRef}
      color="#25e6c2"
      opacity={0}
      transparent
      thickness={pulse ? 2.4 : 1.6}
      toneMapped={false}
      renderOrder={12}
    />,
    mesh,
  )
}

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

/**
 * Keep the glass visually solid while it is above the belt line, then conceal
 * it as it enters the opaque door shell. A fully opened window must have no
 * translucent edge left visible from oblique side views.
 */
export function windowOpacityForProgress(progressPercent: number, closedOpacity = 1) {
  const progress = MathUtils.clamp(progressPercent, 0, 100)
  const concealedByDoor = MathUtils.smoothstep(progress, 68, 100)
  return closedOpacity * (1 - concealedByDoor)
}

/**
 * Build the per-window runtime handles. If a real GLB node is present in the
 * scene we attach directly to it; otherwise we construct a translucent glass
 * box using the virtualWindow spec in the Product Pack and parent it into
 * vehicleRoot so the descend animation is still visible on the car body.
 */
function buildWindowRefs(
  scene: Object3D,
  vehicleRoot: Group,
): Record<Exclude<WindowTarget, 'all'>, WindowNodeRefs> {
  const out = {} as Record<Exclude<WindowTarget, 'all'>, WindowNodeRefs>
  for (const target of WINDOW_TARGETS) {
    const semanticId = `window_${target}` as const
    const definition = su7ConceptPack.actions[semanticId] as WindowActionDefinition | undefined
    if (!definition) continue
    const nodeName = su7ConceptPack.nodeMap[semanticId as keyof typeof su7ConceptPack.nodeMap]
    const realNode = nodeName ? scene.getObjectByName(nodeName) : null
    let object: Object3D
    let materials: MeshStandardMaterial[]
    let isVirtual = false
    if (realNode) {
      object = realNode
      materials = collectStandardMaterials(realNode)
    } else {
      isVirtual = true
      const group = new Group()
      group.name = `VirtualWindow_${target}`
      const geometry = new BoxGeometry(
        definition.virtualWindow.size[0],
        definition.virtualWindow.size[1],
        definition.virtualWindow.size[2],
      )
      const material = new MeshStandardMaterial({
        color: new Color(definition.virtualWindow.glassColor),
        metalness: 0.08,
        roughness: 0.12,
        transparent: true,
        opacity: 0.72,
      })
      const mesh = new Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      group.position.set(
        definition.virtualWindow.position[0],
        definition.virtualWindow.position[1],
        definition.virtualWindow.position[2],
      )
      if (definition.virtualWindow.rotation) {
        group.rotation.set(
          definition.virtualWindow.rotation[0],
          definition.virtualWindow.rotation[1],
          definition.virtualWindow.rotation[2],
        )
      }
      vehicleRoot.add(group)
      object = group
      materials = [material]
    }
    out[target] = {
      object,
      closedPosition: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
      },
      isVirtual,
      materials,
      closedOpacity: materials[0]?.opacity ?? 1,
    }
  }
  return out
}

/**
 * Keep an invisible raycast surface at every closed window aperture. The real
 * glass moves into the door when opened, but the user must still be able to
 * click the same aperture to close it again.
 */
function buildWindowHitTargets(scene: Object3D, vehicleRoot: Group): Mesh[] {
  scene.updateWorldMatrix(true, true)
  vehicleRoot.updateWorldMatrix(true, true)
  const targets: Mesh[] = []
  for (const target of WINDOW_TARGETS) {
    const node = scene.getObjectByName(su7ConceptPack.nodeMap[`window_${target}`])
    if (!node) continue
    const bounds = new Box3().setFromObject(node)
    if (bounds.isEmpty()) continue
    const size = bounds.getSize(new Vector3())
    const center = vehicleRoot.worldToLocal(bounds.getCenter(new Vector3()))
    const geometry = new BoxGeometry(
      Math.max(size.x, 0.06),
      Math.max(size.y, 0.06),
      Math.max(size.z, 0.06),
    )
    const material = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    material.colorWrite = false
    const proxy = new Mesh(geometry, material)
    proxy.name = `WindowHitTarget_${target}`
    proxy.position.copy(center)
    proxy.userData.windowTarget = target
    proxy.castShadow = false
    proxy.receiveShadow = false
    proxy.frustumCulled = false
    vehicleRoot.add(proxy)
    targets.push(proxy)
  }
  return targets
}

/**
 * Convert a normalized progress (0..100) into the absolute world-space position
 * for the declared axis by interpolating the pack's closedOffset / openOffset.
 */
function axisPositionForProgress(
  closedValue: number,
  definition: WindowActionDefinition,
  progress01: number,
): number {
  const offset = MathUtils.lerp(definition.closedOffset, definition.openOffset, progress01)
  return closedValue + offset
}

/**
 * For virtual placeholder windows we apply a much larger visible descend so
 * users can clearly see the glass disappear into the door pocket. Uses the
 * descendOffset vector scaled by progress.
 */
function applyVirtualWindowPosition(
  object: Object3D,
  base: { x: number; y: number; z: number },
  definition: WindowActionDefinition,
  progress01: number,
): void {
  const [dx, dy, dz] = definition.virtualWindow.descendOffset
  object.position.set(
    base.x + dx * progress01,
    base.y + dy * progress01,
    base.z + dz * progress01,
  )
}

/**
 * Assemble the real exported tailgate parts under one GLB-local hinge pivot.
 * Object3D.attach() preserves each part's baked transform, so the closed pose
 * remains unchanged while one pivot drives the outer skin and inner liner.
 */
function buildHatchRefs(scene: Object3D): HatchNodeRefs | null {
  const definition = su7ConceptPack.actions.hatch_rear as HatchActionDefinition
  const movingNodes = definition.movingNodeIds
    .map((semanticId) => scene.getObjectByName(su7ConceptPack.nodeMap[semanticId as keyof typeof su7ConceptPack.nodeMap]))
    .filter((node): node is Object3D => Boolean(node))
  if (movingNodes.length !== definition.movingNodeIds.length) return null

  const pivot = new Group()
  pivot.name = 'Hatch_Pivot_rear_hatch'
  pivot.position.set(...definition.hingePosition)
  pivot.rotation.x = definition.closedRotation
  scene.add(pivot)
  scene.updateMatrixWorld(true)
  movingNodes.forEach((node) => pivot.attach(node))

  return {
    pivot,
    movingNodes,
    definition,
    closedRotation: definition.closedRotation,
    rotationAxis: 'x',
    isVirtual: false,
  }
}

/** Build the front hatch from registered nodes, falling back to a pack-declared virtual lid. */
export function buildHatchFrontRefs(scene: Object3D, vehicleRoot: Group): HatchNodeRefs {
  const definition = su7ConceptPack.actions.hatch_front as HatchActionDefinition
  const movingNodes = definition.movingNodeIds
    .map((semanticId) => scene.getObjectByName(su7ConceptPack.nodeMap[semanticId as keyof typeof su7ConceptPack.nodeMap]))
    .filter((node): node is Object3D => Boolean(node))
  if (movingNodes.length === definition.movingNodeIds.length) {
    const pivot = new Group()
    pivot.name = 'Hatch_Pivot_front_hatch'
    pivot.position.set(...definition.hingePosition)
    scene.add(pivot)
    scene.updateMatrixWorld(true)
    movingNodes.forEach((node) => pivot.attach(node))
    movingNodes.forEach((node) => { node.userData.vehicleHitTarget = 'frunk' })
    return { pivot, movingNodes, definition, closedRotation: definition.closedRotation, rotationAxis: 'x', isVirtual: false }
  }
  const virtual = definition.virtualHatch!
  const pivot = new Group()
  pivot.name = 'VirtualHatch_front'
  pivot.position.set(
    virtual.position[0] + virtual.hingeOffset[0],
    virtual.position[1] + virtual.hingeOffset[1],
    virtual.position[2] + virtual.hingeOffset[2],
  )
  const material = new MeshStandardMaterial({ color: virtual.color, metalness: 0.35, roughness: 0.4 })
  const lid = new Mesh(new BoxGeometry(...virtual.size), material)
  lid.position.set(-virtual.hingeOffset[0], -virtual.hingeOffset[1], -virtual.hingeOffset[2])
  lid.rotation.set(...virtual.rotation)
  pivot.add(lid)
  pivot.visible = false
  vehicleRoot.add(pivot)
  const virtualDefinition = { ...definition, openRotation: virtual.openAngle }
  return { pivot, movingNodes: [lid], definition: virtualDefinition, closedRotation: definition.closedRotation, rotationAxis: 'z', isVirtual: true }
}

/** Build one GLB-local hinge per door from its registered outer skin, inner panel and window. */
export function buildDoorRefs(scene: Object3D, vehicleRoot: Group): Record<Exclude<DoorTarget, 'all'>, DoorNodeRefs> {
  const refs = {} as Record<Exclude<DoorTarget, 'all'>, DoorNodeRefs>
  scene.updateMatrixWorld(true)
  vehicleRoot.updateMatrixWorld(true)
  for (const target of DOOR_TARGETS) {
    const definition = su7ConceptPack.actions[`door_${target}`] as DoorActionDefinition
    const movingNodes = definition.movingNodeIds
      .map((semanticId) => scene.getObjectByName(su7ConceptPack.nodeMap[semanticId as keyof typeof su7ConceptPack.nodeMap]))
      .filter((node): node is Object3D => Boolean(node))
    const pivot = new Group()
    pivot.name = `Door_Pivot_${target}`
    pivot.position.set(...definition.hingePosition)
    scene.add(pivot)
    scene.updateMatrixWorld(true)
    movingNodes.forEach((node) => pivot.attach(node))
    movingNodes.forEach((node) => { node.userData.doorTarget = target })
    refs[target] = { pivot, definition, movingNodes }
  }
  return refs
}

export function VehicleModel() {
  const renderer = useThree((state) => state.gl)
  const configureLoader = useCallback((loader: GLTFLoader) => {
    const ktx2Loader = new KTX2Loader()
      .setTranscoderPath('/basis/')
      .detectSupport(renderer)
    loader.setKTX2Loader(ktx2Loader)
  }, [renderer])
  const gltf = useGLTF(su7ConceptPack.model.path, true, true, configureLoader)
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene])
  const vehicleRoot = useRef<Group>(null)
  const windowRefs = useRef<Record<Exclude<WindowTarget, 'all'>, WindowNodeRefs> | null>(null)
  const windowHitTargets = useRef<Mesh[]>([])
  const hatchRefs = useRef<HatchNodeRefs | null>(null)
  const hatchFrontRefs = useRef<HatchNodeRefs | null>(null)
  const doorRefs = useRef<Record<Exclude<DoorTarget, 'all'>, DoorNodeRefs> | null>(null)
  const handledClickEvent = useRef<Event | null>(null)
  const pulseTimer = useRef<number | null>(null)
  const vehicleClosedY = useRef(0)
  const runtimeAnimations = useRef(new Map<string, RuntimeAnimation>())
  const [hoverVisual, setHoverVisual] = useState<HoverVisual | null>(null)
  const [pulseVisual, setPulseVisual] = useState<HoverVisual | null>(null)
  const activeActions = useExperienceStore((state) => state.activeActions)
  const setModelStatus = useExperienceStore((state) => state.setModelStatus)
  const setNotice = useExperienceStore((state) => state.setNotice)
  const requestOrbit = useExperienceStore((state) => state.requestOrbit)
  const finishAction = useExperienceStore((state) => state.finishAction)

  useEffect(() => {
    const root = vehicleRoot.current
    if (!root) return
    root.updateWorldMatrix(true, true)
    const raycaster = new Raycaster()
    const down = new Vector3(0, -1, 0)
    const origin = new Vector3()
    const normalMatrix = new Matrix3()
    const worldNormal = new Vector3()
    const surfaceHeightCache = new Map<string, number | null>()
    const movingHatchNames = new Set<string>(
      su7ConceptPack.actions.hatch_rear.movingNodeIds
        .map((semanticId) => su7ConceptPack.nodeMap[semanticId as keyof typeof su7ConceptPack.nodeMap])
        .filter(Boolean),
    )
    registerCargoSurfaceSampler((x, z) => {
      // Placement search revisits the same grid/contact coordinates many times.
      // Cache them so one interaction does not repeatedly raycast the full car GLB.
      const cacheKey = `${x.toFixed(4)}:${z.toFixed(4)}`
      if (surfaceHeightCache.has(cacheKey)) return surfaceHeightCache.get(cacheKey) ?? null
      root.updateWorldMatrix(true, true)
      origin.set(x, 1.25, z)
      raycaster.set(origin, down)
      const hit = raycaster.intersectObject(scene, true).find((intersection) => {
        const mesh = intersection.object
        if (!(mesh instanceof Mesh) || movingHatchNames.has(mesh.name)) return false
        const y = intersection.point.y
        if (y < 0.58 || y > 0.82 || !intersection.face) return false
        normalMatrix.getNormalMatrix(mesh.matrixWorld)
        worldNormal.copy(intersection.face.normal).applyMatrix3(normalMatrix).normalize()
        return worldNormal.y > 0.45
      })
      const height = hit?.point.y ?? null
      surfaceHeightCache.set(cacheKey, height)
      return height
    })
    return () => registerCargoSurfaceSampler(null)
  }, [scene])

  const resolveClickedPart = useCallback(
    (intersections: ThreeEvent<PointerEvent>['intersections']) => resolveVehicleTargetFromIntersections(
      intersections,
      su7ConceptPack.nodeMap,
      su7ConceptPack.actions.hatch_rear.movingNodeIds,
    ),
    [],
  )

  const meshesForTarget = useCallback((target: VehicleHitTarget): Mesh[] => {
    if (target.type === 'window') return collectMeshes([windowRefs.current?.[target.target]?.object])
    if (target.type === 'door') return collectMeshes(doorRefs.current?.[target.target]?.movingNodes ?? [])
    if (target.type === 'frunk') return collectMeshes(hatchFrontRefs.current?.movingNodes ?? [])
    if (target.type === 'trunk') {
      return collectMeshes([
        scene.getObjectByName(su7ConceptPack.nodeMap.trunk_outer_upper),
        scene.getObjectByName(su7ConceptPack.nodeMap.trunk_outer_lip),
        scene.getObjectByName(su7ConceptPack.nodeMap.rear_badges),
      ])
    }
    const semanticIds = target.target === 'headlight'
      ? ['headlight_left', 'headlight_right'] as const
      : ['taillight_left', 'taillight_right'] as const
    return collectMeshes(semanticIds.map((semanticId) => scene.getObjectByName(su7ConceptPack.nodeMap[semanticId])))
  }, [scene])

  const handleVehiclePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (event.buttons !== 0) {
      setHoverVisual(null)
      renderer.domElement.style.cursor = 'grabbing'
      return
    }
    const hit = resolveClickedPart(event.intersections)
    if (!hit) {
      setHoverVisual(null)
      renderer.domElement.style.cursor = 'grab'
      return
    }
    const meshes = meshesForTarget(hit)
    if (!meshes.length) {
      setHoverVisual(null)
      renderer.domElement.style.cursor = 'grab'
      return
    }
    const point = event.intersections[0]?.point?.clone() ?? event.point.clone()
    setHoverVisual({ key: vehicleHitKey(hit), target: hit, meshes, point, label: vehicleHitLabel(hit) })
    renderer.domElement.style.cursor = 'pointer'
  }, [meshesForTarget, renderer, resolveClickedPart])

  const handleVehicleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (handledClickEvent.current === event.nativeEvent) return
    handledClickEvent.current = event.nativeEvent
    event.stopPropagation()
    if (event.delta > 4) {
      setHoverVisual(null)
      return
    }
    const hit = resolveClickedPart(event.intersections)
    if (!hit) return
    const meshes = meshesForTarget(hit)
    const point = event.intersections[0]?.point?.clone() ?? event.point.clone()
    if (meshes.length) {
      setPulseVisual({ key: vehicleHitKey(hit), target: hit, meshes, point, label: vehicleHitLabel(hit) })
      setHoverVisual(null)
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current)
      pulseTimer.current = window.setTimeout(() => {
        setPulseVisual(null)
        pulseTimer.current = null
      }, 200)
    }
    const state = useExperienceStore.getState()
    if (state.stageMode === 'launch') state.setStageMode('studio')
    if (hit.type === 'window') {
      const isOpen = (state.windowProgress.get(hit.target) ?? 0) > 0
      const result = dispatchVehicleAction({
        type: 'window',
        target: hit.target,
        open: !isOpen,
        progress: isOpen ? 0 : 100,
      })
      state.setNotice(`${WINDOW_LABELS[hit.target]} · ${result.message}`)
      return
    }
    if (hit.type === 'lights') {
      const isOn = state.lightStates.get(hit.target) ?? false
      const result = dispatchVehicleAction({ type: 'lights', target: hit.target, on: !isOn })
      state.setNotice(`${hit.target === 'headlight' ? '大灯' : '尾灯'} · ${result.message}`)
      return
    }
    if (hit.type === 'door') {
      const isOpen = state.vehiclePartStates.get(`door_${hit.target}`) === 'open'
      const result = dispatchVehicleAction({ type: 'door', target: hit.target, open: !isOpen, progress: isOpen ? 0 : 100 })
      state.setNotice(`${DOOR_LABELS[hit.target]} · ${result.message}`)
      return
    }
    if (hit.type === 'frunk') {
      const isOpen = state.vehiclePartStates.get('hatch_front') === 'open'
      const result = dispatchVehicleAction({ type: 'hatch', target: 'front_hatch', open: !isOpen, progress: isOpen ? 0 : 100 })
      state.setNotice(`前备箱 · ${result.message}`)
      return
    }
    const isOpen = state.vehiclePartStates.get('trunk') === 'open'
    const result = dispatchVehicleAction({ type: 'trunk', open: !isOpen })
    state.setNotice(`后备箱 · ${result.message}`)
  }, [meshesForTarget, resolveClickedPart])

  useEffect(() => () => {
    if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current)
  }, [])


  useEffect(() => {
    const missingNodes = Object.entries(su7ConceptPack.nodeMap)
      .filter(([, rawName]) => !scene.getObjectByName(rawName))
      .map(([semanticId]) => semanticId)
    console.info('[AutoLaunch] GLB nodes:', scene.children.map((node) => node.name))
    if (missingNodes.length) {
      console.warn(`[AutoLaunch] missing node-map entries: ${JSON.stringify(missingNodes)}`)
      const newPartNodeMissing = missingNodes.some((id) => id.startsWith('door_') || id.startsWith('hatch_front_'))
      const actionNodeMissing = missingNodes.some((id) => (
        id.startsWith('window_')
        || id.startsWith('trunk_')
        || id.startsWith('headlight_')
        || id.startsWith('taillight_')
      ))
      setNotice(newPartNodeMissing
        ? PARTS_VIRTUAL_HINT
        : actionNodeMissing
        ? '⚠ 当前演示模型部分动作节点暂未映射，相关动作将使用降级展示。'
        : '⚠ 当前模型部分外观节点暂未映射，已跳过对应材质覆盖；核心动作仍可使用。')
    }
    scene.traverse((object) => {
      object.castShadow = false
      object.receiveShadow = false
      if (su7ConceptPack.appearance.hiddenNodes.includes(object.name as never)) object.visible = false
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const materialNames = sourceMaterials.map((material) => material.name)
      mesh.castShadow = materialNames.some((name) => su7ConceptPack.appearance.shadowCasterMaterials.includes(name as never))
      mesh.receiveShadow = materialNames.some((name) => su7ConceptPack.appearance.shadowReceiverMaterials.includes(name as never))
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

    if (vehicleRoot.current) {
      doorRefs.current = buildDoorRefs(scene, vehicleRoot.current)
      windowRefs.current = buildWindowRefs(scene, vehicleRoot.current)
      windowHitTargets.current = buildWindowHitTargets(scene, vehicleRoot.current)
      hatchRefs.current = buildHatchRefs(scene)
      hatchFrontRefs.current = buildHatchFrontRefs(scene, vehicleRoot.current)
      vehicleClosedY.current = vehicleRoot.current.position.y
      ;(globalThis as unknown as { __AUDIT_WINDOW_REFS__: typeof windowRefs.current }).__AUDIT_WINDOW_REFS__ = windowRefs.current
      ;(globalThis as unknown as { __AUDIT_HATCH_REFS__: HatchNodeRefs | null }).__AUDIT_HATCH_REFS__ = hatchRefs.current
    }
    setModelStatus('ready')
    return () => {
      windowHitTargets.current.forEach((target) => {
        target.removeFromParent()
        target.geometry.dispose()
        const material = target.material
        if (Array.isArray(material)) material.forEach((item) => item.dispose())
        else material.dispose()
      })
      windowHitTargets.current = []
      renderer.domElement.style.cursor = 'grab'
    }
  }, [renderer, scene, setModelStatus, setNotice])

  useEffect(() => {
    for (const id of runtimeAnimations.current.keys()) {
      if (!activeActions.has(id)) runtimeAnimations.current.delete(id)
    }

    for (const execution of activeActions.values()) {
      if (runtimeAnimations.current.has(execution.id)) continue
      const startedAt = performance.now()

      if (execution.action.type === 'window') {
        const target = execution.action.target as Exclude<WindowTarget, 'all'>
        const refs = windowRefs.current?.[target]
        const semanticId = `window_${target}` as const
        const definition = su7ConceptPack.actions[semanticId] as WindowActionDefinition | undefined
        if (!refs || !definition) {
          requestOrbit('driver_side')
          setNotice(`${WINDOW_LABELS[target]} 暂不可用，已切换到主驾侧面镜头聚焦。`)
          runtimeAnimations.current.set(execution.id, { kind: 'fallback', execution, startedAt })
          continue
        }
        const progressFrom = Math.max(0, Math.min(100, execution.startProgress ?? 0))
        const progressTo = Math.max(0, Math.min(100, execution.targetProgress ?? (execution.targetValue ? 100 : 0)))
        const materials = refs.materials
        refs.object.visible = true
        runtimeAnimations.current.set(execution.id, {
          kind: 'window',
          execution,
          target,
          object: refs.object,
          isVirtual: refs.isVirtual,
          progressFrom,
          progressTo,
          definition,
          closedBase: [refs.closedPosition.x, refs.closedPosition.y, refs.closedPosition.z] as const,
          startedAt,
          materials,
          closedOpacity: refs.closedOpacity,
        })
        continue
      }

      if (execution.action.type === 'hatch') {
        const refs = execution.action.target === 'front_hatch' ? hatchFrontRefs.current : hatchRefs.current
        if (!refs) {
          requestOrbit(execution.action.target === 'front_hatch' ? 'front' : su7ConceptPack.actions.trunk.fallbackCamera)
          setNotice(execution.action.target === 'front_hatch' ? PARTS_VIRTUAL_HINT : '当前模型的真实尾门组合节点不完整，已用车尾镜头与轻微抬升降级展示。')
          const root = vehicleRoot.current
          if (root) {
            runtimeAnimations.current.set(execution.id, {
              kind: 'trunk',
              execution,
              object: root,
              from: root.position.y,
              to: vehicleClosedY.current + (execution.targetValue ? su7ConceptPack.actions.trunk.visualLift : 0),
              startedAt,
            })
          } else {
            runtimeAnimations.current.set(execution.id, { kind: 'fallback', execution, startedAt })
          }
          continue
        }
        const def = refs.definition
        const opening = execution.targetValue
        if (refs.isVirtual) refs.pivot.visible = true
        runtimeAnimations.current.set(execution.id, {
          kind: 'hatch',
          execution,
          pivot: refs.pivot,
          definition: def,
          fromRotation: refs.pivot.rotation[refs.rotationAxis],
          toRotation: opening ? def.openRotation : def.closedRotation,
          rotationAxis: refs.rotationAxis,
          isVirtual: refs.isVirtual,
          startedAt,
        })
        continue
      }

      if (execution.action.type === 'door' && execution.action.target !== 'all') {
        const refs = doorRefs.current?.[execution.action.target]
        if (!refs) {
          runtimeAnimations.current.set(execution.id, { kind: 'fallback', execution, startedAt })
          setNotice(PARTS_VIRTUAL_HINT)
          continue
        }
        runtimeAnimations.current.set(execution.id, {
          kind: 'door', execution, pivot: refs.pivot,
          fromRotation: refs.pivot.rotation.y,
          toRotation: execution.targetValue ? refs.definition.openRotation : refs.definition.closedRotation,
          startedAt,
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


      if (execution.action.type !== 'lights') {
        runtimeAnimations.current.set(execution.id, { kind: 'fallback', execution, startedAt })
        continue
      }

      const lightDefinition = execution.action.target === 'headlight'
        ? su7ConceptPack.actions.lights_headlight
        : su7ConceptPack.actions.lights_taillight
      const materials = lightDefinition.emissiveNodes.flatMap((nodeName) =>
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
        to: lightDefinition.emissiveIntensity[execution.targetValue ? 1 : 0],
        color: new Color(lightDefinition.color),
        lensMaterials,
        lensFrom: lensMaterials[0]?.emissiveIntensity ?? 0,
        lensTo: lightDefinition.lensEmissiveIntensity[execution.targetValue ? 1 : 0],
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
        if (animation.kind === 'window') {
          const { definition, closedBase, object, isVirtual } = animation
          if (isVirtual) {
            applyVirtualWindowPosition(object, { x: closedBase[0], y: closedBase[1], z: closedBase[2] }, definition, 0)
          } else {
            const axis = definition.axis.toLowerCase() as 'x' | 'y' | 'z'
            object.position[axis] = axisPositionForProgress(closedBase[axis === 'x' ? 0 : axis === 'y' ? 1 : 2], definition, 0)
          }
          const restoredOpacity = windowOpacityForProgress(animation.progressFrom, animation.closedOpacity)
          animation.materials?.forEach((material) => { material.opacity = restoredOpacity })
          animation.object.visible = restoredOpacity > 0.001
        } else if (animation.kind === 'hatch') {
          animation.pivot.rotation[animation.rotationAxis] = animation.fromRotation
        } else if (animation.kind === 'door') {
          animation.pivot.rotation.y = animation.fromRotation
        } else if (animation.kind === 'trunk') {
          animation.object.position.y = animation.from
        } else if (animation.kind === 'lights') {
          animation.materials.forEach((material) => { material.emissiveIntensity = animation.from })
          animation.lensMaterials.forEach((material) => { material.emissiveIntensity = animation.lensFrom })
        }
        finishAction(id, 'failed')
        runtimeAnimations.current.delete(id)
        continue
      }

      const progress = Math.min(1, (now - animation.startedAt) / execution.durationMs)
      const eased = MathUtils.smoothstep(progress, 0, 1)
      if (animation.kind === 'window') {
        const progressPercent = MathUtils.lerp(animation.progressFrom, animation.progressTo, eased)
        const normalizedProgress = progressPercent / 100
        const axis = animation.definition.axis.toLowerCase() as 'x' | 'y' | 'z'
        if (animation.isVirtual) {
          applyVirtualWindowPosition(
            animation.object,
            { x: animation.closedBase[0], y: animation.closedBase[1], z: animation.closedBase[2] },
            animation.definition,
            normalizedProgress,
          )
        } else {
          const baseValue = animation.closedBase[axis === 'x' ? 0 : axis === 'y' ? 1 : 2]
          animation.object.position[axis] = axisPositionForProgress(baseValue, animation.definition, normalizedProgress)
        }
        const opacity = windowOpacityForProgress(progressPercent, animation.closedOpacity)
        if (animation.materials) {
          animation.materials.forEach((material) => {
            material.transparent = true
            material.opacity = opacity
            material.needsUpdate = true
          })
        }
        animation.object.visible = opacity > 0.001
      } else if (animation.kind === 'hatch') {
        const rot = MathUtils.lerp(animation.fromRotation, animation.toRotation, eased)
        animation.pivot.rotation[animation.rotationAxis] = rot
      } else if (animation.kind === 'door') {
        animation.pivot.rotation.y = MathUtils.lerp(animation.fromRotation, animation.toRotation, eased)
      } else if (animation.kind === 'trunk') {
        animation.object.position.y = MathUtils.lerp(animation.from, animation.to, eased)
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
        if (animation.kind === 'hatch' && animation.isVirtual && !execution.targetValue) animation.pivot.visible = false
        finishAction(id, 'completed')
        runtimeAnimations.current.delete(id)
      }
    }
  })

  return (
    <group
      ref={vehicleRoot}
      onPointerMove={handleVehiclePointerMove}
      onPointerOut={() => {
        setHoverVisual(null)
        renderer.domElement.style.cursor = 'grab'
      }}
      onClick={handleVehicleClick}
    >
      {hoverVisual?.meshes.map((mesh) => (
        <VehicleMeshOutline key={`hover-${hoverVisual.key}-${mesh.uuid}`} mesh={mesh} />
      ))}
      {pulseVisual?.meshes.map((mesh) => (
        <VehicleMeshOutline key={`pulse-${pulseVisual.key}-${mesh.uuid}`} mesh={mesh} pulse />
      ))}
      {hoverVisual && (
        <Html
          position={hoverVisual.point}
          center
          zIndexRange={[20, 10]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="vehicle-hover-anchor">
            <div className="vehicle-hover-label">{hoverVisual.label}</div>
          </div>
        </Html>
      )}
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
