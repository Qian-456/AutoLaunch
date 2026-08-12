import {
  DOOR_LABELS,
  DOOR_TARGETS,
  HatchActionDefinition,
  WINDOW_LABELS,
  WINDOW_TARGETS,
  su7ConceptPack,
  type WindowActionDefinition,
  type DoorActionDefinition,
} from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import type {
  ActiveVehicleAction,
  CargoAction,
  CargoInstanceId,
  CargoOrientation,
  CargoPlacement,
  DoorTarget,
  HatchTarget,
  VehicleAction,
  WindowTarget,
} from '../types'
import { findProp, type PropId } from '../props/prop-catalog'
import { candidateAtPosition, findCargoPlacement, type CargoPlacementCandidate } from './cargo-layout'

export type DispatchResult =
  | { ok: true; message: string; actionId?: string }
  | { ok: false; message: string }

let nextActionId = 1
let nextCargoInstanceId = 1
type VehicleRuntimeAction = Exclude<VehicleAction, { type: 'orbit' } | { type: 'cargo' }>

const cargoReasonLabels = {
  'outside-volume': '物品会超出后备箱真实可用空间',
  'intersects-wall': '物品与后备箱内壁或轮拱发生碰撞',
  'blocked-opening': '当前姿态无法通过后备箱入口',
  occupied: '当前位置与已放置物品重叠',
  'floor-support-required': '本版本仅支持放置在后备箱地板上',
} as const

function loadingPlacement(
  instanceId: CargoInstanceId,
  propId: PropId,
  candidate: CargoPlacementCandidate,
  transitionFrom?: readonly [number, number, number],
): CargoPlacement {
  return {
    instanceId,
    catalogPropId: propId,
    state: 'loading',
    orientation: candidate.orientation,
    position: candidate.position,
    rotation: candidate.rotation,
    occupiedBounds: candidate.bounds,
    anchorId: candidate.anchorId,
    transitionFrom,
  }
}

function createCargoInstanceId(propId: PropId) {
  return `${propId}-${nextCargoInstanceId++}`
}

function placementReasonMessage(reason: keyof typeof cargoReasonLabels | null) {
  return reason ? cargoReasonLabels[reason] : '请将箱子移动到后备箱地板内'
}

