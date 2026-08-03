import { Suspense } from 'react'
import { ContactShadows } from '@react-three/drei'
import { VehicleModel } from './VehicleModel'
import { OrbitCameraRig } from './OrbitCameraRig'

export function Experience() {
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
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-5, 3, -4]} intensity={1.35} color="#91b9ff" />
      <spotLight position={[0, 6, -5]} intensity={3.2} angle={0.55} penumbra={0.8} color="#ffd15c" />
      <Suspense fallback={null}>
        <VehicleModel />
      </Suspense>
      <ContactShadows position={[0, -0.015, 0]} opacity={0.72} scale={12} blur={2.6} far={5} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow>
        <circleGeometry args={[10, 96]} />
        <meshStandardMaterial color="#14171b" roughness={0.72} metalness={0.22} />
      </mesh>
      <OrbitCameraRig />
    </>
  )
}
