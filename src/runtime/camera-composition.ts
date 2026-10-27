import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three'

const naturalRotation = new Quaternion()
const levelRotation = new Quaternion()
const levelTarget = new Vector3()
const localTarget = new Vector3()

/** Keep vehicle verticals upright; lens shift preserves the target inside the UI's safe area. */
export function composeVehicleCamera(
  camera: PerspectiveCamera,
  target: Vector3,
  width: number,
  height: number,
  insets: readonly [number, number, number, number],
  upright: number,
) {
  const [left, right, top, bottom] = insets
  const safeWidth = Math.max(1, width - left - right)
  const safeHeight = Math.max(1, height - top - bottom)
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  naturalRotation.copy(camera.quaternion)
  levelTarget.copy(target).setY(camera.position.y)
  if (levelTarget.distanceToSquared(camera.position) > 0.000001) {
    camera.lookAt(levelTarget)
    levelRotation.copy(camera.quaternion)
    camera.quaternion.slerpQuaternions(naturalRotation, levelRotation, MathUtils.clamp(upright, 0, 1))
  }
  camera.updateMatrixWorld()
  camera.worldToLocal(localTarget.copy(target))
  const focalLength = safeHeight / (2 * Math.tan(MathUtils.degToRad(camera.getEffectiveFOV()) / 2))
  const verticalShift = -localTarget.y * focalLength / Math.max(0.0001, -localTarget.z)
  camera.setViewOffset(safeWidth, safeHeight, -left, -top + verticalShift, width, height)
}
