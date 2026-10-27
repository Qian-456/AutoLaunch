import { registry } from '../pack/ai-registry'
import { sameObject } from './ai-contract'
import type { VehicleAction } from '../types'
import { useExperienceStore } from '../store/experience-store'
import { dispatchVehicleAction } from './action-dispatcher'

export type EntityInstance = {
  packId: string; entityId: string; instanceId: string
  parentInstanceId?: string; relations?: { type: 'loaded-in'; instanceId: string }[]
}
export type TargetedVehicleAction = {
  packId: string; entityId: string; targetInstanceId?: string; actionId: string; action: VehicleAction
}
// Definitions only. Instances are projected from Zustand, never copied state.
export function validateEntityAction(command: TargetedVehicleAction, instances: readonly EntityInstance[], definition = registry) {
  if (command.packId !== definition.packId) return false
  const entity = definition.entities.find((e) => e.entityId === command.entityId)
  const capability = definition.actions.find((entry) => entry.actionId === command.actionId)
  const a = command.action
  const instanceCargo = a.type === 'cargo' && (a.operation === 'move' || a.operation === 'remove')
    && command.actionId === `cargo:${a.operation}` && a.instanceId === command.targetInstanceId
  if (!entity || !(entity.capabilities as readonly string[]).includes(command.actionId)
    || (!instanceCargo && (!capability || !sameObject(capability.action, command.action)))) return false
  if (command.targetInstanceId) {
    return instances.some((instance) => instance.instanceId === command.targetInstanceId && instance.packId === command.packId && instance.entityId === command.entityId)
  }
  return true
}

export function currentEntityInstances(): EntityInstance[] {
  return [
    ...registry.entities.filter((e) => e.kind !== 'prop').map((e) => ({
      packId: registry.packId, entityId: e.entityId, instanceId: `${e.entityId}:main`,
      ...(e.parent ? { parentInstanceId: `${e.parent}:main` } : {}),
    })),
    ...[...useExperienceStore.getState().cargoPlacements.values()].map((p) => ({
      packId: registry.packId, entityId: `prop:${p.catalogPropId}`, instanceId: p.instanceId,
      parentInstanceId: 'vehicle:main', relations: p.state === 'loaded' ? [{ type: 'loaded-in' as const, instanceId: 'trunk:main' }] : [],
    })),
  ]
}

/** Optional envelope adapter; the legacy VehicleAction API remains unchanged. */
export function dispatchEntityAction(command: TargetedVehicleAction) {
  if (!validateEntityAction(command, currentEntityInstances())) return { ok: false as const, message: '实体、实例或能力引用不合法' }
  return dispatchVehicleAction(command.action)
}
