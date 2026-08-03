import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Matrix4, Quaternion, Vector3 } from 'three'

const readGlbJson = async (filePath) => {
  const buffer = await fs.readFile(filePath)
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error(`${filePath} is not a binary glTF file`)
  }
  const jsonLength = buffer.readUInt32LE(12)
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/, ''))
}

const baselinePath = path.resolve(process.argv[2] ?? 'public/assets/su7_ultra.glb')
const candidatePath = path.resolve(process.argv[3] ?? '')

if (!process.argv[3]) {
  throw new Error('Usage: node scripts/compare-glb-structure.mjs <baseline.glb> <candidate.glb>')
}

const [baseline, candidate] = await Promise.all([
  readGlbJson(baselinePath),
  readGlbJson(candidatePath),
])

const names = (items = []) => items.map((item) => item.name ?? '(unnamed)')
const difference = (left, right) => {
  const rightCounts = new Map()
  right.forEach((value) => rightCounts.set(value, (rightCounts.get(value) ?? 0) + 1))
  return left.filter((value) => {
    const count = rightCounts.get(value) ?? 0
    if (count === 0) return true
    rightCounts.set(value, count - 1)
    return false
  })
}

const sections = ['nodes', 'meshes', 'materials']
const report = Object.fromEntries(sections.map((section) => {
  const baselineNames = names(baseline[section])
  const candidateNames = names(candidate[section])
  return [section, {
    baselineCount: baselineNames.length,
    candidateCount: candidateNames.length,
    missing: difference(baselineNames, candidateNames),
    added: difference(candidateNames, baselineNames),
  }]
}))

report.textures = {
  baselineCount: baseline.textures?.length ?? 0,
  candidateCount: candidate.textures?.length ?? 0,
}
report.extensions = {
  used: candidate.extensionsUsed ?? [],
  required: candidate.extensionsRequired ?? [],
}

const stableJson = (value) => JSON.stringify(value ?? null)
const nodeMatrix = (node = {}) => node.matrix
  ? new Matrix4().fromArray(node.matrix)
  : new Matrix4().compose(
      new Vector3().fromArray(node.translation ?? [0, 0, 0]),
      new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
      new Vector3().fromArray(node.scale ?? [1, 1, 1]),
    )
const matricesEqual = (left, right, epsilon = 1e-6) => left.elements.every(
  (value, index) => Math.abs(value - right.elements[index]) <= epsilon,
)
const nodeOrderDifferences = []
const nodeHierarchyDifferences = []
const nodeTransformDifferences = []
for (let index = 0; index < Math.max(baseline.nodes?.length ?? 0, candidate.nodes?.length ?? 0); index += 1) {
  const before = baseline.nodes?.[index]
  const after = candidate.nodes?.[index]
  if ((before?.name ?? '(unnamed)') !== (after?.name ?? '(unnamed)')) nodeOrderDifferences.push(index)
  if (stableJson(before?.children) !== stableJson(after?.children)) nodeHierarchyDifferences.push(index)
  // Geometry quantization may add a compensating transform to leaf mesh nodes.
  // Product Pack actions address named transform groups, so validate those
  // contract-bearing nodes while allowing equivalent leaf-mesh quantization.
  const contractBearingNode = before?.mesh === undefined || (before?.children?.length ?? 0) > 0
  if (contractBearingNode && !matricesEqual(nodeMatrix(before), nodeMatrix(after))) {
    nodeTransformDifferences.push(index)
  }
}
report.nodeContract = {
  orderDifferenceCount: nodeOrderDifferences.length,
  hierarchyDifferenceCount: nodeHierarchyDifferences.length,
  transformDifferenceCount: nodeTransformDifferences.length,
  orderDifferenceSample: nodeOrderDifferences.slice(0, 10),
  hierarchyDifferenceSample: nodeHierarchyDifferences.slice(0, 10),
  transformDifferenceSample: nodeTransformDifferences.slice(0, 10),
}

console.log(JSON.stringify(report, null, 2))

const structureChanged = ['nodes', 'materials'].some((section) => {
  const result = report[section]
  return result.baselineCount !== result.candidateCount || result.missing.length > 0 || result.added.length > 0
}) || report.nodeContract.orderDifferenceCount > 0
  || report.nodeContract.hierarchyDifferenceCount > 0
  || report.nodeContract.transformDifferenceCount > 0

if (structureChanged) process.exitCode = 1
