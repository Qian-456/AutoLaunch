export type OrbitPreset = 'hero_front_left' | 'front' | 'driver_side' | 'rear_three_quarter' | 'turntable'

export type OrbitAction = {
  type: 'orbit'
  preset: OrbitPreset
}

export type WindowAction = {
  type: 'window'
  target: 'driver_front'
  open: boolean
}

export type TrunkAction = {
  type: 'trunk'
  open: boolean
}

export type LightsAction = {
  type: 'lights'
  target: 'headlight' | 'taillight'
  on: boolean
}

export type VehicleAction = OrbitAction | WindowAction | TrunkAction | LightsAction

export type VehiclePartId = 'window_driver_front' | 'trunk'
export type LightPartId = 'headlight' | 'taillight'
export type VehiclePartState = 'open' | 'closed' | 'moving'
export type VoiceState = 'available' | 'unsupported' | 'denied' | 'listening'
export type ActionTerminalStatus = 'completed' | 'cancelled' | 'failed'

export type ActiveVehicleAction = {
  id: string
  action: Exclude<VehicleAction, OrbitAction>
  conflictGroup: string
  durationMs: number
  startedAt: number
  timeoutAt: number
  startValue: boolean
  targetValue: boolean
}

export type OrbitActionDefinition = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  transitionMs: number
  autoRotate?: boolean
  autoRotateSpeed?: number
}
