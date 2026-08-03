import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Object3D, SpotLight } from 'three'
import { su7ConceptPack } from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'

function actionTarget(target: 'headlight' | 'taillight') {
  const state = useExperienceStore.getState()
  const active = [...state.activeActions.values()].find(
    (execution) => execution.action.type === 'lights' && execution.action.target === target,
  )
  return active?.targetValue ?? state.lightStates.get(target) ?? false
}

export function VehicleLightEffects() {
  const headlightRefs = useRef<SpotLight[]>([])
  const taillightRefs = useRef<SpotLight[]>([])
  const headlightTargets = useMemo(
    () => su7ConceptPack.actions.lights_headlight.environmentLights.map((definition) => {
      const target = new Object3D()
      target.position.set(definition.target[0], definition.target[1], definition.target[2])
      return target
    }),
    [],
  )
  const taillightTargets = useMemo(
    () => su7ConceptPack.actions.lights_taillight.environmentLights.map((definition) => {
      const target = new Object3D()
      target.position.set(definition.target[0], definition.target[1], definition.target[2])
      return target
    }),
    [],
  )

  useFrame((_, delta) => {
    const headlightsOn = actionTarget('headlight')
    const taillightsOn = actionTarget('taillight')
    su7ConceptPack.actions.lights_headlight.environmentLights.forEach((definition, index) => {
      const light = headlightRefs.current[index]
      if (light) light.intensity = MathUtils.damp(light.intensity, headlightsOn ? definition.intensity : 0, 6.5, delta)
    })
    su7ConceptPack.actions.lights_taillight.environmentLights.forEach((definition, index) => {
      const beam = taillightRefs.current[index]
      if (beam) beam.intensity = MathUtils.damp(beam.intensity, taillightsOn ? definition.intensity : 0, 6.5, delta)
    })
  })

  return (
    <>
      {headlightTargets.map((target, index) => <primitive key={`headlight-target-${index}`} object={target} />)}
      {taillightTargets.map((target, index) => <primitive key={`taillight-target-${index}`} object={target} />)}
      {su7ConceptPack.actions.lights_headlight.environmentLights.map((definition, index) => (
        <group key={`headlight-effect-${index}`}>
          <spotLight
            ref={(light) => { if (light) headlightRefs.current[index] = light }}
            position={definition.position}
            target={headlightTargets[index]}
            color={su7ConceptPack.actions.lights_headlight.color}
            intensity={0}
            distance={definition.distance}
            angle={definition.angle}
            penumbra={definition.penumbra}
            decay={definition.decay}
            castShadow
            shadow-mapSize={[512, 512]}
            shadow-bias={-0.0004}
          />
        </group>
      ))}
      {su7ConceptPack.actions.lights_taillight.environmentLights.map((definition, index) => (
        <group key={`taillight-effect-${index}`}>
          <spotLight
            ref={(light) => { if (light) taillightRefs.current[index] = light }}
            position={definition.position}
            target={taillightTargets[index]}
            color={su7ConceptPack.actions.lights_taillight.color}
            intensity={0}
            distance={definition.distance}
            angle={definition.angle}
            penumbra={definition.penumbra}
            decay={definition.decay}
          />
        </group>
      ))}
    </>
  )
}
