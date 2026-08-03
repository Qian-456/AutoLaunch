import { create } from 'zustand'
import type { OrbitPreset } from '../types'

type ExperienceState = {
  cameraControlOwner: 'script' | 'orbit'
  activeOrbitPreset: OrbitPreset
  orbitRequestId: number
  manualOrbit: boolean
  modelStatus: 'loading' | 'ready' | 'error'
  notice: string | null
  requestOrbit: (preset: OrbitPreset) => void
  beginManualOrbit: () => void
  setModelStatus: (status: ExperienceState['modelStatus']) => void
  setNotice: (notice: string | null) => void
}

export const useExperienceStore = create<ExperienceState>((set) => ({
  cameraControlOwner: 'orbit',
  activeOrbitPreset: 'hero_front_left',
  orbitRequestId: 0,
  manualOrbit: false,
  modelStatus: 'loading',
  notice: null,
  requestOrbit: (preset) => set((state) => ({
    cameraControlOwner: 'orbit',
    activeOrbitPreset: preset,
    orbitRequestId: state.orbitRequestId + 1,
    manualOrbit: false,
    notice: preset === 'turntable' ? '已启动 360° 展台环绕' : null,
  })),
  beginManualOrbit: () => set({
    cameraControlOwner: 'orbit',
    manualOrbit: true,
    notice: '已切换为手动环绕；不会自动恢复镜头',
  }),
  setModelStatus: (modelStatus) => set({ modelStatus }),
  setNotice: (notice) => set({ notice }),
}))