function dispatchCargoAction(action: CargoAction): DispatchResult {
  const state = useExperienceStore.getState()
  if (action.operation === 'demonstrate') {
    const propIds: PropId[] = ['checked_24', 'carry_on_20']
    const placements: CargoPlacement[] = []
    for (const propId of propIds) {
      const candidate = findCargoPlacement(propId, placements, propId === 'checked_24' ? 'rear_left' : 'rear_right', 'flat')
      if (!candidate.ok) return { ok: false, message: '真实空间内无法生成双箱并排布局' }
      placements.push(loadingPlacement(createCargoInstanceId(propId), propId, candidate.candidate))
    }
    state.setCargoPlacements(placements)
    state.setCargoPlacementSession(null)
    state.setSelectedCargoInstance(null)
    dispatchVehicleAction({ type: 'trunk', open: true })
    state.requestOrbit('cargo_rear')
    return { ok: true, message: '正在按真实后备箱边界演示双箱并排装载' }
  }

  if (action.operation === 'clear') {
    for (const placement of state.cargoPlacements.values()) {
      const entry = findProp(placement.catalogPropId)
      if (!entry) continue
      const stageCenter = [entry.stagePosition[0], entry.stagePosition[1] + entry.dimensionsM[0] / 2, entry.stagePosition[2]] as const
      state.setCargoPlacement({
        ...placement,
        state: 'returning',
        transitionFrom: placement.position,
        position: stageCenter,
        rotation: entry.stageRotation,
        anchorId: null,
      })
    }
    state.setCargoPlacementSession(null)
    state.setSelectedCargoInstance(null)
    return { ok: true, message: '正在收回全部行李道具' }
  }

  if (action.operation === 'spawn') {
    if (state.cargoPlacements.size >= su7ConceptPack.cargoVolume.collider.maxInstances) {
      return { ok: false, message: `场景最多放置 ${su7ConceptPack.cargoVolume.collider.maxInstances} 个道具` }
    }
    const instanceId = createCargoInstanceId(action.propId)
    const existing = [...state.cargoPlacements.values()].filter((placement) => placement.state !== 'returning')
    const initial = findCargoPlacement(action.propId, existing, undefined, 'flat')
    state.setCargoPlacementSession({
      instanceId,
      catalogPropId: action.propId,
      orientation: 'flat',
      rotationY: Math.PI / 2,
      candidate: initial.ok ? loadingPlacement(instanceId, action.propId, initial.candidate) : null,
      valid: initial.ok,
      reason: initial.ok ? null : initial.reason,
      snappedToInstanceId: initial.ok ? initial.candidate.snappedToInstanceId : null,
      precisionMode: false,
      originalPlacement: null,
    })
    state.setSelectedCargoInstance(null)
    dispatchVehicleAction({ type: 'trunk', open: true })
    state.requestOrbit('cargo_rear')
    return { ok: true, message: '移动鼠标放置；滚轮或 Q/E 旋转，R 切换姿态，单击确认' }
  }

  if (action.operation === 'confirm') {
    const session = state.cargoPlacementSession
    if (!session?.candidate || !session.valid) return { ok: false, message: placementReasonMessage(session?.reason ?? null) }
    const entry = findProp(session.catalogPropId)
    const transitionFrom = session.originalPlacement?.position
      ?? (entry ? [entry.stagePosition[0], entry.stagePosition[1] + entry.dimensionsM[0] / 2, entry.stagePosition[2]] as const : session.candidate.position)
    state.setCargoPlacement({ ...session.candidate, state: 'loading', transitionFrom })
    state.setCargoPlacementSession(null)
    state.setSelectedCargoInstance(session.instanceId)
    return { ok: true, message: `${entry?.name ?? '行李箱'}已放入后备箱` }
  }

  if (action.operation === 'cancel') {
    state.setCargoPlacementSession(null)
    return { ok: true, message: '已取消本次放置，原有布局未改变' }
  }

  if (action.operation === 'remove') {
    const current = state.cargoPlacements.get(action.instanceId)
    if (!current) return { ok: true, message: '该行李箱尚未装入后备箱' }
    if (current.state === 'loading' || current.state === 'returning') return { ok: false, message: '行李箱正在移动，请稍候' }
    const entry = findProp(current.catalogPropId)
    if (!entry) return { ok: false, message: '未注册的行李道具' }
    const stageCenter = [entry.stagePosition[0], entry.stagePosition[1] + entry.dimensionsM[0] / 2, entry.stagePosition[2]] as const
    state.setCargoPlacement({
      ...current,
      state: 'returning',
      transitionFrom: current.position,
      position: stageCenter,
      rotation: entry.stageRotation,
      anchorId: null,
    })
    state.setSelectedCargoInstance(null)
    return { ok: true, message: `正在取出${entry.name}` }
  }

  if (action.operation === 'move') {
    const current = state.cargoPlacements.get(action.instanceId)
    if (!current || current.state !== 'loaded') return { ok: false, message: '当前道具暂时不能移动' }
    state.setCargoPlacementSession({
      instanceId: current.instanceId,
      catalogPropId: current.catalogPropId,
      orientation: current.orientation,
      rotationY: current.rotation[1],
      candidate: current,
      valid: true,
      reason: null,
      snappedToInstanceId: null,
      precisionMode: false,
      originalPlacement: current,
    })
    state.setSelectedCargoInstance(null)
    return { ok: true, message: '正在重新放置；右键或 Esc 可恢复原位置' }
  }

  if (action.operation === 'rotate') {
    const session = state.cargoPlacementSession
    if (!session) return { ok: false, message: '请先添加或移动一个道具' }
    const orientationOrder: CargoOrientation[] = ['flat', 'side', 'upright']
    const rotationY = session.rotationY + (action.direction ?? 0) * Math.PI * (action.degrees ?? 15) / 180
    const nextOrientation = action.orientation
      ?? (action.direction ? session.orientation : orientationOrder[(orientationOrder.indexOf(session.orientation) + 1) % orientationOrder.length])
    const existing = [...state.cargoPlacements.values()].filter((placement) => placement.instanceId !== session.instanceId && placement.state !== 'returning')
    const center = session.candidate?.position ?? [2, su7ConceptPack.cargoVolume.floorY, 0]
    const result = candidateAtPosition(session.catalogPropId, center[0], center[2], nextOrientation, rotationY, existing, session.precisionMode)
    state.setCargoPlacementSession({
      ...session,
      orientation: nextOrientation,
      rotationY,
      candidate: result.candidate ? loadingPlacement(session.instanceId, session.catalogPropId, result.candidate) : null,
      valid: result.ok,
      reason: result.ok ? null : result.reason,
      snappedToInstanceId: result.ok ? result.candidate.snappedToInstanceId : null,
    })
    return { ok: true, message: result.ok ? '姿态已更新' : placementReasonMessage(result.reason) }
  }

  return { ok: false, message: '不支持的道具操作' }
}

