import { create } from 'zustand'
import type {
  ActionTerminalStatus,
  ActiveVehicleAction,
  LightPartId,
  OrbitPreset,
  VehiclePartId,
  VehiclePartState,
  VoiceState,
  WindowTarget,
} from '../types'
import { WINDOW_TARGETS } from '../pack/su7-concept.pack'

type ActionOutcome = { id: string; status: ActionTerminalStatus } | null

type ExperienceState = {
  stageMode: 'studio' | 'launch'
  cameraControlOwner: 'script' | 'orbit'
  activeOrbitPreset: OrbitPreset
  orbitRequestId: number
  manualOrbit: boolean
  modelStatus: 'loading' | 'ready' | 'error'
  notice: string | null
  inputMode: { text: true; voice: VoiceState }
  vehiclePartStates: Map<VehiclePartId, VehiclePartState>
  /**
   * Normalized window openness per physical window: 0 = fully closed, 100 = fully open.
   * Preserves the exact integer value from the last completed WindowAction.progress
   * so text/voice commands like "50%" round-trip correctly.
   */
  windowProgress: Map<Exclude<WindowTarget, 'all'>, number>
  lightStates: Map<LightPartId, boolean>
  activeActions: Map<string, ActiveVehicleAction>
  lastActionOutcome: ActionOutcome
  setStageMode: (mode: ExperienceState['stageMode']) => void
  requestOrbit: (preset: OrbitPreset) => void
  beginManualOrbit: () => void
  setModelStatus: (status: ExperienceState['modelStatus']) => void
  setNotice: (notice: string | null) => void
  setVoiceState: (voice: VoiceState) => void
  startAction: (execution: ActiveVehicleAction) => void
  finishAction: (id: string, status: ActionTerminalStatus) => void
}

const initialPartStates = () =>
  new Map<VehiclePartId, VehiclePartState>([
    ['window_driver_front', 'closed'],
    ['window_passenger_front', 'closed'],
    ['window_driver_rear', 'closed'],
    ['window_passenger_rear', 'closed'],
    ['hatch_rear', 'closed'],
    ['trunk', 'closed'],
  ])

const initialWindowProgress = () =>
  new Map<Exclude<WindowTarget, 'all'>, number>(WINDOW_TARGETS.map((target) => [target, 0] as const))

const initialLightStates = () =>
  new Map<LightPartId, boolean>([
    ['headlight', false],
    ['taillight', false],
  ])

/**
 * Convert a completed window progress percentage into the coarse
 * open/closed/moving domain state used by the rest of the UI.
 * Threshold: >= 1% counts as "open" so intermediate positions like 50%
 * still surface the open visual state on quick-control buttons.
 */
function partStateFromProgress(progress: number): VehiclePartState {
  if (progress <= 0) return 'closed'
  if (progress >= 100) return 'open'
  return 'open'
}

/**
 * Build the VehiclePartId key string for a per-window store entry.
 * 'all' is intentionally excluded because the dispatcher expands bulk
 * actions before reaching the store.
 */
function windowPartId(target: Exclude<WindowTarget, 'all'>): VehiclePartId {
  return `window_${target}` as VehiclePartId
}

export const useExperienceStore = create<ExperienceState>((set) => ({
  stageMode: 'studio',
  cameraControlOwner: 'orbit',
  activeOrbitPreset: 'hero_front_left',
  orbitRequestId: 0,
  manualOrbit: false,
  modelStatus: 'loading',
  notice: null,
  inputMode: { text: true, voice: 'unsupported' },
  vehiclePartStates: initialPartStates(),
  windowProgress: initialWindowProgress(),
  lightStates: initialLightStates(),
  activeActions: new Map(),
  lastActionOutcome: null,
  setStageMode: (stageMode) => set({ stageMode }),
  requestOrbit: (preset) =>
    set((state) => ({
      cameraControlOwner: 'orbit',
      activeOrbitPreset: preset,
      orbitRequestId: state.orbitRequestId + 1,
      manualOrbit: false,
      notice: preset === 'turntable' ? '已启动 360° 展台环绕' : null,
    })),
  beginManualOrbit: () =>
    set({
      cameraControlOwner: 'orbit',
      manualOrbit: true,
      notice: '已切换为手动环绕；不会自动恢复镜头',
    }),
  setModelStatus: (modelStatus) => set({ modelStatus }),
  setNotice: (notice) => set({ notice }),
  setVoiceState: (voice) =>
    set((state) => ({ inputMode: { ...state.inputMode, voice } })),
  startAction: (execution) =>
    set((state) => {
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
      if (execution.action.type === 'window') {
        const target = execution.action.target as Exclude<WindowTarget, 'all'>
        vehiclePartStates.set(windowPartId(target), 'moving')
      }
      if (execution.action.type === 'hatch') {
        vehiclePartStates.set('hatch_rear', 'moving')
        vehiclePartStates.set('trunk', 'moving')
      }
      if (execution.action.type === 'trunk') vehiclePartStates.set('trunk', 'moving')

      return {
        activeActions,
        vehiclePartStates,
        lastActionOutcome: cancelledId ? { id: cancelledId, status: 'cancelled' } : null,
      }
    }),
  finishAction: (id, status) =>
    set((state) => {
      const execution = state.activeActions.get(id)
      if (!execution) return state

      const activeActions = new Map(state.activeActions)
      activeActions.delete(id)
      const vehiclePartStates = new Map(state.vehiclePartStates)
      const windowProgress = new Map(state.windowProgress)
      const lightStates = new Map(state.lightStates)
      const committedValue = status === 'completed' ? execution.targetValue : execution.startValue

      if (execution.action.type === 'window') {
        const target = execution.action.target as Exclude<WindowTarget, 'all'>
        const committedProgress =
          status === 'completed'
            ? Math.max(0, Math.min(100, Math.round(execution.targetProgress ?? (committedValue ? 100 : 0))))
            : Math.max(0, Math.min(100, Math.round(execution.startProgress ?? (committedValue ? 100 : 0))))
        windowProgress.set(target, committedProgress)
        vehiclePartStates.set(windowPartId(target), partStateFromProgress(committedProgress))
      } else if (execution.action.type === 'hatch') {
        vehiclePartStates.set('hatch_rear', committedValue ? 'open' : 'closed')
        vehiclePartStates.set('trunk', committedValue ? 'open' : 'closed')
      } else if (execution.action.type === 'trunk') {
        vehiclePartStates.set('trunk', committedValue ? 'open' : 'closed')
        vehiclePartStates.set('hatch_rear', committedValue ? 'open' : 'closed')
      } else if (execution.action.type === 'lights') {
        lightStates.set(execution.action.target, committedValue)
      }

      return {
        activeActions,
        vehiclePartStates,
        windowProgress,
        lightStates,
        lastActionOutcome: { id, status },
        ...(status === 'failed' ? { notice: '动作执行超时，已回滚到开始状态' } : {}),
      }
    }),
}))
