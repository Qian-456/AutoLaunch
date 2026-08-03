export type OrbitPreset = 'hero_front_left' | 'front' | 'driver_side' | 'rear_three_quarter' | 'turntable'

export type OrbitAction = {
  type: 'orbit'
  preset: OrbitPreset
}

export type VehicleAction = OrbitAction

export type OrbitActionDefinition = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  transitionMs: number
  autoRotate?: boolean
  autoRotateSpeed?: number
}
