import type { PropId } from './props/prop-catalog'

export type OrbitPreset = 'hero_front_left' | 'front' | 'driver_side' | 'rear_three_quarter' | 'cargo_rear' | 'cargo_overview' | 'turntable'

export type OrbitAction = {
  type: 'orbit'
  preset: OrbitPreset
}

/**
 * Target identifier for individual window control.
 * 'all' expands into four simultaneous per-window actions at dispatch time.
 */
export type WindowTarget = 'driver_front' | 'passenger_front' | 'driver_rear' | 'passenger_rear' | 'all'

export type WindowAction = {
  type: 'window'
  target: WindowTarget
  open: boolean
  /**
   * 0 = fully closed, 100 = fully open.
   * Buttons use 0 / 100 only; text/voice commands allow any integer in [0,100].
   */
  progress: number
}

export type DoorTarget = 'driver_front' | 'passenger_front' | 'driver_rear' | 'passenger_rear' | 'all'

export type DoorAction = {
  type: 'door'
  target: DoorTarget
  open: boolean
  progress: number
}

export type HatchTarget = 'rear_hatch' | 'front_hatch'

export type HatchAction = {
  type: 'hatch'
  target: HatchTarget
  open: boolean
  progress: number
}

export type TrunkAction = {
  type: 'trunk'
  /** Legacy alias: true routes this action to the front hatch. */
  frunk?: boolean
  open: boolean
}

export type LightsAction = {
  type: 'lights'
  target: 'headlight' | 'taillight'
  on: boolean
}

export type CargoAnchorId = 'rear_left' | 'rear_right' | 'front_center'
export type CargoLayoutId = 'two_suitcases'

export type CargoAction =
  | { type: 'cargo'; operation: 'place'; propId: PropId; preferredAnchor?: CargoAnchorId }
  | { type: 'cargo'; operation: 'remove'; propId: PropId }
  | { type: 'cargo'; operation: 'clear' }
  | { type: 'cargo'; operation: 'demonstrate'; combinationId: CargoLayoutId }

export type CargoBounds = {
  center: readonly [number, number, number]
  halfSize: readonly [number, number, number]
  rotationY: number
}

export type CargoPlacementState = 'staged' | 'dragging' | 'loading' | 'loaded' | 'returning'

export type CargoPlacement = {
  propId: PropId
  state: CargoPlacementState
  position: readonly [number, number, number]
  rotation: readonly [number, number, number]
  occupiedBounds: CargoBounds
  anchorId: CargoAnchorId | null
  /** Transient animation origin; omitted after loading/returning completes. */
  transitionFrom?: readonly [number, number, number]
}

export type VehicleAction = OrbitAction | WindowAction | DoorAction | HatchAction | TrunkAction | LightsAction | CargoAction

export type LaunchChapter = {
  id: string
  title: string
  narration: string
  durationMs: number
  camera: OrbitPreset
  actions: readonly {
    atMs: number
    action: Exclude<VehicleAction, OrbitAction | CargoAction>
  }[]
}

export type VehiclePartId =
  | 'window_driver_front'
  | 'window_passenger_front'
  | 'window_driver_rear'
  | 'window_passenger_rear'
  | 'hatch_rear'
  | 'hatch_front'
  | 'frunk'
  | 'door_driver_front'
  | 'door_passenger_front'
  | 'door_driver_rear'
  | 'door_passenger_rear'
  | 'trunk'

export type LightPartId = 'headlight' | 'taillight'
export type VehiclePartState = 'open' | 'closed' | 'moving'
export type VoiceState = 'available' | 'unsupported' | 'denied' | 'listening'
export type ActionTerminalStatus = 'completed' | 'cancelled' | 'failed'

export type ActiveVehicleAction = {
  id: string
  action: Exclude<VehicleAction, OrbitAction | CargoAction>
  conflictGroup: string
  durationMs: number
  startedAt: number
  timeoutAt: number
  startValue: boolean
  targetValue: boolean
  /**
   * For window actions: the final normalized progress [0..100] after this action.
   * trunk/lights ignore this field.
   */
  targetProgress?: number
  /**
   * For window actions: the normalized progress [0..100] at the moment the action started.
   * Allows smooth interpolation from an arbitrary intermediate position instead of
   * resetting to 0/100 on every new command.
   */
  startProgress?: number
}

export type OrbitActionDefinition = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  transitionMs: number
  autoRotate?: boolean
  autoRotateSpeed?: number
}
