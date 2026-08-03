import type { OrbitActionDefinition, OrbitPreset, WindowTarget } from '../types'

/**
 * Per-window action definition.
 * - When the real GLB node exists: translate the actual mesh on the configured axis.
 * - When the node is missing: VehicleModel.tsx spawns a translucent placeholder
 *   box at `virtualPosition` with size `virtualSize` so the user sees a clear
 *   window-descend animation regardless of GLB completeness.
 */
export type WindowActionDefinition = {
  durationMs: number
  /**
   * Conflict group key. Historically this was `windows` for all four panes;
   * in v0.1 we allow per-target keys so concurrent independent windows can
   * animate without cancelling each other.
   */
  conflictGroup: string
  /** Translation axis applied to the real node. */
  axis: 'Y' | 'X' | 'Z'
  /** Offset at 0% (closed). Relative to the node's baked position. */
  closedOffset: number
  /** Offset at 100% (fully open). Relative to the node's baked position. */
  openOffset: number
  reversible: true
  /** Fallback virtual-mesh window spec used when nodeMap lookup fails. */
  virtualWindow: {
    /** Position of the placeholder mesh inside vehicleRoot (world/meters after scale). */
    position: readonly [number, number, number]
    /** Size of the placeholder mesh in meters. */
    size: readonly [number, number, number]
    /** Rotation euler (radians) for the placeholder mesh. */
    rotation?: readonly [number, number, number]
    /** Hex tint of the translucent glass. */
    glassColor: string
    /** Per-axis offset the placeholder descends at 100% progress (meters). */
    descendOffset: readonly [number, number, number]
  }
}

/** Rear hatch assembled from registered GLB parts under one hinge pivot. */
export type HatchActionDefinition = {
  durationMs: number
  conflictGroup: 'rear'
  /** Pivot axis in the original GLB coordinate system. */
  hingeAxis: 'X'
  /**
   * Location of the hinge line in unscaled GLB-local coordinates.
   */
  hingePosition: readonly [number, number, number]
  /** Rotation (radians) around `hingeAxis` when the hatch is fully closed. */
  closedRotation: number
  /** Rotation (radians) around `hingeAxis` when the hatch is fully open. */
  openRotation: number
  reversible: true
  /** Semantic node-map IDs which together form the moving tailgate. */
  movingNodeIds: readonly [
    'trunk_outer_upper',
    'trunk_outer_lip',
    'trunk_inner_liner',
    'trunk_spoiler_base',
    'trunk_spoiler',
    'trunk_spoiler_support',
    'trunk_taillight_lens',
    'trunk_taillight_housing',
    'trunk_taillight_emitter',
  ]
}

