import { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { MOUSE, Vector3 } from 'three'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import type { OrbitActionDefinition } from '../types'

const smoothStep = (value: number) => value * value * (3 - 2 * value)

export function OrbitCameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const transition = useRef<null | {
    startedAt: number
    duration: number
    fromPosition: Vector3
    toPosition: Vector3
    fromTarget: Vector3
    toTarget: Vector3
  }>(null)
  const { camera, gl } = useThree()
  const playback = useExperienceStore((state) => state.playback)
  const activeOrbitPreset = useExperienceStore((state) => state.activeOrbitPreset)
  const orbitRequestId = useExperienceStore((state) => state.orbitRequestId)
  const manualOrbit = useExperienceStore((state) => state.manualOrbit)
  const beginManualOrbit = useExperienceStore((state) => state.beginManualOrbit)
  const cargoPlacementActive = useExperienceStore((state) => Boolean(state.cargoPlacementSession))
  const definition: OrbitActionDefinition = su7ConceptPack.orbitActions[activeOrbitPreset]

  useEffect(() => {
    // Claim control before OrbitControls' pointer listener sees this same event.
    // Script ownership disables user input until this explicit user gesture.
    const claim = () => {
      if (useExperienceStore.getState().playback === 'playing') {
        beginManualOrbit()
        transition.current = null
        if (controlsRef.current) controlsRef.current.enabled = true
      }
    }
    gl.domElement.addEventListener('pointerdown', claim, true)
    return () => gl.domElement.removeEventListener('pointerdown', claim, true)
  }, [gl, beginManualOrbit])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    transition.current = {
      startedAt: performance.now(),
      duration: definition.transitionMs,
      fromPosition: camera.position.clone(),
      toPosition: new Vector3(...definition.position),
      fromTarget: controls.target.clone(),
      toTarget: new Vector3(...definition.target),
    }
  }, [camera, definition, orbitRequestId])

  useFrame(() => {
    const controls = controlsRef.current
    const active = transition.current
    if (useExperienceStore.getState().manualOrbit) { transition.current = null; return }
    if (!controls) return
    if (!active) {
      // Drei skips update() for disabled controls. Registered script turntables
      // still need exactly one update, while pointer input stays disabled.
      if (useExperienceStore.getState().playback === 'playing' && definition.autoRotate) controls.update()
      return
    }
    const progress = Math.min(1, (performance.now() - active.startedAt) / active.duration)
    const eased = smoothStep(progress)
    camera.position.lerpVectors(active.fromPosition, active.toPosition, eased)
    controls.target.lerpVectors(active.fromTarget, active.toTarget, eased)
    controls.update()
    if (progress === 1) transition.current = null
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={playback !== 'playing'}
      enableDamping
      dampingFactor={0.065}
      enablePan={false}
      mouseButtons={cargoPlacementActive
        ? { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }
        : { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      minDistance={4.6}
      maxDistance={11}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.49}
      autoRotate={!manualOrbit && (definition.autoRotate ?? false)}
      autoRotateSpeed={definition.autoRotateSpeed ?? 0.9}
      onStart={() => { if (!useExperienceStore.getState().manualOrbit) beginManualOrbit() }}
    />
  )
}
