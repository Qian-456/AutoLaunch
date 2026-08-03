import { Suspense } from 'react'
import { ContactShadows } from '@react-three/drei'
import { VehicleModel } from './VehicleModel'
import { OrbitCameraRig } from './OrbitCameraRig'
import { useExperienceStore } from '../store/experience-store'

function LaunchStage() {
  return (
    <group>
      <mesh position={[0, -0.085, 0]} receiveShadow>
        <cylinderGeometry args={[4.65, 4.82, 0.13, 96]} />
        <meshStandardMaterial color="#0a1012" roughness={0.28} metalness={0.78} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.012, 0]}>
        <ringGeometry args={[4.02, 4.07, 128]} />
        <meshBasicMaterial color="#24e6c1" toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <ringGeometry args={[3.35, 3.38, 128]} />
        <meshBasicMaterial color="#467067" toneMapped={false} />
      </mesh>
      <spotLight position={[0, 7, 0]} intensity={4.2} angle={0.5} penumbra={0.9} color="#bfffee" />
    </group>
  )
}

export function Experience() {
  const stageMode = useExperienceStore((state) => state.stageMode)

  return (
    <>
      <color attach="background" args={['#090b0e']} />
      <fog attach="fog" args={['#090b0e', 10, 22]} />
      <ambientLight intensity={0.82} />
      <directionalLight
        castShadow
        position={[4, 8, 6]}
        intensity={2.35}
        color="#fff8e8"
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 3, -4]} intensity={1.35} color="#91b9ff" />
      <spotLight position={[0, 6, -5]} intensity={3.2} angle={0.55} penumbra={0.8} color="#ffd15c" />
      <Suspense fallback={null}>
        <VehicleModel />
      </Suspense>
      <ContactShadows position={[0, -0.015, 0]} opacity={0.72} scale={12} blur={2.6} far={5} frames={3} />
      {stageMode === 'launch' ? <LaunchStage /> : (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow>
          <circleGeometry args={[10, 96]} />
          <meshStandardMaterial color="#14171b" roughness={0.72} metalness={0.22} />
        </mesh>
      )}
      <OrbitCameraRig />
    </>
  )
}
