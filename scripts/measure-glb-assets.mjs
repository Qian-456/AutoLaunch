import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const modelPath = path.resolve(process.argv[2] ?? 'public/assets/su7_ultra.glb')
const buffer = await fs.readFile(modelPath)
const jsonLength = buffer.readUInt32LE(12)
const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/, ''))
const binaryOffset = 20 + jsonLength + 8

const pngSize = (imageBuffer) => {
  if (imageBuffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null
  return [imageBuffer.readUInt32BE(16), imageBuffer.readUInt32BE(20)]
}

const ktx2Info = (imageBuffer) => {
  if (imageBuffer.toString('hex', 0, 12) !== 'ab4b5458203230bb0d0a1a0a') return null
  return {
    size: [imageBuffer.readUInt32LE(20), imageBuffer.readUInt32LE(24)],
    supercompressionScheme: imageBuffer.readUInt32LE(44),
  }
}

const textures = (json.images ?? []).map((image, index) => {
  const view = json.bufferViews?.[image.bufferView]
  const start = binaryOffset + (view?.byteOffset ?? 0)
  const end = start + (view?.byteLength ?? 0)
  const imageBuffer = buffer.subarray(start, end)
  const pngDimensions = pngSize(imageBuffer)
  const ktx2 = ktx2Info(imageBuffer)
  const ktx2Dimensions = ktx2?.size ?? null
  const size = pngDimensions ?? ktx2Dimensions
  const decodedBytes = pngDimensions ? pngDimensions[0] * pngDimensions[1] * 4 : null
  const estimatedRuntimeWithMipmapsBytes = pngDimensions
    ? Math.ceil(decodedBytes * 4 / 3)
    : ktx2Dimensions
      ? Math.ceil(
          ktx2Dimensions[0]
          * ktx2Dimensions[1]
          * (ktx2.supercompressionScheme === 1 ? 2 / 3 : 4 / 3),
        )
      : null
  return {
    index,
    name: image.name ?? '(unnamed)',
    mimeType: image.mimeType ?? '(external)',
    dimensions: size ? `${size[0]}x${size[1]}` : '(unknown)',
    encodedBytes: view?.byteLength ?? null,
    decodedBytes,
    decodedWithMipmapsBytes: decodedBytes === null ? null : Math.ceil(decodedBytes * 4 / 3),
    estimatedRuntimeWithMipmapsBytes,
  }
})

const total = (key) => textures.reduce((sum, texture) => sum + (texture[key] ?? 0), 0)
console.log(JSON.stringify({
  file: modelPath,
  fileBytes: buffer.byteLength,
  counts: {
    nodes: json.nodes?.length ?? 0,
    meshes: json.meshes?.length ?? 0,
    materials: json.materials?.length ?? 0,
    textures: textures.length,
  },
  textureTotals: {
    encodedBytes: total('encodedBytes'),
    decodedBytes: total('decodedBytes'),
    decodedWithMipmapsBytes: total('decodedWithMipmapsBytes'),
    estimatedRuntimeWithMipmapsBytes: total('estimatedRuntimeWithMipmapsBytes'),
  },
  textures: textures.sort((a, b) => (
    (b.estimatedRuntimeWithMipmapsBytes ?? b.decodedBytes ?? 0)
    - (a.estimatedRuntimeWithMipmapsBytes ?? a.decodedBytes ?? 0)
  )),
}, null, 2))
