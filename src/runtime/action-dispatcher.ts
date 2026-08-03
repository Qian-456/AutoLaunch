import { WINDOW_LABELS, WINDOW_TARGETS, su7ConceptPack, type WindowActionDefinition } from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import type { ActiveVehicleAction, VehicleAction, WindowTarget } from '../types'

export type DispatchResult =
  | { ok: true; message: string; actionId?: string }
  | { ok: false; message: string }

let nextActionId = 1

/**
 * For non-window actions (trunk / lights) the boolean target is the single source.
 * For window actions we expose `progress` first, then derive `targetValue` as
 * progress > 0 so the existing open/close conflict checks still work.
 */
function targetValueOf(action: Exclude<VehicleAction, { type: 'orbit' }>): boolean {
  if (action.type === 'window') return action.progress > 0
  if (action.type === 'trunk') return action.open
  return action.on
}

/**
 * Current committed boolean state, inferred from the domain store.
 * For windows we treat any progress > 0 as "open" for conflict checks,
 * matching the logic inside partStateFromProgress().
 */
function currentValueOf(action: Exclude<VehicleAction, { type: 'orbit' }>): boolean {
  const state = useExperienceStore.getState()
  if (action.type === 'window') {
    const target = action.target as Exclude<WindowTarget, 'all'>
    return (state.windowProgress.get(target) ?? 0) > 0
  }
  if (action.type === 'trunk') return state.vehiclePartStates.get('trunk') === 'open'
  return state.lightStates.get(action.target) ?? false
}

function currentProgressOf(target: Exclude<WindowTarget, 'all'>): number {
  return useExperienceStore.getState().windowProgress.get(target) ?? 0
}

function conflictGroupOf(action: Exclude<VehicleAction, { type: 'orbit' }>): string {
  if (action.type === 'window') {
    const target = action.target === 'all' ? WINDOW_TARGETS[0] : action.target
    const definition = su7ConceptPack.actions[
      `window_${target}` as keyof typeof su7ConceptPack.actions
    ] as WindowActionDefinition | undefined
    return definition?.conflictGroup ?? 'windows'
  }
  if (action.type === 'trunk') return su7ConceptPack.actions.trunk.conflictGroup
  return action.target === 'headlight'
    ? su7ConceptPack.actions.lights_headlight.conflictGroup
    : su7ConceptPack.actions.lights_taillight.conflictGroup
}

function durationOf(action: Exclude<VehicleAction, { type: 'orbit' }>): number {
  if (action.type === 'window') {
    const target = action.target === 'all' ? WINDOW_TARGETS[0] : action.target
    const definition = su7ConceptPack.actions[
      `window_${target}` as keyof typeof su7ConceptPack.actions
    ] as WindowActionDefinition | undefined
    return definition?.durationMs ?? 800
  }
  if (action.type === 'trunk') return su7ConceptPack.actions.trunk.durationMs
  return action.target === 'headlight'
    ? su7ConceptPack.actions.lights_headlight.durationMs
    : su7ConceptPack.actions.lights_taillight.durationMs
}

function labelOf(action: Exclude<VehicleAction, { type: 'orbit' }>): string {
  if (action.type === 'window') {
    const targetLabel = action.target === 'all'
      ? '全部车窗'
      : WINDOW_LABELS[action.target as Exclude<WindowTarget, 'all'>]
    return `${targetLabel} ${action.progress > 0 ? `开启至 ${action.progress}%` : '关闭至 0%'}`
  }
  if (action.type === 'trunk') return `后备箱${action.open ? '打开' : '关闭'}`
  return `${action.target === 'headlight' ? '大灯' : '尾灯'}${action.on ? '开启' : '关闭'}`
}

/**
 * Build one ActiveVehicleAction for a concrete non-bulk action.
 * `startProgress` / `targetProgress` are only populated for window
 * actions so VehicleModel.tsx can interpolate from an arbitrary middle
 * position instead of resetting to the 0% or 100% extremities.
 */
function buildExecution(
  action: Exclude<VehicleAction, { type: 'orbit' }>,
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
  return execution
}

function dispatchSingle(action: Exclude<VehicleAction, { type: 'orbit' }>): DispatchResult {
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

  if (action.type === 'trunk' && su7ConceptPack.actions.trunk.mode === 'fallback') {
    useExperienceStore.getState().requestOrbit(su7ConceptPack.actions.trunk.fallbackCamera)
    useExperienceStore.getState().setNotice('当前模型没有完整尾门节点，已用车尾镜头与轻微抬升代替。')
  }

  return { ok: true, message: `${labelOf(action)}：动作已开始`, actionId: execution.id }
}

export function dispatchVehicleAction(action: VehicleAction): DispatchResult {
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

  return dispatchSingle(action)
}
