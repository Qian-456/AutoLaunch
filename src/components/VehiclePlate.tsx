import { useEffect, useMemo } from 'react'
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

type VehiclePlateProps = {
  text: string
  position: readonly [number, number, number]
  rotation: readonly [number, number, number]
  size: readonly [number, number]
  background: string
  foreground: string
}

export function VehiclePlate({
  text,
  position,
  rotation,
  size,
  background,
  foreground,
}: VehiclePlateProps) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 768
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建车牌纹理')

    context.fillStyle = background
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = foreground
    context.globalAlpha = 0.18
    context.lineWidth = 8
    context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24)
    context.globalAlpha = 1
    context.fillStyle = foreground
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '700 82px Arial, sans-serif'
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 2)

    const nextTexture = new CanvasTexture(canvas)
    nextTexture.colorSpace = SRGBColorSpace
    nextTexture.minFilter = LinearFilter
    nextTexture.magFilter = LinearFilter
    return nextTexture
  }, [background, foreground, text])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={[...position]} rotation={[...rotation]} renderOrder={4}>
      <planeGeometry args={[size[0], size[1]]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
