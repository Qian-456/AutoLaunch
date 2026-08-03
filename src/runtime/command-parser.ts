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
]

export function parseCommand(input: string): ParseResult {
  const normalized = input.replace(/\s+/g, '').trim()
  const match = commands.find(([pattern]) => pattern.test(normalized))
  if (match) return { matched: true, action: match[1] }
  return { matched: false, suggestion: '暂不支持该命令，请尝试：参考图视角、看侧面、旋转一圈' }
}
