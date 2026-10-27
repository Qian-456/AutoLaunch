import { Component, Suspense, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, Html, useEnvironment, useTexture } from '@react-three/drei'
import { CatmullRomCurve3, ExtrudeGeometry, PlaneGeometry, RepeatWrapping, Shape, SRGBColorSpace, TubeGeometry, Vector2, Vector3 } from 'three'
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

const asset = (file: string) => `/assets/environments/${file}`

export const showroomEnvironments = {
  studio: { label: '光之展廊', sky: '#111518', hdr: 'studio_small_09_1k.hdr', intensity: 0.65, exposure: 0.95,
    keyPosition: [-3, 7, 3] as const, keyIntensity: 0.65, keyColor: '#f5e6d2' },
  circuit: { label: '暮色赛道', sky: '#18202b', hdr: 'zwartkops_start_sunset_1k.hdr', background: 'zwartkops_start_sunset_8k.webp', intensity: 1, exposure: 0.95,
    keyPosition: [6.92, 2.12, -9.57] as const, keyIntensity: 0.9, keyColor: '#ffe0b5' },
  sunset: { label: '日落旷野', sky: '#7b6862', hdr: 'toposcope_sunset_1k.hdr', background: 'toposcope_sunset_8k.webp', intensity: 1.25, exposure: 0.95,
    keyPosition: [9.31, 0.59, 7.55] as const, keyIntensity: 0.45, keyColor: '#ffd0a3' },
} as const
export type ShowroomEnvironment = keyof typeof showroomEnvironments

class EnvironmentBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError('布景资源暂不可用，已保留基础灯光；车辆控制仍可使用。') }
  render() { return this.state.failed ? <FallbackFloor /> : this.props.children }
}

function FallbackFloor() {
  return <><hemisphereLight args={['#d5e1f1', '#35312c', 0.75]} /><mesh rotation-x={-Math.PI / 2} position-y={-0.005} receiveShadow>
    <planeGeometry args={[200, 200]} /><meshStandardMaterial color="#23282b" roughness={0.65} />
  </mesh></>
}

function GalleryFloor() {
  const reflector = useMemo(() => new Reflector(new PlaneGeometry(80, 120), {
    textureWidth: 1024, textureHeight: 1024, color: '#7a8792', multisample: 0,
  }), [])
  const source = useTexture([
    asset('concrete_floor_02_diff_1k.jpg'), asset('concrete_floor_02_nor_gl_1k.jpg'), asset('concrete_floor_02_rough_1k.jpg'),
  ])
  const textures = useMemo(() => source.map((texture, index) => {
    const copy = texture.clone()
    copy.wrapS = copy.wrapT = RepeatWrapping
    copy.repeat.set(40, 60)
    if (index === 0) copy.colorSpace = SRGBColorSpace
    return copy
  }), [source])
  useEffect(() => () => { textures.forEach((texture) => texture.dispose()) }, [textures])
  useEffect(() => () => { reflector.dispose(); reflector.geometry.dispose() }, [reflector])
  // shortcut: concrete softens a planar reflection; use rough reflection sampling for close-up floor shots.
  return <>
    <primitive object={reflector} rotation-x={-Math.PI / 2} position-y={-0.014} />
    <mesh rotation-x={-Math.PI / 2} position-y={-0.005} receiveShadow>
      <planeGeometry args={[80, 120]} />
      <meshStandardMaterial map={textures[0]} normalMap={textures[1]} normalScale={new Vector2(0.035, 0.035)}
        color="#303a44" metalness={0.3} roughness={0.6} roughnessMap={textures[2]} transparent opacity={0.8} depthWrite={false} />
    </mesh>
  </>
}