/**
 * For non-window actions (hatch / trunk / lights) the boolean target is the
 * single source. For window actions we expose `progress` first, then derive
 * `targetValue` as progress > 0 so the existing open/close conflict checks
 * still work.
 */
function targetValueOf(action: VehicleRuntimeAction): boolean {
  if (action.type === 'window') return action.progress > 0
  if (action.type === 'door') return action.progress > 0
  if (action.type === 'hatch') return action.open
  if (action.type === 'trunk') return action.open
  return action.on
}

/**
 * Current committed boolean state, inferred from the domain store.
 * For windows we treat any progress > 0 as "open" for conflict checks,
 * matching the logic inside partStateFromProgress().
 */
function currentValueOf(action: VehicleRuntimeAction): boolean {
  const state = useExperienceStore.getState()
  if (action.type === 'window') {
    const target = action.target as Exclude<WindowTarget, 'all'>
    return (state.windowProgress.get(target) ?? 0) > 0
  }
  if (action.type === 'door') {
    const target = action.target as Exclude<DoorTarget, 'all'>
    return state.vehiclePartStates.get(`door_${target}`) === 'open'
  }
  if (action.type === 'hatch') {
    return state.vehiclePartStates.get(action.target === 'front_hatch' ? 'hatch_front' : 'hatch_rear') === 'open'
  }
  if (action.type === 'trunk') {
    return state.vehiclePartStates.get('trunk') === 'open'
  }
  return state.lightStates.get(action.target) ?? false
}

function currentProgressOf(target: Exclude<WindowTarget, 'all'>): number {
  return useExperienceStore.getState().windowProgress.get(target) ?? 0
}

function conflictGroupOf(action: VehicleRuntimeAction): string {
  if (action.type === 'window') {
    const target = action.target === 'all' ? WINDOW_TARGETS[0] : action.target
    const definition = su7ConceptPack.actions[
      `window_${target}` as keyof typeof su7ConceptPack.actions
    ] as WindowActionDefinition | undefined
    return definition?.conflictGroup ?? 'windows'
  }
  if (action.type === 'door') {
    const target = action.target === 'all' ? DOOR_TARGETS[0] : action.target
    return (su7ConceptPack.actions[`door_${target}`] as DoorActionDefinition).conflictGroup
  }
  if (action.type === 'hatch') {
    const definition = action.target === 'front_hatch'
      ? su7ConceptPack.actions.hatch_front
      : su7ConceptPack.actions.hatch_rear
    return (definition as HatchActionDefinition).conflictGroup
  }
  if (action.type === 'trunk') return su7ConceptPack.actions.trunk.conflictGroup
  return action.target === 'headlight'
    ? su7ConceptPack.actions.lights_headlight.conflictGroup
    : su7ConceptPack.actions.lights_taillight.conflictGroup
}

