export type PropId = 'carry_on_20' | 'checked_24'

export type PropCatalogEntry = {
  readonly id: PropId
  readonly name: string
  readonly category: 'luggage'
  readonly capabilities: readonly ['cargo:move', 'cargo:remove']
  readonly description: string
  readonly modelPath: `/assets/${string}.glb`
  /** Physical outer dimensions in metres, ordered height × width × depth. */
  readonly dimensionsM: readonly [number, number, number]
  /** Physical model-space support points relative to the normalized visual centre. */
  readonly groundContacts: Readonly<Record<'upright' | 'flat' | 'side', readonly (readonly [number, number, number])[]>>
  readonly previewColor: string
  readonly stagePosition: readonly [number, number, number]
  readonly stageRotation: readonly [number, number, number]
  readonly collisionBoxes: readonly {
    readonly size: readonly [number, number, number]
    readonly offset: readonly [number, number, number]
  }[]
  readonly allowedOrientations: readonly number[]
  readonly stackable: boolean
  readonly attribution: {
    readonly author: string
    readonly source: string
    readonly license: string
    readonly licenseUrl: string
  }
}

const autolaunchAttribution = {
  author: 'AutoLaunch Contributors',
  source: 'Original procedural asset',
  license: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
} as const

export const propCatalog = [
  {
    id: 'carry_on_20',
    name: '20 寸登机箱',
    category: 'luggage',
    capabilities: ['cargo:move', 'cargo:remove'],
    description: '黑色阳极氧化铝 · 无拉链铝框 · 双排万向轮',
    modelPath: '/assets/suitcase-carry-on-20.glb',
    dimensionsM: [0.56, 0.37, 0.23],
    groundContacts: {
      upright: [[-0.145, -0.28, -0.075], [-0.145, -0.28, 0.075], [0.145, -0.28, -0.075], [0.145, -0.28, 0.075]],
      flat: [[-0.15, 0, 0.094], [0.15, 0, 0.094]],
      side: [[-0.174, -0.20, 0], [-0.174, 0.20, 0]],
    },
    previewColor: '#202428',
    stagePosition: [2.84, 0.03, -0.85],
    stageRotation: [0, Math.PI / 2, 0],
    collisionBoxes: [{ size: [0.37, 0.56, 0.23], offset: [0, 0.28, 0] }],
    allowedOrientations: [0, Math.PI / 2],
    stackable: false,
    attribution: autolaunchAttribution,
  },
  {
    id: 'checked_24',
    name: '24 寸托运行李箱',
    category: 'luggage',
    capabilities: ['cargo:move', 'cargo:remove'],
    description: '银色拉丝铝 · 无拉链铝框 · 双排万向轮',
    modelPath: '/assets/suitcase-checked-24.glb',
    dimensionsM: [0.665, 0.433, 0.275],
    groundContacts: {
      upright: [[-0.17, -0.3325, -0.09], [-0.17, -0.3325, 0.09], [0.17, -0.3325, -0.09], [0.17, -0.3325, 0.09]],
      flat: [[-0.178, 0, 0.113], [0.178, 0, 0.113]],
      side: [[-0.204, -0.24, 0], [-0.204, 0.24, 0]],
    },
    previewColor: '#b7bdc1',
    stagePosition: [2.84, 0.03, -0.85],
    stageRotation: [0, Math.PI / 2, 0],
    collisionBoxes: [{ size: [0.433, 0.665, 0.275], offset: [0, 0.3325, 0] }],
    allowedOrientations: [0, Math.PI / 2],
    stackable: false,
    attribution: autolaunchAttribution,
  },
] as const satisfies readonly PropCatalogEntry[]

export function findProp(id: PropId | null): PropCatalogEntry | null {
  return propCatalog.find((entry) => entry.id === id) ?? null
}

export function toggleSelectedProp(current: PropId | null, requested: PropId): PropId | null {
  return current === requested ? null : requested
}

export function validatePropCatalog(entries: readonly PropCatalogEntry[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const paths = new Set<string>()
  for (const entry of entries) {
    if (ids.has(entry.id)) errors.push(`duplicate id: ${entry.id}`)
    if (paths.has(entry.modelPath)) errors.push(`duplicate modelPath: ${entry.modelPath}`)
    if (!/^\/assets\/[a-z0-9-]+\.glb$/.test(entry.modelPath)) errors.push(`invalid modelPath: ${entry.modelPath}`)
    if (entry.dimensionsM.some((value) => !Number.isFinite(value) || value <= 0)) errors.push(`invalid dimensions: ${entry.id}`)
    if (Object.values(entry.groundContacts).some((contacts) => !contacts.length || contacts.some((point) => point.some((value) => !Number.isFinite(value))))) errors.push(`invalid ground contacts: ${entry.id}`)
    if (!entry.collisionBoxes.length || entry.collisionBoxes.some((box) => box.size.some((value) => !Number.isFinite(value) || value <= 0))) errors.push(`invalid collision boxes: ${entry.id}`)
    if (!entry.allowedOrientations.length) errors.push(`missing orientations: ${entry.id}`)
    if (!entry.attribution.author || !entry.attribution.source || !entry.attribution.license) errors.push(`missing attribution: ${entry.id}`)
    ids.add(entry.id)
    paths.add(entry.modelPath)
  }
  return errors
}
