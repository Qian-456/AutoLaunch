import type { VehicleAction, WindowTarget } from '../types'

export type ParseResult =
  | { matched: true; action: VehicleAction }
  | { matched: false; suggestion: string }

/**
 * Matches an optional integer percentage in the range 0-100 inside the input.
 * Returns the parsed number or undefined if no percentage was present.
 * Accepts forms like 50%, 50 ％, open 30 etc as long as the digits are present.
 */
function extractProgress(normalized: string): number | undefined {
  const match = normalized.match(/(\d{1,3})\s*(?:%|％)?/)
  if (!match) return undefined
  const raw = Number.parseInt(match[1], 10)
  if (Number.isNaN(raw)) return undefined
  return Math.max(0, Math.min(100, raw))
}

/**
 * Ordered window-specifier parsers.
 * Each entry is (regex) -> WindowTarget. We test the most specific patterns
 * first (rear windows) before the generic "front" / "driver" patterns so we
 * never accidentally resolve "主驾后" to "driver_front".
 */
const windowSpecs: Array<[RegExp, Exclude<WindowTarget, 'all'>]> = [
  [/主驾后(排)?(车)?窗|左后(车)?窗|driverrear/i, 'driver_rear'],
  [/副驾后(排)?(车)?窗|右后(车)?窗|passengerrear/i, 'passenger_rear'],
  [/副驾(前)?(车)?窗|右前(车)?窗|passenger(front)?/i, 'passenger_front'],
  [/主驾(前)?(车)?窗|左前(车)?窗|driver(front)?/i, 'driver_front'],
]

/** Matches bulk "all windows" style commands. */
const allWindowsSpec = /(全部|所有|全车|所有的|四个|四个的)(车)?窗|allwindows|all/i

/** Generic "open/descend/lower/raise/close" plus progress verbs. */
const openVerbs = /(打开|降下|下降|降|开启|开|降到|打开到|开启到|降至|下到)/
const closeVerbs = /(关闭|升起|关上|升|关|升到|关闭到|升至|上到)/

function parseWindowCommand(normalized: string): ParseResult | null {
  if (!/(车)?窗|window/i.test(normalized)) return null

  let target: WindowTarget | null = null

  if (allWindowsSpec.test(normalized)) {
    target = 'all'
  } else {
    for (const [pattern, candidate] of windowSpecs) {
      if (pattern.test(normalized)) {
        target = candidate
        break
      }
    }
  }

  if (!target) return null

  const explicitProgress = extractProgress(normalized)
  const hasOpenVerb = openVerbs.test(normalized)
  const hasCloseVerb = closeVerbs.test(normalized)

  let progress: number
  if (explicitProgress !== undefined) {
    progress = explicitProgress
  } else if (hasCloseVerb && !hasOpenVerb) {
    progress = 0
  } else {
    progress = 100
  }

  const open = progress > 0
  return { matched: true, action: { type: 'window', target, open, progress } }
}

const orbitCommands: Array<[RegExp, VehicleAction]> = [
  [/^(参考图视角|前左视角|英雄视角|hero)$/, { type: 'orbit', preset: 'hero_front_left' }],
  [/^(看正面|正面视角|转到正面|front)$/, { type: 'orbit', preset: 'front' }],
  [/^(看侧面|主驾侧面|转到侧面|side|driver)$/, { type: 'orbit', preset: 'driver_side' }],
  [/^(看车尾|车尾视角|转到后面|rear|back)$/, { type: 'orbit', preset: 'rear_three_quarter' }],
  [/^(旋转一圈|360度旋转|环绕展示|turntable|360|旋转)$/, { type: 'orbit', preset: 'turntable' }],
]

const simpleCommands: Array<[RegExp, VehicleAction]> = [
  [/^(打开后备箱|开后备箱|开尾门|opentrunk|trunkopen)$/, { type: 'trunk', open: true }],
  [/^(关闭后备箱|关后备箱|关尾门|closetrunk|trunkclose)$/, { type: 'trunk', open: false }],
  [/^(开大灯|开灯|打开灯光|headlighton|lightson)$/, { type: 'lights', target: 'headlight', on: true }],
  [/^(关大灯|关灯|关闭灯光|headlightoff|lightsoff)$/, { type: 'lights', target: 'headlight', on: false }],
  [/^(开尾灯|刹车灯|taillighton)$/, { type: 'lights', target: 'taillight', on: true }],
  [/^(关尾灯|关闭尾灯|taillightoff)$/, { type: 'lights', target: 'taillight', on: false }],
]

const FALLBACK_SUGGESTION =
  '暂不支持该命令，请尝试：打开主驾车窗、主驾车窗50%、全部车窗打开'

export function parseCommand(input: string): ParseResult {
  const normalized = input.replace(/\s+/g, '').trim()
  if (!normalized) return { matched: false, suggestion: FALLBACK_SUGGESTION }

  const orbit = orbitCommands.find(([pattern]) => pattern.test(normalized))
  if (orbit) return { matched: true, action: orbit[1] }

  const windowResult = parseWindowCommand(normalized)
  if (windowResult) return windowResult

  const simple = simpleCommands.find(([pattern]) => pattern.test(normalized))
  if (simple) return { matched: true, action: simple[1] }

  return { matched: false, suggestion: FALLBACK_SUGGESTION }
}
