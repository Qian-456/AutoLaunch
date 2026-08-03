import type { VehicleAction } from '../types'

export type ParseResult =
  | { matched: true; action: VehicleAction }
  | { matched: false; suggestion: string }

const commands: Array<[RegExp, VehicleAction]> = [
  [/^(参考图视角|前左视角|英雄视角)$/, { type: 'orbit', preset: 'hero_front_left' }],
  [/^(看正面|正面视角|转到正面)$/, { type: 'orbit', preset: 'front' }],
  [/^(看侧面|主驾侧面|转到侧面)$/, { type: 'orbit', preset: 'driver_side' }],
  [/^(看车尾|车尾视角|转到后面)$/, { type: 'orbit', preset: 'rear_three_quarter' }],
  [/^(旋转一圈|360度旋转|环绕展示)$/, { type: 'orbit', preset: 'turntable' }],
  [/^(打开主驾车窗|降下车窗|开窗)$/, { type: 'window', target: 'driver_front', open: true }],
  [/^(关闭主驾车窗|升起车窗|关窗)$/, { type: 'window', target: 'driver_front', open: false }],
  [/^(打开后备箱|开后备箱|开尾门)$/, { type: 'trunk', open: true }],
  [/^(关闭后备箱|关后备箱|关尾门)$/, { type: 'trunk', open: false }],
  [/^(开大灯|开灯|打开灯光)$/, { type: 'lights', target: 'headlight', on: true }],
  [/^(关大灯|关灯|关闭灯光)$/, { type: 'lights', target: 'headlight', on: false }],
  [/^(开尾灯|刹车灯)$/, { type: 'lights', target: 'taillight', on: true }],
  [/^(关尾灯|关闭尾灯)$/, { type: 'lights', target: 'taillight', on: false }],
]

export function parseCommand(input: string): ParseResult {
  const normalized = input.replace(/\s+/g, '').trim()
  const match = commands.find(([pattern]) => pattern.test(normalized))
  if (match) return { matched: true, action: match[1] }
  return { matched: false, suggestion: '暂不支持该命令，请尝试：打开主驾车窗、打开后备箱、开灯' }
}