function durationOf(action: VehicleRuntimeAction): number {
  if (action.type === 'window') {
    const target = action.target === 'all' ? WINDOW_TARGETS[0] : action.target
    const definition = su7ConceptPack.actions[
      `window_${target}` as keyof typeof su7ConceptPack.actions
    ] as WindowActionDefinition | undefined
    return definition?.durationMs ?? 800
  }
  if (action.type === 'door') {
    const target = action.target === 'all' ? DOOR_TARGETS[0] : action.target
    return (su7ConceptPack.actions[`door_${target}`] as DoorActionDefinition).durationMs
  }
  if (action.type === 'hatch') {
    return (action.target === 'front_hatch' ? su7ConceptPack.actions.hatch_front : su7ConceptPack.actions.hatch_rear).durationMs
  }
  if (action.type === 'trunk') {
    // Prefer the real hatch duration when forwarding so the visible animation
    // and the timeout window stay in sync; fall back to the legacy trunk
    // duration as a safety net.
    return (su7ConceptPack.actions.hatch_rear as HatchActionDefinition | undefined)?.durationMs
      ?? su7ConceptPack.actions.trunk.durationMs
  }
  return action.target === 'headlight'
    ? su7ConceptPack.actions.lights_headlight.durationMs
    : su7ConceptPack.actions.lights_taillight.durationMs
}

function labelOf(action: VehicleRuntimeAction): string {
  if (action.type === 'window') {
    const targetLabel = action.target === 'all'
      ? '全部车窗'
      : WINDOW_LABELS[action.target as Exclude<WindowTarget, 'all'>]
    return `${targetLabel} ${action.progress > 0 ? `开启至 ${action.progress}%` : '关闭至 0%'}`
  }
  if (action.type === 'door') {
    const targetLabel = action.target === 'all' ? '全部车门' : DOOR_LABELS[action.target]
    return `${targetLabel}${action.open ? '打开' : '关闭'}`
  }
  if (action.type === 'hatch') return `${action.target === 'front_hatch' ? '前备箱' : '后备箱'}${action.open ? '打开' : '关闭'}`
  if (action.type === 'trunk') return `${action.frunk ? '前备箱' : '后备箱'}${action.open ? '打开' : '关闭'}`
  return `${action.target === 'headlight' ? '大灯' : '尾灯'}${action.on ? '开启' : '关闭'}`
}

/**
 * Build one ActiveVehicleAction for a concrete non-bulk action.
 * `startProgress` / `targetProgress` are only populated for window
 * actions so VehicleModel.tsx can interpolate from an arbitrary middle
 * position instead of resetting to the 0% or 100% extremities.
 */
function buildExecution(
  action: VehicleRuntimeAction,
): ActiveVehicleAction {
  const now = Date.now()
  const targetValue = targetValueOf(action)
  const execution: ActiveVehicleAction = {
    id: `vehicle-action-${nextActionId++}`,
    action,
    conflictGroup: conflictGroupOf(action),
    durationMs: durationOf(action),
    startedAt: now,
    timeoutAt: now + 5000,
    startValue: currentValueOf(action),
    targetValue,
  }
  if (action.type === 'window' && action.target !== 'all') {
    execution.startProgress = currentProgressOf(action.target as Exclude<WindowTarget, 'all'>)
    execution.targetProgress = Math.max(0, Math.min(100, Math.round(action.progress)))
  }
  if (action.type === 'door' && action.target !== 'all') {
    execution.startProgress = currentValueOf(action) ? 100 : 0
    execution.targetProgress = action.open ? 100 : 0
  }
  return execution
}

