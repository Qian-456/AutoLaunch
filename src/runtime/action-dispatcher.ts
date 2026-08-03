import { su7ConceptPack } from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import type { ActiveVehicleAction, VehicleAction } from '../types'

export type DispatchResult =
  | { ok: true; message: string; actionId?: string }
  | { ok: false; message: string }

let nextActionId = 1

function targetValueOf(action: Exclude<VehicleAction, { type: 'orbit' }>) {
  if (action.type === 'window' || action.type === 'trunk') return action.open
  return action.on
}

function currentValueOf(action: Exclude<VehicleAction, { type: 'orbit' }>) {
  const state = useExperienceStore.getState()
  if (action.type === 'window') return state.vehiclePartStates.get('window_driver_front') === 'open'
  if (action.type === 'trunk') return state.vehiclePartStates.get('trunk') === 'open'
  return state.lightStates.get(action.target) ?? false
}

function conflictGroupOf(action: Exclude<VehicleAction, { type: 'orbit' }>) {
  if (action.type === 'window') return su7ConceptPack.actions.window_driver_front.conflictGroup
  if (action.type === 'trunk') return su7ConceptPack.actions.trunk.conflictGroup
  return action.target === 'headlight'
    ? su7ConceptPack.actions.lights_headlight.conflictGroup
    : su7ConceptPack.actions.lights_taillight.conflictGroup
}

function durationOf(action: Exclude<VehicleAction, { type: 'orbit' }>) {
  if (action.type === 'window') return su7ConceptPack.actions.window_driver_front.durationMs
  if (action.type === 'trunk') return su7ConceptPack.actions.trunk.durationMs
  return action.target === 'headlight'
    ? su7ConceptPack.actions.lights_headlight.durationMs
    : su7ConceptPack.actions.lights_taillight.durationMs
}

function labelOf(action: Exclude<VehicleAction, { type: 'orbit' }>) {
  if (action.type === 'window') return `主驾车窗${action.open ? '打开' : '关闭'}`
  if (action.type === 'trunk') return `后备箱${action.open ? '打开' : '关闭'}`
  return `${action.target === 'headlight' ? '大灯' : '尾灯'}${action.on ? '开启' : '关闭'}`
}

export function dispatchVehicleAction(action: VehicleAction): DispatchResult {
  if (action.type === 'orbit') {
    const definition = su7ConceptPack.orbitActions[action.preset]
    if (!definition) return { ok: false, message: `未注册的环绕动作：${action.preset}` }
    useExperienceStore.getState().requestOrbit(action.preset)
    return { ok: true, message: `镜头已切换：${action.preset}` }
  }

  const state = useExperienceStore.getState()
  const targetValue = targetValueOf(action)
  const conflictGroup = conflictGroupOf(action)
  const runningInGroup = [...state.activeActions.values()].find((active) => active.conflictGroup === conflictGroup)

  if (runningInGroup?.targetValue === targetValue) {
    return { ok: true, message: `${labelOf(action)}动作正在执行` }
  }

  if (!runningInGroup && currentValueOf(action) === targetValue) {
    return { ok: true, message: `${labelOf(action)}：已处于目标状态` }
  }

  const now = Date.now()
  const execution: ActiveVehicleAction = {
    id: `vehicle-action-${nextActionId++}`,
    action,
    conflictGroup,
    durationMs: durationOf(action),
    startedAt: now,
    timeoutAt: now + 5000,
    startValue: runningInGroup ? !targetValue : currentValueOf(action),
    targetValue,
  }

  state.startAction(execution)

  if (action.type === 'trunk' && su7ConceptPack.actions.trunk.mode === 'fallback') {
    useExperienceStore.getState().requestOrbit(su7ConceptPack.actions.trunk.fallbackCamera)
    useExperienceStore.getState().setNotice('当前模型没有完整尾门节点，已用车尾镜头与轻微抬升代替。')
  }

  return { ok: true, message: `${labelOf(action)}动作已开始`, actionId: execution.id }
}
