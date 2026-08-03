import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const [candidateArg, sourceArg, imageIndexArg, outputArg] = process.argv.slice(2)
if (!candidateArg || !sourceArg || imageIndexArg === undefined || !outputArg) {
  throw new Error('Usage: node scripts/replace-glb-image.mjs <candidate.glb> <source.glb> <image-index> <output.glb>')
}

const imageIndex = Number(imageIndexArg)
if (!Number.isInteger(imageIndex) || imageIndex < 0) throw new Error('image-index must be a non-negative integer')

const readGlb = async (filePath) => {
  const buffer = await fs.readFile(path.resolve(filePath))
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${filePath} is not a GLB`)
  const jsonLength = buffer.readUInt32LE(12)
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/, ''))
  const binHeaderOffset = 20 + jsonLength
  const binLength = buffer.readUInt32LE(binHeaderOffset)
  const bin = buffer.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binLength)
  return { json, bin }
}

const [candidate, source] = await Promise.all([readGlb(candidateArg), readGlb(sourceArg)])
const sourceImage = source.json.images?.[imageIndex]
const sourceView = source.json.bufferViews?.[sourceImage?.bufferView]
const candidateImage = candidate.json.images?.[imageIndex]
if (!sourceImage || !sourceView || !candidateImage) throw new Error(`image ${imageIndex} is unavailable`)

const sourceStart = sourceView.byteOffset ?? 0
const sourceBytes = source.bin.subarray(sourceStart, sourceStart + sourceView.byteLength)
const alignedCandidateLength = Math.ceil(candidate.bin.length / 4) * 4
const appendedOffset = alignedCandidateLength
const nextBinLength = Math.ceil((appendedOffset + sourceBytes.length) / 4) * 4
const nextBin = Buffer.alloc(nextBinLength)
candidate.bin.copy(nextBin)
sourceBytes.copy(nextBin, appendedOffset)

const nextViewIndex = candidate.json.bufferViews.length
candidate.json.bufferViews.push({
  buffer: 0,
  byteOffset: appendedOffset,
  byteLength: sourceBytes.length,
})
candidateImage.bufferView = nextViewIndex
candidateImage.mimeType = sourceImage.mimeType ?? 'image/png'
candidate.json.buffers[0].byteLength = nextBin.length

for (const texture of candidate.json.textures ?? []) {
  if (texture.extensions?.KHR_texture_basisu?.source !== imageIndex) continue
  texture.source = imageIndex
  delete texture.extensions.KHR_texture_basisu
  if (Object.keys(texture.extensions).length === 0) delete texture.extensions
}

const jsonBytes = Buffer.from(JSON.stringify(candidate.json))
const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4
const paddedJson = Buffer.alloc(paddedJsonLength, 0x20)
jsonBytes.copy(paddedJson)
const totalLength = 12 + 8 + paddedJson.length + 8 + nextBin.length
const output = Buffer.alloc(totalLength)
output.write('glTF', 0)
output.writeUInt32LE(2, 4)
output.writeUInt32LE(totalLength, 8)
output.writeUInt32LE(paddedJson.length, 12)
output.writeUInt32LE(0x4e4f534a, 16)
paddedJson.copy(output, 20)
const binHeaderOffset = 20 + paddedJson.length
output.writeUInt32LE(nextBin.length, binHeaderOffset)
output.writeUInt32LE(0x004e4942, binHeaderOffset + 4)
nextBin.copy(output, binHeaderOffset + 8)

await fs.writeFile(path.resolve(outputArg), output)
console.log(JSON.stringify({
  imageIndex,
  mimeType: candidateImage.mimeType,
  restoredBytes: sourceBytes.length,
  outputBytes: output.length,
}, null, 2))
