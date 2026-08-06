export type PropId = 'carry_on_20' | 'checked_24'

export type PropCatalogEntry = {
  readonly id: PropId
  readonly name: string
  readonly category: 'luggage'
  readonly description: string
  readonly modelPath: `/assets/${string}.glb`
  /** Physical outer dimensions in metres, ordered height × width × depth. */
  readonly dimensionsM: readonly [number, number, number]
  readonly previewColor: string
  readonly stagePosition: readonly [number, number, number]
  readonly stageRotation: readonly [number, number, number]
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
    description: '黑色阳极氧化铝 · 无拉链铝框 · 双排万向轮',
    modelPath: '/assets/suitcase-carry-on-20.glb',
    dimensionsM: [0.56, 0.37, 0.23],
    previewColor: '#202428',
    stagePosition: [-3.25, 0.08, 1.62],
    stageRotation: [0, -0.56, 0],
    attribution: autolaunchAttribution,
  },
  {
    id: 'checked_24',
    name: '24 寸托运行李箱',
    category: 'luggage',
    description: '银色拉丝铝 · 无拉链铝框 · 双排万向轮',
    modelPath: '/assets/suitcase-checked-24.glb',
    dimensionsM: [0.665, 0.433, 0.275],
    previewColor: '#b7bdc1',
    stagePosition: [-3.25, 0.08, 1.62],
    stageRotation: [0, -0.56, 0],
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
    if (!entry.attribution.author || !entry.attribution.source || !entry.attribution.license) errors.push(`missing attribution: ${entry.id}`)
    ids.add(entry.id)
    paths.add(entry.modelPath)
  }
  return errors
}