export const su7ConceptPack = {
  id: 'su7-ultra-concept',
  version: '0.1.0',
  model: {
    path: '/assets/su7_ultra.glb',
    scale: 100,
    rotation: [0, -Math.PI / 2, 0] as const,
    position: [0, 0, 0] as const,
  },
  attribution: {
    author: 'Ddiaz Design',
    source: 'Sketchfab',
    sourceUrl: 'https://skfb.ly/pKv9Z',
    license: 'CC BY-NC-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },
  nodeMap: {
    body: 'CarPaint1',
    window_driver_front: 'XiaomicarGlass_front_2_Side_1_carGlass_front_2_Side_1_Car_glass',
    window_passenger_front: 'XiaomicarGlass_front_2_Side_2_carGlass_front_2_Side_2_Car_glass',
    window_driver_rear: 'XiaomicarGlass_back_2_Side_2_carGlass_back_2_Side_2_Car_glass',
    window_passenger_rear: 'XiaomicarGlass_back_2_Side_1_carGlass_back_2_Side_1_Car_glass',
    trunk: 'XiaomicarPaint_8_carPaint_8_pasted__lambert222_001',
    trunk_outer_upper: 'XiaomicarPaint_8_carPaint_8_pasted__lambert222_001',
    trunk_outer_lip: 'XiaomicarPaint_2_carPaint_2_pasted__lambert222_001',
    trunk_inner_liner: 'XiaomicarPlastic_MatteBlack_trunk_7_carPlastic_MatteBlack_trunk_7_lambert225',
    trunk_spoiler_base: 'XiaomicarSpoilers_carSpoilers_lambert229_001',
    trunk_spoiler: 'spoiler',
    trunk_spoiler_support: 'XiaomicarTailBracket_carTailBracket_Material_#49',
    trunk_taillight_lens: 'XiaomicarLightGlass_Back_2_carLightGlass_Back_2_lambert210',
    trunk_taillight_housing: 'XiaomicarLightPlastic_BrilliantBlack_2_carLightPlastic_BrilliantBlack_2_lambert230',
    trunk_taillight_emitter: 'XiaomicarLight_bulb_2_carLight_bulb_2_blinn25',
    headlight_left: 'XiaomicarLightGlass_Front_carLightGlass_Front_Car_glass',
    headlight_right: 'XiaomicarLightGlass_Front_1__carLightGlass_Front_001_Car_glass',
    taillight_left: 'XiaomicarLightGlass_Back_1_carLightGlass_Back_1_lambert210',
    taillight_right: 'XiaomicarLightGlass_Back_2_carLightGlass_Back_2_lambert210',
    front_logo_base: 'XiaomicarLogoBase_body_carLogoBase_body_lambert241',
    front_logo_mark: 'XiaomicarLogoFont_Golden_body_carLogoFont_Golden_body_lambert240',
    trim_front_silver: 'XiaomicarPlastic_BrilliantGray_1_carPlastic_BrilliantGray_1_Material #49_001',
    trim_side_silver: 'XiaomicarFlankMesh_carFlankMesh_lambert229_001',
    trim_rear_silver: 'XiaomicarPlastic_BrilliantGray_2_carPlastic_BrilliantGray_2_Material #49',
    trim_rear_silver_center: 'XiaomicarMetal_Silver_carMetal_Silver_Material #49_001',
    rear_badges: 'XiaomicarXiaoMi_1_carXiaoMi_1_lambert227',
    mirror_left_top: 'XiaomicarMirror_top_1_carMirror_top_1_lambert222',
    mirror_left_bottom: 'XiaomicarMirror_bottom_1_carMirror_bottom_1_lambert222',
    mirror_left_glass: 'XiaomicarRearviewMirror_1_carRearviewMirror_1_Car paint',
    mirror_right_top: 'XiaomicarMirror_top_2_carMirror_top_2_pasted__lambert222_001',
    mirror_right_bottom: 'XiaomicarMirror_bottom_2_carMirror_bottom_2_lambert222',
    mirror_right_glass: 'XiaomicarRearviewMirror_2_carRearviewMirror_2_Car paint',
    rear_body_upper: 'XiaomicarPaint_8_carPaint_8_pasted__lambert222_001',
    rear_body_lip: 'XiaomicarPaint_2_carPaint_2_pasted__lambert222_001',
    taillight_rear_housing: 'XiaomicarLightPlastic_BrilliantBlack_2_carLightPlastic_BrilliantBlack_2_lambert230',
  },
  actions: {
    window_driver_front: {
      durationMs: 900,
      conflictGroup: 'window_driver_front',
      axis: 'Y',
      closedOffset: 0,
      /**
       * Increased from the previous 0.0038m. At model scale=100 this pushes the
       * real mesh down by ~35cm inside the door pocket, so the user clearly sees
       * the glass disappearing.
       */
      openOffset: -0.35,
      reversible: true,
      virtualWindow: {
        position: [-0.30, 1.30, -1.15] as const,
        size: [0.02, 0.58, 0.95] as const,
        rotation: [0, 0, 0] as const,
        glassColor: '#0a141f',
        descendOffset: [0, -0.55, 0] as const,
      },
    } satisfies WindowActionDefinition,
    window_passenger_front: {
      durationMs: 900,
      conflictGroup: 'window_passenger_front',
      axis: 'Y',
      closedOffset: 0,
      openOffset: -0.35,
      reversible: true,
      virtualWindow: {
        position: [-0.30, 1.30, 1.15] as const,
        size: [0.02, 0.58, 0.95] as const,
        rotation: [0, 0, 0] as const,
        glassColor: '#0a141f',
        descendOffset: [0, -0.55, 0] as const,
      },
    } satisfies WindowActionDefinition,
    window_driver_rear: {
      durationMs: 850,
      conflictGroup: 'window_driver_rear',
      axis: 'Y',
      closedOffset: 0,
      openOffset: -0.30,
      reversible: true,
      virtualWindow: {
        position: [0.55, 1.28, -1.10] as const,
        size: [0.02, 0.48, 0.80] as const,
        rotation: [0, 0, 0] as const,
        glassColor: '#0a141f',
        descendOffset: [0, -0.46, 0] as const,
      },
    } satisfies WindowActionDefinition,
    window_passenger_rear: {
      durationMs: 850,
      conflictGroup: 'window_passenger_rear',
      axis: 'Y',
      closedOffset: 0,
      openOffset: -0.30,
      reversible: true,
      virtualWindow: {
        position: [0.55, 1.28, 1.10] as const,
        size: [0.02, 0.48, 0.80] as const,
        rotation: [0, 0, 0] as const,
        glassColor: '#0a141f',
        descendOffset: [0, -0.46, 0] as const,
      },
    } satisfies WindowActionDefinition,
    /**
     * Real rear hatch assembled from body, liner, spoiler and centre-lamp parts.
     * The original GLB already separates the required moving subassemblies.
     * The Product Pack lists every exported node that must follow the hinge.
     * The rear glass and outer lamp sections deliberately remain body-fixed.
     */
    hatch_rear: {
      durationMs: 1650,
      conflictGroup: 'rear',
      hingeAxis: 'X',
      /** GLB-local hinge at the front edge of the rear deck lid. */
      hingePosition: [0, 0.01118, -0.01878] as const,
      /** In GLB space the rear extends toward -Z; positive X rotation lifts it. */
      closedRotation: 0,
      /** Open pose ≈ 66° rotation rear-end up from the closed pose. */
      openRotation: 1.15,
      reversible: true,
      movingNodeIds: [
        'trunk_outer_upper',
        'trunk_outer_lip',
        'trunk_inner_liner',
        'trunk_spoiler_base',
        'trunk_spoiler',
        'trunk_spoiler_support',
        'trunk_taillight_lens',
        'trunk_taillight_housing',
        'trunk_taillight_emitter',
      ] as const,
    } satisfies HatchActionDefinition,
    trunk: {
      durationMs: 1200,
      conflictGroup: 'rear',
      mode: 'real-mesh',
      fallbackCamera: 'rear_three_quarter',
      visualLift: 0.05,
      reversible: true,
      /** Legacy action alias; the runtime forwards it to the real hatch rig. */
      note: 'Legacy alias: runtime forwards trunk actions to the real multi-mesh rear hatch animation.',
    },
    lights_headlight: {
      durationMs: 420,
      conflictGroup: 'lights_front',
      color: '#cce7ff',
      emissiveIntensity: [0, 5] as const,
      lensEmissiveIntensity: [0, 0.65] as const,
      emissiveNodes: [
        'XiaomicarLightPlastic_Chroming_1_1__carLightPlastic_Chroming_1_001_lambert230_Light_Chroaming_0',
        'XiaomicarLightPlastic_Chroming_2_1__carLightPlastic_Chroming_2_001_lambert230_Light_Chroaming_0',
        'XiaomicarLightPlastic_Chroming_1_carLightPlastic_Chroming_1_lambert230_Light_Chroaming_0',
        'XiaomicarLightPlastic_Chroming_2_carLightPlastic_Chroming_2_lambert230_Light_Chroaming_0',
      ],
      environmentLights: [
        {
          position: [-2.18, 0.72, -0.72] as const,
          target: [-4.6, 0.04, -0.88] as const,
          intensity: 420,
          distance: 8,
          angle: 0.38,
          penumbra: 0.78,
          decay: 2,
        },
        {
          position: [-2.18, 0.72, 0.72] as const,
          target: [-4.6, 0.04, 0.88] as const,
          intensity: 420,
          distance: 8,
          angle: 0.38,
          penumbra: 0.78,
          decay: 2,
        },
      ],
    },
    lights_taillight: {
      durationMs: 420,
      conflictGroup: 'lights_rear',
      color: '#ff0038',
      emissiveIntensity: [0, 2.2] as const,
      lensEmissiveIntensity: [0, 0.28] as const,
      emissiveNodes: [] as readonly string[],
      environmentLights: [
        {
          position: [2.22, 0.82, -0.66] as const,
          target: [4.25, 0.06, -0.75] as const,
          intensity: 110,
          distance: 4.2,
          angle: 0.42,
          penumbra: 0.82,
          decay: 2,
        },
        {
          position: [2.22, 0.82, 0.66] as const,
          target: [4.25, 0.06, 0.75] as const,
          intensity: 110,
          distance: 4.2,
          angle: 0.42,
          penumbra: 0.82,
          decay: 2,
        },
      ],
    },
  },
  appearance: {
    hiddenNodes: [
      'XiaomicarPlate_carPlate_aaa_Details_0',
      'Xiaomiempennage_img_empennage_img_lambert46_Details_0',
    ],
    materialOverrides: [
      { material: 'RIM_1', color: '#070809', metalness: 0.88, roughness: 0.24, removeColorMap: true },
      { material: 'Color_rim', color: '#070809', metalness: 0.88, roughness: 0.24, removeColorMap: true },
      { material: 'tire', color: '#08090a', metalness: 0.02, roughness: 0.82, removeColorMap: true },
      { material: 'Roof', color: '#080a0d', metalness: 0.04, roughness: 0.52, removeColorMap: true },
      { material: 'Roof_Glass', color: '#090b0e', metalness: 0.15, roughness: 0.18, removeColorMap: true },
      {
        material: 'CarPaint',
        color: '#ffffff',
        metalness: 0.38,
        roughness: 0.36,
        removeColorMap: false,
        note: 'The Ddiaz GLB embeds the intended yellow paint, center silver stripes, side stripes and Ultra wordmarks in CarPaint.baseColorTexture; keep the original map and use a neutral white tint.',
      },
      { material: 'Windows', color: '#020305', metalness: 0.0, roughness: 0.2, removeColorMap: true },
      { material: 'Brilliant_Black', color: '#050608', metalness: 0.04, roughness: 0.56, removeColorMap: true },
      { material: 'BrilliantGray', color: '#050608', metalness: 0.04, roughness: 0.6, removeColorMap: true },
      { material: 'Brilliant_Silver', color: '#050608', metalness: 0.04, roughness: 0.6, removeColorMap: true },
    ],
    nodeOverrides: [
      {
        semanticId: 'front_logo_base',
        node: 'XiaomicarLogoBase_body_carLogoBase_body_lambert241_Matte_Black_0',
        color: '#050607',
        metalness: 0.12,
        roughness: 0.42,
      },
      {
        semanticId: 'front_logo_mark',
        node: 'XiaomicarLogoFont_Golden_body_carLogoFont_Golden_body_lambert240_CHROME_Logo_0',
        color: '#e7e9ea',
        metalness: 0.46,
        roughness: 0.26,
      },
      {
        semanticId: 'trim_front_silver',
        node: 'XiaomicarPlastic_BrilliantGray_1_carPlastic_BrilliantGray_1_Material #49_001_BrilliantGray_0',
        color: '#a8aaab',
        metalness: 0.58,
        roughness: 0.38,
      },
      {
        semanticId: 'trim_side_silver',
        node: 'XiaomicarFlankMesh_carFlankMesh_lambert229_001_Roof_0',
        color: '#92979a',
        metalness: 0.42,
        roughness: 0.46,
      },
      {
        semanticId: 'trim_rear_silver',
        node: 'XiaomicarPlastic_BrilliantGray_2_carPlastic_BrilliantGray_2_Material #49_BrilliantGray_0',
        color: '#a8aaab',
        metalness: 0.58,
        roughness: 0.38,
      },
      {
        semanticId: 'trim_rear_silver_center',
        node: 'XiaomicarMetal_Silver_carMetal_Silver_Material #49_001_Brilliant_Silver_0',
        color: '#b2b4b5',
        metalness: 0.65,
        roughness: 0.34,
      },
      {
        semanticId: 'brake_disc_rear',
        node: 'XiaomicarBrakeDisc_Back_carBrakeDisc_Back_lambert218_Break_Disk_0',
        color: '#15181b',
        metalness: 0.7,
        roughness: 0.5,
      },
      {
        semanticId: 'brake_disc_front',
        node: 'XiaomicarBrakeDisc_Front_carBrakeDisc_Front_lambert218_Break_Disk_0',
        color: '#15181b',
        metalness: 0.7,
        roughness: 0.5,
      },
      {
        semanticId: 'brake_calipers',
        node: 'XiaomicarCaliper_1_carCaliper_1_LunPanKaQian_low_1_Caliper_0',
        color: '#e0b600',
        metalness: 0.28,
        roughness: 0.42,
      },
      {
        semanticId: 'brake_caliper_letters',
        node: 'XiaomicarCaliper_2_carCaliper_2_ZiMu_low_1_Brilliant_B2_0',
        color: '#111315',
        metalness: 0.1,
        roughness: 0.58,
      },
      {
        semanticId: 'rear_badges',
        node: 'XiaomicarXiaoMi_1_carXiaoMi_1_lambert227_CHROME_Logo_0',
        color: '#090a0b',
        metalness: 0.12,
        roughness: 0.52,
      },
      {
        semanticId: 'mirror_left_top',
        node: 'XiaomicarMirror_top_1_carMirror_top_1_lambert222_CarPaint_0',
        color: '#030405',
        metalness: 0.08,
        roughness: 0.42,
      },
      {
        semanticId: 'mirror_left_bottom',
        node: 'XiaomicarMirror_bottom_1_carMirror_bottom_1_lambert222_CarPaint_0',
        color: '#030405',
        metalness: 0.08,
        roughness: 0.46,
      },
      {
        semanticId: 'mirror_left_glass',
        node: 'XiaomicarRearviewMirror_1_carRearviewMirror_1_Car paint_CHROME_Logo_0',
        color: '#050607',
        metalness: 0.24,
        roughness: 0.2,
      },
      {
        semanticId: 'mirror_right_top',
        node: 'XiaomicarMirror_top_2_carMirror_top_2_pasted__lambert222_001_CarPaint_0',
        color: '#030405',
        metalness: 0.08,
        roughness: 0.42,
      },
      {
        semanticId: 'mirror_right_bottom',
        node: 'XiaomicarMirror_bottom_2_carMirror_bottom_2_lambert222_CarPaint_0',
        color: '#030405',
        metalness: 0.08,
        roughness: 0.46,
      },
      {
        semanticId: 'mirror_right_glass',
        node: 'XiaomicarRearviewMirror_2_carRearviewMirror_2_Car paint_CHROME_Logo_0',
        color: '#050607',
        metalness: 0.24,
        roughness: 0.2,
      },
      {
        semanticId: 'taillight_left_dark',
        node: 'XiaomicarLightGlass_Back_1_carLightGlass_Back_1_lambert210_D_Glass_0',
        color: '#05070a',
        metalness: 0.02,
        roughness: 0.72,
        envMapIntensity: 0.05,
      },
      {
        semanticId: 'taillight_right_dark',
        node: 'XiaomicarLightGlass_Back_2_carLightGlass_Back_2_lambert210_D_Glass_0',
        color: '#05070a',
        metalness: 0.02,
        roughness: 0.72,
        envMapIntensity: 0.05,
      },
      {
        semanticId: 'taillight_rear_housing_dark',
        node: 'XiaomicarLightPlastic_BrilliantBlack_2_carLightPlastic_BrilliantBlack_2_lambert230_Plastic_Light_0',
        color: '#020304',
        metalness: 0,
        roughness: 0.9,
        envMapIntensity: 0,
        removeAllMaps: true,
      },
      {
        semanticId: 'rear_body_upper',
        node: 'XiaomicarPaint_8_carPaint_8_pasted__lambert222_001_CarPaint_0',
        color: '#f0c400',
        metalness: 0.2,
        roughness: 0.48,
      },
      {
        semanticId: 'rear_body_lip',
        node: 'XiaomicarPaint_2_carPaint_2_pasted__lambert222_001_CarPaint_0',
        color: '#f0c400',
        metalness: 0.2,
        roughness: 0.48,
      },
    ],
    colorMapRestores: [
      {
        semanticId: 'trim_side_silver_decal',
        nodes: [
          'XiaomicarFlankLogo_carFlankLogo_blinn11_CarPaint_0',
        ],
        color: '#ffffff',
        metalness: 0.38,
        roughness: 0.36,
        note: 'Only the native flank-logo mesh retains CarPaint_Decal, producing the long silver stripe and Ultra wordmark without leaking gray UV areas onto the door handles.',
      },
    ],
    lightingExperiments: [
      {
        id: 'taillight-red-preview',
        enabled: false,
        note: '暂不应用。后续灯光系统可将左右尾灯作为同一 lights_rear 冲突组管理。',
        node: 'XiaomicarLightGlass_Back_1_carLightGlass_Back_1_lambert210_D_Glass_0',
        color: '#d90b37',
        emissive: '#c9002f',
        emissiveIntensity: 0.8,
        metalness: 0.05,
        roughness: 0.2,
        removeColorMap: true,
      },
      {
        id: 'taillight-red-preview-right',
        enabled: false,
        note: '与左尾灯保持相同曲线；建议由 lights:taillight:on/off 统一驱动。',
        node: 'XiaomicarLightGlass_Back_2_carLightGlass_Back_2_lambert210_D_Glass_0',
        color: '#d90b37',
        emissive: '#c9002f',
        emissiveIntensity: 0.8,
        metalness: 0.05,
        roughness: 0.2,
        removeColorMap: true,
      },
    ],
    plates: [
      {
        id: 'front',
        text: 'SU7 Ultra',
        position: [-2.525, 0.505, 0] as const,
        rotation: [0, -Math.PI / 2, 0] as const,
        size: [0.52, 0.18] as const,
        background: '#f1f1ec',
        foreground: '#111214',
      },
      {
        id: 'rear',
        text: 'SU7 Ultra',
        position: [2.455, 0.505, 0] as const,
        rotation: [0, Math.PI / 2, 0] as const,
        size: [0.52, 0.18] as const,
        background: '#17191c',
        foreground: '#c9c9c4',
      },
    ],
  },
  orbitActions: {
    hero_front_left: {
      position: [-6.25, 2.25, 4.6],
      target: [0, 0.72, 0],
      transitionMs: 450,
    },
    front: {
      position: [-7.2, 1.65, 0],
      target: [0, 0.72, 0],
      transitionMs: 450,
    },
    driver_side: {
      position: [0, 1.7, -7.1],
      target: [0, 0.72, 0],
      transitionMs: 450,
    },
    rear_three_quarter: {
      position: [6.1, 2.15, -4.8],
      target: [0, 0.72, 0],
      transitionMs: 450,
    },
    turntable: {
      position: [-5.8, 2.15, 5.8],
      target: [0, 0.72, 0],
      transitionMs: 450,
      autoRotate: true,
      autoRotateSpeed: 2.25,
    },
  } satisfies Record<OrbitPreset, OrbitActionDefinition>,
} as const

export type Su7ConceptPack = typeof su7ConceptPack

/**
 * Ordered list of per-window semantic IDs for the four physical windows.
 * 'all' commands iterate this array and issue one action per entry.
 */
export const WINDOW_TARGETS: Exclude<WindowTarget, 'all'>[] = [
  'driver_front',
  'passenger_front',
  'driver_rear',
  'passenger_rear',
] as const

/** Human-readable label for each window target, used by UI feedback + tests. */
export const WINDOW_LABELS: Record<Exclude<WindowTarget, 'all'>, string> = {
  driver_front: '主驾车窗',
  passenger_front: '副驾车窗',
  driver_rear: '主驾后车窗',
  passenger_rear: '副驾后车窗',
} as const
