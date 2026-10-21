import { su7ConceptPack as pack, WINDOW_TARGETS, DOOR_TARGETS } from './su7-concept.pack'
import { propCatalog } from '../props/prop-catalog'
import type { LaunchChapter, VehicleAction } from '../types'

export const schemaVersion = '1.0.0'
export const registryVersion = `${pack.version}-director.1`
export const personaChapters = {
  personas: ['family', 'performance'],
  fallbackChapterIdsByPersona: {
    family: ['rear-hatch', 'family-space', 'frameless-windows'],
    performance: ['front-design', 'frameless-windows', 'interactive-finale'],
  },
}

export const chapterPool: readonly LaunchChapter[] = [
  ...pack.launchScript,
  {
    id: 'family-space', title: '家庭储物与通风', camera: 'rear_three_quarter', durationMs: 20_000,
    narration: '打开尾门停留观察，再展示四车窗通风。模型空间仅用于概念演示，实际装载请以实车为准。',
    actions: [
      { atMs: 500, action: { type: 'trunk', open: true } },
      { atMs: 4000, action: { type: 'window', target: 'all', open: true, progress: 100 } },
    ],
  },
  {
    id: 'cargo-demo', title: '双箱装载概念演示', camera: 'cargo_rear', durationMs: 20_000,
    narration: '按已注册的双箱组合演示，布局仍经过现有空间与碰撞检查；这不是实车容量测量。',
    actions: [{ atMs: 2000, action: { type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' } }],
  },
]

const actionKey = (a: VehicleAction): string => {
  if (a.type === 'orbit') return `orbit:${a.preset}`
  if (a.type === 'lights') return `lights:${a.target}:${a.on ? 'on' : 'off'}`
  if (a.type === 'trunk') return `trunk:${a.open ? 'open' : 'close'}`
  if (a.type === 'cargo') return 'cargo:demonstrate:two_suitcases'
  return `${a.type}:${a.target}:${a.open ? 'open' : 'close'}`
}

// AI receives a finite, reviewed subset of the Pack's capabilities. Direct manual
// commands retain the existing continuous-progress API and are not LLM generated.
const actions: VehicleAction[] = [
  ...Object.keys(pack.orbitActions).map((preset) => ({ type: 'orbit', preset }) as VehicleAction),
  ...[true, false].flatMap((open): VehicleAction[] => [
    ...[...WINDOW_TARGETS, 'all' as const].filter((t) => t === 'all' || `window_${t}` in pack.actions)
      .map((target) => ({ type: 'window', target, open, progress: open ? 100 : 0 }) as VehicleAction),
    ...[...DOOR_TARGETS, 'all' as const].filter((t) => t === 'all' || `door_${t}` in pack.actions)
      .map((target) => ({ type: 'door', target, open, progress: open ? 100 : 0 }) as VehicleAction),
    ...(['front_hatch', 'rear_hatch'] as const).map((target) => ({ type: 'hatch', target, open, progress: open ? 100 : 0 }) as VehicleAction),
    { type: 'trunk', open },
    { type: 'lights', target: 'headlight', on: open },
    { type: 'lights', target: 'taillight', on: open },
  ]),
  { type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' },
]

export const entityDefinitions = [
  { entityId: 'vehicle', kind: 'vehicle', parent: null, capabilities: actions.map(actionKey), attribution: pack.attribution, knowledgeRefs: ['knowledge/'] },
  ...Object.keys(pack.actions).map((entityId) => ({
    entityId, kind: 'part', parent: 'vehicle', capabilities: actions.filter((a) =>
      ('target' in a && (entityId === `${a.type}_${a.target}` || entityId === `lights_${a.target}`))
      || (a.type === 'hatch' && entityId === `hatch_${a.target === 'front_hatch' ? 'front' : 'rear'}`)
      || (a.type === 'trunk' && ['trunk', 'hatch_rear'].includes(entityId)),
    ).map(actionKey), attribution: pack.attribution, knowledgeRefs: ['knowledge/'],
  })),
  ...propCatalog.map((prop) => ({
    entityId: `prop:${prop.id}`, kind: 'prop', parent: null, capabilities: [...prop.capabilities],
    attribution: prop.attribution, knowledgeRefs: [] as string[],
  })),
].map((entity) => ({ packId: pack.id, ...entity }))

export const intentActions = [
  { id: 'storage', keywords: ['后备箱', '后备厢', '尾门', '储物', '装东西', '行李', '装载'],
    actions: [{ type: 'orbit', preset: 'rear_three_quarter' }, { type: 'trunk', open: true }],
    followUps: ['Ultra 的后备箱容量来源有差异吗？', '看看主驾车窗'] },
  { id: 'performance', keywords: ['性能', '零百', '加速', '动力', '赛道'],
    actions: [{ type: 'orbit', preset: 'front' }, { type: 'lights', target: 'headlight', on: true }],
    followUps: ['零百加速的测试条件是什么？', '制动距离是多少？'] },
  { id: 'window', keywords: ['车窗', '主驾', '驾驶位', '通风'],
    actions: [{ type: 'orbit', preset: 'driver_side' }, { type: 'window', target: 'driver_front', open: true, progress: 100 }],
    followUps: ['家庭储物有什么限制？'] },
] as const

export const registry = {
  schemaVersion, registryVersion, packId: pack.id, packVersion: pack.version,
  model: 'SU7 Ultra', personas: personaChapters.personas,
  cameras: Object.keys(pack.orbitActions), chapterIds: chapterPool.map((ch) => ch.id),
  actions: actions.map((action) => ({ actionId: actionKey(action), action, entityId: 'vehicle' })),
  entities: entityDefinitions,
  limits: { maxChapters: 6, minDurationMs: 1000, maxDurationMs: 120_000 },
}