function dispatchSingle(action: VehicleRuntimeAction): DispatchResult {
  const state = useExperienceStore.getState()
  const targetValue = targetValueOf(action)
  const conflictGroup = conflictGroupOf(action)
  const runningInGroup = [...state.activeActions.values()].find(
    (active) => active.conflictGroup === conflictGroup,
  )

  if (runningInGroup?.targetValue === targetValue) {
    return { ok: true, message: `${labelOf(action)}：动作正在执行` }
  }

  if (!runningInGroup && currentValueOf(action) === targetValue) {
    if (action.type === 'window' && action.target !== 'all') {
      const currentP = currentProgressOf(action.target as Exclude<WindowTarget, 'all'>)
      const wantedP = Math.max(0, Math.min(100, Math.round(action.progress)))
      if (currentP === wantedP) {
        return { ok: true, message: `${labelOf(action)}：已处于目标状态` }
      }
    } else {
      return { ok: true, message: `${labelOf(action)}：已处于目标状态` }
    }
  }

  const execution = buildExecution(action)
  state.startAction(execution)

  return { ok: true, message: `${labelOf(action)}：动作已开始`, actionId: execution.id }
}

export function dispatchVehicleAction(action: VehicleAction): DispatchResult {
  if (action.type === 'cargo') return dispatchCargoAction(action)
  if (action.type === 'orbit') {
    const definition = su7ConceptPack.orbitActions[action.preset]
    if (!definition) return { ok: false, message: `未注册的环绕动作：${action.preset}` }
    useExperienceStore.getState().requestOrbit(action.preset)
    return { ok: true, message: `镜头已切换：${action.preset}` }
  }

  if (action.type === 'window' && action.target === 'all') {
    const normalizedProgress = Math.max(0, Math.min(100, Math.round(action.progress)))
    const messages: string[] = []
    for (const target of WINDOW_TARGETS) {
      const result = dispatchSingle({
        type: 'window',
        target,
        open: normalizedProgress > 0,
        progress: normalizedProgress,
      })
      messages.push(result.message)
    }
    return {
      ok: true,
      message:
        normalizedProgress === 0
          ? '已发送全部车窗关闭指令'
          : `已发送全部车窗开启至 ${normalizedProgress}% 指令`,
    }
  }

  if (action.type === 'window') {
    const normalized = {
      ...action,
      progress: Math.max(0, Math.min(100, Math.round(action.progress))),
    }
    return dispatchSingle(normalized)
  }

  if (action.type === 'door' && action.target === 'all') {
    for (const target of DOOR_TARGETS) {
      dispatchSingle({ type: 'door', target, open: action.open, progress: action.open ? 100 : 0 })
    }
    return { ok: true, message: `已发送全部车门${action.open ? '打开' : '关闭'}指令` }
  }

  if (action.type === 'door') {
    return dispatchSingle({ ...action, progress: action.open ? 100 : 0 })
  }

  if (
    ((action.type === 'trunk' && !action.open && !action.frunk)
      || (action.type === 'hatch' && action.target === 'rear_hatch' && !action.open))
    && [...useExperienceStore.getState().cargoPlacements.values()].some(
      (placement) => placement.state === 'dragging' || placement.state === 'loading' || placement.state === 'returning',
    )
  ) {
    return { ok: false, message: '行李箱正在移动，完成装载或取出后才能关闭后备箱' }
  }

  // Legacy trunk alias → normalized hatch action.
  if (action.type === 'trunk') {
    const hatchTarget: HatchTarget = action.frunk ? 'front_hatch' : 'rear_hatch'
    return dispatchSingle({
      type: 'hatch',
      target: hatchTarget,
      open: action.open,
      progress: action.open ? 100 : 0,
    })
  }

  return dispatchSingle(action)
}
