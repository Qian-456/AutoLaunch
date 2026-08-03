import { create } from 'zustand'
import type {
  ActionTerminalStatus,
  ActiveVehicleAction,
  LightPartId,
  OrbitPreset,
  VehiclePartId,
  VehiclePartState,
  VoiceState,
} from '../types'

type ActionOutcome = { id: string; status: ActionTerminalStatus } | null

type ExperienceState = {
  cameraControlOwner: 'script' | 'orbit'
  activeOrbitPreset: OrbitPreset
  orbitRequestId: number
  manualOrbit: boolean
  modelStatus: 'loading' | 'ready' | 'error'
  notice: string | null
  inputMode: { text: true; voice: VoiceState }
  vehiclePartStates: Map<VehiclePartId, VehiclePartState>
  lightStates: Map<LightPartId, boolean>
  activeActions: Map<string, ActiveVehicleAction>
  lastActionOutcome: ActionOutcome
  requestOrbit: (preset: OrbitPreset) => void
  beginManualOrbit: () => void
  setModelStatus: (status: ExperienceState['modelStatus']) => void
  setNotice: (notice: string | null) => void
  setVoiceState: (voice: VoiceState) => void
  startAction: (execution: ActiveVehicleAction) => void
  finishAction: (id: string, status: ActionTerminalStatus) => void
}

const initialPartStates = () => new Map<VehiclePartId, VehiclePartState>([
  ['window_driver_front', 'closed'],
  ['trunk', 'closed'],
])

const initialLightStates = () => new Map<LightPartId, boolean>([
  ['headlight', false],
  ['taillight', false],
])

export const useExperienceStore = create<ExperienceState>((set) => ({
  cameraControlOwner: 'orbit',
  activeOrbitPreset: 'hero_front_left',
  orbitRequestId: 0,
  manualOrbit: false,
  modelStatus: 'loading',
  notice: null,
  inputMode: { text: true, voice: 'unsupported' },
  vehiclePartStates: initialPartStates(),
  lightStates: initialLightStates(),
  activeActions: new Map(),
  lastActionOutcome: null,
  requestOrbit: (preset) => set((state) => ({
    cameraControlOwner: 'orbit',
    activeOrbitPreset: preset,
    orbitRequestId: state.orbitRequestId + 1,
    manualOrbit: false,
    notice: preset === 'turntable' ? '已启动 360° 展台环绕' : null,
  })),
  beginManualOrbit: () => set({
    cameraControlOwner: 'orbit',
    manualOrbit: true,
    notice: '已切换为手动环绕；不会自动恢复镜头',
  }),
  setModelStatus: (modelStatus) => set({ modelStatus }),
  setNotice: (notice) => set({ notice }),
  setVoiceState: (voice) => set((state) => ({ inputMode: { ...state.inputMode, voice } })),
  startAction: (execution) => set((state) => {
    const activeActions = new Map(state.activeActions)
    let cancelledId: string | null = null
    for (const [id, active] of activeActions) {
      if (active.conflictGroup === execution.conflictGroup) {
        activeActions.delete(id)
        cancelledId = id
      }
    }
    activeActions.set(execution.id, execution)

    const vehiclePartStates = new Map(state.vehiclePartStates)
    if (execution.action.type === 'window') vehiclePartStates.set('window_driver_front', 'moving')
    if (execution.action.type === 'trunk') vehiclePartStates.set('trunk', 'moving')

    return {
      activeActions,
      vehiclePartStates,
      lastActionOutcome: cancelledId ? { id: cancelledId, status: 'cancelled' } : null,
    }
  }),
  finishAction: (id, status) => set((state) => {
    const execution = state.activeActions.get(id)
    if (!execution) return state

    const activeActions = new Map(state.activeActions)
    activeActions.delete(id)
    const vehiclePartStates = new Map(state.vehiclePartStates)
    const lightStates = new Map(state.lightStates)
    const committedValue = status === 'completed' ? execution.targetValue : execution.startValue

    if (execution.action.type === 'window') {
      vehiclePartStates.set('window_driver_front', committedValue ? 'open' : 'closed')
    } else if (execution.action.type === 'trunk') {
      vehiclePartStates.set('trunk', committedValue ? 'open' : 'closed')
    } else if (execution.action.type === 'lights') {
      lightStates.set(execution.action.target, committedValue)
    }

    return {
      activeActions,
      vehiclePartStates,
      lightStates,
      lastActionOutcome: { id, status },
      ...(status === 'failed' ? { notice: '动作执行超时，已回滚到开始状态' } : {}),
    }
  }),
}))