function Gallery() {
  const [arch, strip] = useMemo(() => {
    const profile = new Shape()
    profile.moveTo(-7.2, 0)
    profile.lineTo(-7.2, 1.2)
    profile.absellipse(0, 1.2, 7.2, 3.5, Math.PI, 0, true, 0)
    profile.lineTo(7.2, 0)
    profile.lineTo(6.86, 0)
    profile.lineTo(6.86, 1.2)
    profile.absellipse(0, 1.2, 6.86, 3.15, 0, Math.PI, false, 0)
    profile.lineTo(-6.86, 0)
    profile.closePath()
    const curve = new CatmullRomCurve3([
      new Vector3(-6.78, 0.06, -0.02),
      ...Array.from({ length: 33 }, (_, index) => {
        const angle = Math.PI - index / 32 * Math.PI
        return new Vector3(Math.cos(angle) * 6.78, 1.2 + Math.sin(angle) * 3.05, -0.02)
      }),
      new Vector3(6.78, 0.06, -0.02),
    ])
    return [new ExtrudeGeometry(profile, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 48 }), new TubeGeometry(curve, 128, 0.018, 5, false)]
  }, [])
  useEffect(() => () => { arch.dispose(); strip.dispose() }, [arch, strip])
  return <group>
    <GalleryFloor />
    {/* A continuous roof and supported portals make a room, rather than isolated props. */}
    <mesh position={[12, 4.95, 0]}><boxGeometry args={[40, 0.4, 16]} /><meshStandardMaterial color="#151e27" roughness={0.8} /></mesh>
    {[5, 11, 17, 23, 29].map((x) => <group key={x} position={[x, 0, 0]} rotation-y={Math.PI / 2}>
      <mesh geometry={arch}><meshStandardMaterial color="#526475" roughness={0.5} metalness={0.25} /></mesh>
      <mesh geometry={strip}><meshBasicMaterial color="#f5dfb6" toneMapped={false} /></mesh>
    </group>)}
    {[-8, 8].map((z) => <mesh key={z} position={[12, 2.4, z]}>
      <boxGeometry args={[40, 4.8, 0.4]} /><meshStandardMaterial color="#1c2935" roughness={0.85} />
    </mesh>)}
    <mesh position={[32, 2.4, 0]}><boxGeometry args={[0.4, 4.8, 16]} /><meshStandardMaterial color="#101923" roughness={0.95} /></mesh>
    <spotLight position={[0, 4.5, 2]} intensity={75} angle={0.95} penumbra={1} color="#f7e7cb" />
    <spotLight position={[-3, 3.8, -5]} intensity={45} angle={0.9} penumbra={1} color="#bfd8ff" />
  </group>
}

function Outdoor({ environment }: { environment: 'circuit' | 'sunset' }) {
  const setting = showroomEnvironments[environment]
  const texture = useEnvironment({ files: asset(setting.hdr) })
  const background = useTexture(asset(setting.background))
  useEffect(() => () => { background.dispose() }, [background])
  const rotation = environment === 'circuit' ? Math.PI / 2 : 0
  const skybox = useMemo(() => {
    background.colorSpace = SRGBColorSpace
    background.anisotropy = 4
    const result = new GroundedSkybox(background, 1.7, 100, 64)
    result.position.y = 1.695
    // The official photographic backplate is already tone mapped; HDR remains the light source.
    result.material.toneMapped = false
    result.raycast = () => undefined
    return result
  }, [background, environment])
  useEffect(() => () => { skybox.geometry.dispose(); skybox.material.dispose() }, [skybox])
  return <>
    <Environment map={texture} environmentIntensity={setting.intensity} environmentRotation={[0, rotation, 0]} />
    <primitive object={skybox} rotation-y={rotation} />
  </>
}

export function ShowroomEnvironment({ environment, onError }: { environment: ShowroomEnvironment; onError: (message: string) => void }) {
  const setting = showroomEnvironments[environment]
  const renderer = useThree((state) => state.gl)
  useLayoutEffect(() => {
    const previous = renderer.toneMappingExposure
    renderer.toneMappingExposure = setting.exposure
    return () => { renderer.toneMappingExposure = previous }
  }, [renderer, setting.exposure])
  return <>
    <color attach="background" args={[setting.sky]} />
    {environment === 'studio' && <hemisphereLight args={['#d1e0f2', '#24282d', 0.18]} />}
    {/* Outdoor key directions follow the HDR sun, after the same panorama rotation. */}
    <directionalLight castShadow position={setting.keyPosition}
      intensity={setting.keyIntensity} color={setting.keyColor}
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7}
      shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={0.025} />
    {/* Keep one reflector camera: Three retains a transmission target for each camera. */}
    <group visible={environment === 'studio'}>
      <EnvironmentBoundary onError={onError}>
        <Suspense fallback={null}><Gallery /></Suspense>
      </EnvironmentBoundary>
    </group>
    <EnvironmentBoundary key={environment} onError={onError}>
      <Suspense fallback={<><FallbackFloor /><Html position={[0, 1.8, 0]} center style={{ pointerEvents: 'none' }}><p className="environment-loading" role="status">正在载入场景…</p></Html></>}>
        {environment === 'studio' ? <Environment files={asset(setting.hdr)} environmentIntensity={setting.intensity} /> : <Outdoor environment={environment} />}
      </Suspense>
    </EnvironmentBoundary>
  </>
}
