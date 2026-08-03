import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

const modelPath = path.resolve(process.argv[2] ?? 'public/assets/su7_ultra.glb')
const nodeFilter = process.argv[3] ? new RegExp(process.argv[3], 'i') : null
const buffer = await fs.readFile(modelPath)
const jsonLength = buffer.readUInt32LE(12)
const document = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/, ''))
const box = new Box3().makeEmpty()
const corners = Array.from({ length: 8 }, () => new Vector3())
const nodeBounds = []
const visit = (nodeIndex, parentMatrix) => {
  const node = document.nodes[nodeIndex]
  const local = node.matrix
    ? new Matrix4().fromArray(node.matrix)
    : new Matrix4().compose(
        new Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
        new Vector3().fromArray(node.scale ?? [1, 1, 1]),
      )
  const world = new Matrix4().multiplyMatrices(parentMatrix, local)
  const subtreeBox = new Box3().makeEmpty()
  if (node.mesh !== undefined) {
    for (const primitive of document.meshes[node.mesh].primitives) {
      const accessor = document.accessors[primitive.attributes.POSITION]
      if (!accessor?.min || !accessor?.max) continue
      let cursor = 0
      for (const x of [accessor.min[0], accessor.max[0]]) {
        for (const y of [accessor.min[1], accessor.max[1]]) {
          for (const z of [accessor.min[2], accessor.max[2]]) {
            corners[cursor++].set(x, y, z).applyMatrix4(world)
          }
        }
      }
      corners.forEach((corner) => subtreeBox.expandByPoint(corner))
    }
  }
  node.children?.forEach((child) => subtreeBox.union(visit(child, world)))
  box.union(subtreeBox)
  nodeBounds[nodeIndex] = subtreeBox
  return subtreeBox
}
const scene = document.scenes[document.scene ?? 0]
scene.nodes.forEach((node) => visit(node, new Matrix4()))
const size = box.getSize(new Vector3())
const center = box.getCenter(new Vector3())
const nodes = document.nodes.map((node, index) => ({
  index,
  name: node.name || '(unnamed)',
  type: node.mesh === undefined ? 'Group' : 'Mesh',
  children: node.children?.map((childIndex) => ({
    index: childIndex,
    name: document.nodes[childIndex]?.name || '(unnamed)',
  })) ?? [],
  ...(nodeBounds[index] && !nodeBounds[index].isEmpty()
    ? {
        bounds: {
          min: nodeBounds[index].min.toArray(),
          max: nodeBounds[index].max.toArray(),
          size: nodeBounds[index].getSize(new Vector3()).toArray(),
          center: nodeBounds[index].getCenter(new Vector3()).toArray(),
        },
      }
    : {}),
}))

console.log(JSON.stringify({
  file: modelPath,
  nodeCount: nodes.length,
  bounds: { min: box.min.toArray(), max: box.max.toArray(), size: size.toArray(), center: center.toArray() },
  nodes: nodeFilter ? nodes.filter((node) => nodeFilter.test(node.name)) : nodes,
}, null, 2))
