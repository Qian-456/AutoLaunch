export type CargoSurfaceSampler = (x: number, z: number) => number | null

let activeSampler: CargoSurfaceSampler | null = null

export function registerCargoSurfaceSampler(sampler: CargoSurfaceSampler | null) {
  activeSampler = sampler
}

export function hasCargoSurfaceSampler(): boolean {
  return activeSampler !== null
}

export function sampleCargoSurface(x: number, z: number): number | null {
  return activeSampler?.(x, z) ?? null
}
