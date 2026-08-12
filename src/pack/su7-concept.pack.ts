import type { CargoAnchorId, CargoLayoutId, DoorTarget, LaunchChapter, OrbitActionDefinition, OrbitPreset, WindowTarget } from '../types'
import type { PropId } from '../props/prop-catalog'

type ConcreteDoorTarget = Exclude<DoorTarget, 'all'>

const degreesToRadians = (degrees: number) => degrees * Math.PI / 180
const configuredAngle = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? degreesToRadians(parsed) : degreesToRadians(fallback)
}

export const PARTS_VIRTUAL_HINT = import.meta.env.VITE_PARTS_VIRTUAL_HINT
  || '⚠ 当前演示模型部分开合节点暂未映射，已使用虚拟占位演示；v0.3 后续迭代将接入真实部件 Mesh。'
const DEFAULT_FRUNK_OPEN_ANGLE = configuredAngle(import.meta.env.VITE_PARTS_DEFAULT_OPEN_ANGLE_FRUNK, 55)
const DEFAULT_DOOR_OPEN_ANGLE = configuredAngle(import.meta.env.VITE_PARTS_DEFAULT_OPEN_ANGLE_DOOR, 63)

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
  conflictGroup: 'rear' | 'front_hatch'
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
  movingNodeIds: readonly string[]
  virtualHatch?: {
    position: readonly [number, number, number]
    size: readonly [number, number, number]
    rotation: readonly [number, number, number]
    hingeOffset: readonly [number, number, number]
    openAngle: number
    color: string
  }
}

export type DoorActionDefinition = {
  durationMs: number
  conflictGroup: string
  hingeAxis: 'Y'
  hingePosition: readonly [number, number, number]
  closedRotation: number
  openRotation: number
  reversible: true
  movingNodeIds: readonly string[]
  virtualDoor: {
    position: readonly [number, number, number]
    size: readonly [number, number, number]
    rotation: readonly [number, number, number]
    hingeSideOffset: readonly [number, number, number]
    openAngle: number
    outerColor: string
    innerColor: string
  }
}

export const DOOR_TARGETS: readonly ConcreteDoorTarget[] = [
  'driver_front', 'passenger_front', 'driver_rear', 'passenger_rear',
]

