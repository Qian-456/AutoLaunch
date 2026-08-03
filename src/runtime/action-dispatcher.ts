import { su7ConceptPack } from '../pack/su7-concept.pack'
import { useExperienceStore } from '../store/experience-store'
import type { VehicleAction } from '../types'

export type DispatchResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

export function dispatchVehicleAction(action: VehicleAction): DispatchResult {
  if (action.type === 'orbit') {
    const definition = su7ConceptPack.orbitActions[action.preset]
    if (!definition) return { ok: false, message: `未注册的环绕动作：${action.preset}` }
    useExperienceStore.getState().requestOrbit(action.preset)
    return { ok: true, message: `镜头已切换：${action.preset}` }
  }

  return { ok: false, message: '暂不支持该动作' }
}
