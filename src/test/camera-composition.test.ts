import { expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { composeVehicleCamera } from '../runtime/camera-composition'
import { su7ConceptPack } from '../pack/su7-concept.pack'

it('keeps vertical body lines straight while retaining safe-area framing and equal pixel focal lengths', () => {
  for (const [width, height] of [[1440, 796], [1280, 616]]) {
    for (const insets of [[245, 32, 90, 125], [352, 32, 90, 125], [245, 375, 90, 125]] as const) {
      for (const [id, shot] of Object.entries(su7ConceptPack.orbitActions)) {
        if (id === 'cargo_overview') continue
        const camera = new PerspectiveCamera(28, width / height, 0.1, 500)
        camera.position.set(...shot.position)
        const position = camera.position.clone()
        const target = new Vector3(...shot.target)
        composeVehicleCamera(camera, target, width, height, insets, 1)
        const projectedTarget = target.clone().project(camera)
        expect(projectedTarget.x).toBeCloseTo((insets[0] - insets[1]) / width, 9)
        expect(projectedTarget.y).toBeCloseTo((insets[3] - insets[2]) / height, 9)
        expect(camera.projectionMatrix.elements[0] * width).toBeCloseTo(camera.projectionMatrix.elements[5] * height, 8)
        for (const [x, z] of [[-1, -0.7], [1, 0.7]]) {
          const lower = new Vector3(x, 0, z).project(camera)
          const upper = new Vector3(x, 1.4, z).project(camera)
          expect(upper.x).toBeCloseTo(lower.x, 9)
        }
        expect(camera.position.equals(position)).toBe(true)
        expect(target.toArray()).toEqual(shot.target)
      }
    }
  }
})

it('preserves the intentional cargo overview and smoothly corrects intermediate tilts', () => {
  const shot = su7ConceptPack.orbitActions.cargo_overview
  const camera = new PerspectiveCamera(28, 1440 / 796, 0.1, 500)
  camera.position.set(...shot.position)
  const target = new Vector3(...shot.target)
  camera.lookAt(target)
  const original = camera.quaternion.clone()
  for (const amount of [0, 0.25, 0.5, 0.75, 1]) {
    composeVehicleCamera(camera, target, 1440, 796, [245, 32, 90, 125], amount)
    expect(target.clone().project(camera).y).toBeCloseTo(35 / 796, 9)
    if (amount === 0) expect(camera.quaternion.angleTo(original)).toBeCloseTo(0, 8)
  }
})