export const DOOR_LABELS: Record<ConcreteDoorTarget, string> = {
  driver_front: '主驾车门',
  passenger_front: '副驾车门',
  driver_rear: '主驾后车门',
  passenger_rear: '副驾后车门',
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
  cargoVolume: {
    /**
     * Closed low-poly cargo proxy in vehicleRoot metre space. Each horizontal ring
     * has the same vertex count so the runtime can render a watertight collider and
     * interpolate the usable boundary at any height. The indents model wheel arches;
     * upper rings model the side/roof taper.
     */
    floorY: 0.735,
    /** Calibrated proxies for fixed, unnamed cargo-trim meshes in the source GLB. */
    supportTolerance: 0.012,
    supportSurfaces: [
      {
        id: 'cargo_carpet_main',
        height: 0.735,
        polygon: [[1.49, -0.40], [1.66, -0.40], [1.72, -0.53], [2.18, -0.53], [2.34, -0.39], [2.34, 0.39], [2.18, 0.53], [1.72, 0.53], [1.66, 0.40], [1.49, 0.40]],
      },
    ],
    interiorObstacles: [
      { id: 'seat_back', center: [1.43, 1.02, 0], halfSize: [0.055, 0.27, 0.43] },
      { id: 'wheel_arch_left', center: [1.92, 0.87, -0.56], halfSize: [0.34, 0.13, 0.06] },
      { id: 'wheel_arch_right', center: [1.92, 0.87, 0.56], halfSize: [0.34, 0.13, 0.06] },
      { id: 'rear_sill', center: [2.39, 0.81, 0], halfSize: [0.055, 0.075, 0.43] },
    ],
    /** Piecewise closed-hatch inner envelope; avoids the over-broad legacy box. */
    hatchSweepSections: [
      { id: 'hatch_lower_lip', center: [2.31, 1.115, 0], halfSize: [0.09, 0.075, 0.43] },
      { id: 'hatch_mid_liner', center: [2.24, 1.245, 0], halfSize: [0.13, 0.085, 0.42] },
      { id: 'hatch_upper_liner', center: [2.10, 1.37, 0], halfSize: [0.18, 0.08, 0.38] },
    ],
    collider: {
      id: 'su7_cargo_volume_proxy_v1',
      sections: [
        { y: 0.735, polygon: [[1.46, -0.43], [1.63, -0.43], [1.70, -0.58], [2.22, -0.58], [2.40, -0.43], [2.40, 0.43], [2.22, 0.58], [1.70, 0.58], [1.63, 0.43], [1.46, 0.43]] },
        { y: 1.10, polygon: [[1.48, -0.42], [1.65, -0.42], [1.72, -0.55], [2.19, -0.55], [2.36, -0.41], [2.36, 0.41], [2.19, 0.55], [1.72, 0.55], [1.65, 0.42], [1.48, 0.42]] },
        { y: 1.42, polygon: [[1.52, -0.35], [1.68, -0.35], [1.75, -0.47], [2.12, -0.47], [2.27, -0.35], [2.27, 0.35], [2.12, 0.47], [1.75, 0.47], [1.68, 0.35], [1.52, 0.35]] },
      ],
      color: '#25e6c2',
      /** Rendering safety ceiling; physical capacity is decided by the solver. */
      maxInstances: 12,
      snapDistance: 0.05,
      snapGap: 0.005,
    },
    floorPolygon: [[1.46, -0.43], [1.63, -0.43], [1.70, -0.58], [2.22, -0.58], [2.40, -0.43], [2.40, 0.43], [2.22, 0.58], [1.70, 0.58], [1.63, 0.43], [1.46, 0.43]] as const,
    opening: { width: 1.08, height: 0.66 },
    maxHeight: 0.66,
    searchRadius: 0.24,
    searchStep: 0.06,
    anchors: {
      rear_left: { position: [1.85, 0.735, -0.23], rotationX: Math.PI / 2, rotationY: Math.PI / 2 },
      rear_right: { position: [1.85, 0.735, 0.23], rotationX: Math.PI / 2, rotationY: Math.PI / 2 },
      front_center: { position: [1.62, 0.735, 0], rotationX: Math.PI / 2, rotationY: Math.PI / 2 },
    } satisfies Record<CargoAnchorId, { position: readonly [number, number, number]; rotationX: number; rotationY: number }>,
    layouts: {
      two_suitcases: {
        placements: {
          checked_24: { anchorId: 'rear_left', position: [1.49, 1.0925, -0.29], rotationX: 0, rotationY: Math.PI / 2 },
          carry_on_20: { anchorId: 'rear_right', position: [1.49, 1.04, 0.25], rotationX: 0, rotationY: Math.PI / 2 },
        },
      },
    } satisfies Record<CargoLayoutId, {
      placements: Partial<Record<PropId, { anchorId: CargoAnchorId; position: readonly [number, number, number]; rotationX: number; rotationY: number }>>
    }>,
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
    window_driver_front: 'XiaomicarGlass_front_2_Side_2_carGlass_front_2_Side_2_Car_glass',
    window_passenger_front: 'XiaomicarGlass_front_2_Side_1_carGlass_front_2_Side_1_Car_glass',
    window_driver_rear: 'XiaomicarGlass_back_2_Side_1_carGlass_back_2_Side_1_Car_glass',
    window_passenger_rear: 'XiaomicarGlass_back_2_Side_2_carGlass_back_2_Side_2_Car_glass',
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
    hatch_front_bonnet_net: 'XiaomicarFrontBonnetNet_carFrontBonnetNet_blinn10',
    hatch_front_outer: 'XiaomicarPaint_3_1_carPaint_3_1_pasted__lambert222_001',
    door_driver_front_inner: 'XiaomicarInternal_DoorFront_carInternal_DoorFront_lambert2_001',
    door_passenger_front_inner: 'XiaomicarInternal_DoorFront_1__carInternal_DoorFront_001_lambert2_001',
    door_driver_rear_inner: 'XiaomicarInternal_DoorBack_carInternal_DoorBack_lambert2_001',
    door_passenger_rear_inner: 'XiaomicarInternal_DoorBack_1__carInternal_DoorBack_001_lambert2_001',
    door_driver_front_outer: 'XiaomicarPaint_4_carPaint_4_pasted__lambert222_001',
    door_passenger_front_outer: 'XiaomicarPaint_6_carPaint_6_pasted__lambert222_001',
    door_driver_rear_outer: 'XiaomicarPaint_5_carPaint_5_pasted__lambert222_001',
    door_passenger_rear_outer: 'XiaomicarPaint_7_carPaint_7_pasted__lambert222_001',
    door_driver_front_window_trim: 'XiaomicarWindowTrim_1_carWindowTrim_1_Material_#49',
    door_passenger_front_window_trim: 'XiaomicarWindowTrim_3_carWindowTrim_3_Material_#49',
    door_driver_rear_window_trim: 'XiaomicarWindowTrim_2_carWindowTrim_2_Material_#49',
    door_passenger_rear_window_trim: 'XiaomicarWindowTrim_4_carWindowTrim_4_Material_#49',
    door_driver_front_corner_trim: 'XiaomicarPlastic_BrilliantBlack_1_6_carPlastic_BrilliantBlack_1_6_Material_#49',
    door_passenger_front_corner_trim: 'XiaomicarPlastic_BrilliantBlack_1_7_carPlastic_BrilliantBlack_1_7_Material_#49',
    door_driver_front_mirror_top: 'XiaomicarMirror_top_2_carMirror_top_2_pasted__lambert222_001',
    door_driver_front_mirror_bottom: 'XiaomicarMirror_bottom_2_carMirror_bottom_2_lambert222',
    door_driver_front_mirror_glass: 'XiaomicarRearviewMirror_2_carRearviewMirror_2_Car_paint',
    door_driver_front_mirror_base: 'XiaomicarPlastic_BrilliantBlack_3_2_carPlastic_BrilliantBlack_3_2_Material_#49',
    door_passenger_front_mirror_top: 'XiaomicarMirror_top_1_carMirror_top_1_lambert222',
    door_passenger_front_mirror_bottom: 'XiaomicarMirror_bottom_1_carMirror_bottom_1_lambert222',
    door_passenger_front_mirror_glass: 'XiaomicarRearviewMirror_1_carRearviewMirror_1_Car_paint',
    door_passenger_front_mirror_base: 'XiaomicarPlastic_BrilliantBlack_3_1_carPlastic_BrilliantBlack_3_1_Material_#49',
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
        'rear_badges',
        'trunk_spoiler_base',
        'trunk_spoiler',
        'trunk_spoiler_support',
        'trunk_taillight_lens',
        'trunk_taillight_housing',
        'trunk_taillight_emitter',
      ] as const,
    } satisfies HatchActionDefinition,
    hatch_front: {
      durationMs: 1650,
      conflictGroup: 'front_hatch',
      hingeAxis: 'X',
      // The bonnet pivots at its rear edge beside the windscreen. Using the
      // nose-side bound here makes the real skin appear to slide forward.
      hingePosition: [0, 0.0088, 0.01066] as const,
      closedRotation: 0,
      openRotation: -DEFAULT_FRUNK_OPEN_ANGLE,
      reversible: true,
      movingNodeIds: ['hatch_front_outer', 'front_logo_base', 'front_logo_mark'] as const,
      virtualHatch: {
        position: [-1.48, 0.82, 0] as const,
        size: [1.55, 0.06, 1.90] as const,
        rotation: [0, 0, 0] as const,
        hingeOffset: [0.72, 0, 0] as const,
        openAngle: -DEFAULT_FRUNK_OPEN_ANGLE,
        color: '#0a1015',
      },
    } satisfies HatchActionDefinition,
    door_driver_front: {
      durationMs: 1700, conflictGroup: 'door_driver_front', hingeAxis: 'Y',
      hingePosition: [0.0084, 0.0065, 0.0094] as const, closedRotation: 0, openRotation: -DEFAULT_DOOR_OPEN_ANGLE,
      reversible: true, movingNodeIds: [
        'door_driver_front_outer', 'door_driver_front_inner', 'window_driver_front',
        'door_driver_front_window_trim', 'door_driver_front_corner_trim',
        'door_driver_front_mirror_top', 'door_driver_front_mirror_bottom',
        'door_driver_front_mirror_glass', 'door_driver_front_mirror_base',
      ] as const,
      virtualDoor: { position: [-0.25, 0.80, -1.02] as const, size: [1.05, 1.30, 0.08] as const, rotation: [0, 0, 0] as const, hingeSideOffset: [-0.52, 0, 0] as const, openAngle: DEFAULT_DOOR_OPEN_ANGLE, outerColor: '#0b1016', innerColor: '#1a1f24' },
    } satisfies DoorActionDefinition,
    door_passenger_front: {
      durationMs: 1700, conflictGroup: 'door_passenger_front', hingeAxis: 'Y',
      hingePosition: [-0.0084, 0.0065, 0.0094] as const, closedRotation: 0, openRotation: DEFAULT_DOOR_OPEN_ANGLE,
      reversible: true, movingNodeIds: [
        'door_passenger_front_outer', 'door_passenger_front_inner', 'window_passenger_front',
        'door_passenger_front_window_trim', 'door_passenger_front_corner_trim',
        'door_passenger_front_mirror_top', 'door_passenger_front_mirror_bottom',
        'door_passenger_front_mirror_glass', 'door_passenger_front_mirror_base',
      ] as const,
      virtualDoor: { position: [-0.25, 0.80, 1.02] as const, size: [1.05, 1.30, 0.08] as const, rotation: [0, 0, 0] as const, hingeSideOffset: [-0.52, 0, 0] as const, openAngle: -DEFAULT_DOOR_OPEN_ANGLE, outerColor: '#0b1016', innerColor: '#1a1f24' },
    } satisfies DoorActionDefinition,
    door_driver_rear: {
      durationMs: 1650, conflictGroup: 'door_driver_rear', hingeAxis: 'Y',
      hingePosition: [0.0085, 0.0067, -0.0017] as const, closedRotation: 0, openRotation: -1.0,
      reversible: true, movingNodeIds: ['door_driver_rear_outer', 'door_driver_rear_inner', 'window_driver_rear', 'door_driver_rear_window_trim'] as const,
      virtualDoor: { position: [0.95, 0.80, -1.02] as const, size: [0.90, 1.30, 0.08] as const, rotation: [0, 0, 0] as const, hingeSideOffset: [-0.45, 0, 0] as const, openAngle: 1.0, outerColor: '#0b1016', innerColor: '#1a1f24' },
    } satisfies DoorActionDefinition,
    door_passenger_rear: {
      durationMs: 1650, conflictGroup: 'door_passenger_rear', hingeAxis: 'Y',
      hingePosition: [-0.0085, 0.0067, -0.0017] as const, closedRotation: 0, openRotation: 1.0,
      reversible: true, movingNodeIds: ['door_passenger_rear_outer', 'door_passenger_rear_inner', 'window_passenger_rear', 'door_passenger_rear_window_trim'] as const,
      virtualDoor: { position: [0.95, 0.80, 1.02] as const, size: [0.90, 1.30, 0.08] as const, rotation: [0, 0, 0] as const, hingeSideOffset: [-0.45, 0, 0] as const, openAngle: -1.0, outerColor: '#0b1016', innerColor: '#1a1f24' },
    } satisfies DoorActionDefinition,
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
    /** Only visually dominant exterior materials participate in shadow maps. */
    shadowCasterMaterials: ['CarPaint', 'Roof', 'tire', 'RIM_1', 'Color_rim'],
    shadowReceiverMaterials: ['CarPaint', 'Roof', 'tire'],
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
      position: [0, 1.7, 7.1],
      target: [0, 0.72, 0],
      transitionMs: 450,
    },
    rear_three_quarter: {
      position: [6.1, 2.15, -4.8],
      target: [0, 0.72, 0],
      transitionMs: 450,
    },
    cargo_rear: {
      position: [5.65, 1.72, 0],
      target: [2.02, 0.93, 0],
      transitionMs: 500,
    },
    cargo_overview: {
      position: [3.8, 4.15, -2.25],
      target: [1.72, 0.55, 0],
      transitionMs: 650,
    },
    turntable: {
      position: [-5.8, 2.15, 5.8],
      target: [0, 0.72, 0],
      transitionMs: 1_200,
      autoRotate: true,
      autoRotateSpeed: 2.25,
    },
  } satisfies Record<OrbitPreset, OrbitActionDefinition>,
  launchScript: [
    {
      id: 'front-design',
      title: '前脸与智能灯光',
      narration: '从低趴前脸开始，点亮数字展车的第一束光。',
      durationMs: 15_000,
      camera: 'front',
      actions: [
        { atMs: 2_000, action: { type: 'lights', target: 'headlight', on: true } },
      ],
    },
    {
      id: 'frameless-windows',
      title: '无框车窗交互',
      narration: '来到主驾侧，展示真实车窗 Mesh 的独立升降。',
      durationMs: 20_000,
      camera: 'driver_side',
      actions: [
        { atMs: 2_000, action: { type: 'window', target: 'driver_front', open: true, progress: 100 } },
        { atMs: 10_000, action: { type: 'window', target: 'driver_front', open: false, progress: 0 } },
      ],
    },
    {
      id: 'rear-hatch',
      title: '真实尾门组合动画',
      narration: '尾门外壳、内衬、尾翼支架与中央尾灯围绕同一铰链协同运动。',
      durationMs: 25_000,
      camera: 'rear_three_quarter',
      actions: [
        { atMs: 2_000, action: { type: 'lights', target: 'taillight', on: true } },
        { atMs: 2_000, action: { type: 'trunk', open: true } },
        { atMs: 14_000, action: { type: 'trunk', open: false } },
      ],
    },
    {
      id: 'interactive-finale',
      title: '随时接管的数字发布会',
      narration: '所有入口统一为 VehicleAction，用户可以拖动镜头或点击车窗随时接管。',
      durationMs: 30_000,
      camera: 'turntable',
      actions: [
        { atMs: 3_000, action: { type: 'window', target: 'all', open: true, progress: 100 } },
        { atMs: 12_000, action: { type: 'window', target: 'all', open: false, progress: 0 } },
        { atMs: 18_000, action: { type: 'lights', target: 'headlight', on: false } },
        { atMs: 20_000, action: { type: 'lights', target: 'taillight', on: false } },
      ],
    },
  ] satisfies readonly LaunchChapter[],
  recordingScript: [
    {
      id: 'recording-opening',
      title: '如果发布会可以被接管',
      narration: '如果汽车发布会不是一段只能观看的视频呢？如果每个人，都能随时接管它？',
      durationMs: 8_000,
      camera: 'rear_three_quarter',
      actions: [
        { atMs: 1_000, action: { type: 'trunk', open: true } },
        { atMs: 5_500, action: { type: 'trunk', open: false } },
      ],
    },
    {
      id: 'recording-hero',
      title: 'AutoLaunch',
      narration: '这是我正在做的 AutoLaunch：一个可以操作、可以打断的汽车数字发布会框架。',
      durationMs: 10_000,
      camera: 'turntable',
      actions: [],
    },
    {
      id: 'recording-windows',
      title: '四车窗 · 同一动作系统',
      narration: '按钮、文字和语音最终都会变成同一种 VehicleAction。',
      durationMs: 16_000,
      camera: 'driver_side',
      actions: [
        { atMs: 1_000, action: { type: 'window', target: 'driver_front', open: true, progress: 100 } },
        { atMs: 3_000, action: { type: 'window', target: 'passenger_front', open: true, progress: 100 } },
        { atMs: 5_000, action: { type: 'window', target: 'driver_rear', open: true, progress: 100 } },
        { atMs: 7_000, action: { type: 'window', target: 'passenger_rear', open: true, progress: 100 } },
        { atMs: 9_500, action: { type: 'window', target: 'driver_front', open: true, progress: 50 } },
        { atMs: 12_500, action: { type: 'window', target: 'all', open: false, progress: 0 } },
      ],
    },
    {
      id: 'recording-trunk',
      title: '真实尾门组合动画',
      narration: '尾门外壳、内衬、尾翼支架和中央尾灯，共同围绕同一个铰链运动。',
      durationMs: 13_000,
      camera: 'rear_three_quarter',
      actions: [
        { atMs: 1_000, action: { type: 'trunk', open: true } },
        { atMs: 9_000, action: { type: 'trunk', open: false } },
      ],
    },
    {
      id: 'recording-lights',
      title: '灯光与确定性执行',
      narration: '所有入口共享同一套动作曲线、时长与车辆状态。',
      durationMs: 10_000,
      camera: 'front',
      actions: [
        { atMs: 1_000, action: { type: 'lights', target: 'headlight', on: true } },
        { atMs: 3_500, action: { type: 'lights', target: 'taillight', on: true } },
        { atMs: 7_500, action: { type: 'lights', target: 'headlight', on: false } },
        { atMs: 8_000, action: { type: 'lights', target: 'taillight', on: false } },
      ],
    },
    {
      id: 'recording-finale',
      title: 'Autoplay → Takeover',
      narration: '它不是一段只能等待播完的视频，而是一场随时可以接管的实时体验。',
      durationMs: 12_000,
      camera: 'turntable',
      actions: [
        { atMs: 1_000, action: { type: 'lights', target: 'headlight', on: true } },
        { atMs: 2_000, action: { type: 'lights', target: 'taillight', on: true } },
        { atMs: 3_000, action: { type: 'window', target: 'all', open: true, progress: 100 } },
        { atMs: 8_500, action: { type: 'window', target: 'all', open: false, progress: 0 } },
      ],
    },
  ] satisfies readonly LaunchChapter[],
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
