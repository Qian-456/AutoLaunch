import { chapterPool, personaChapters, registry } from '../pack/ai-registry'
import { validateDirector, validateRag, type DirectorResponse, type RagResponse } from './ai-contract'

export class RequestGate {
  private id = 0
  private controller: AbortController | null = null
  constructor(private epoch: () => number) {}
  cancel() { this.id++; this.controller?.abort(); this.controller = null }
  begin() {
    this.cancel(); this.controller = new AbortController()
    return { id: this.id, epoch: this.epoch(), signal: this.controller.signal }
  }
  accepts(token: { id: number; epoch: number; signal: AbortSignal }) {
    return !token.signal.aborted && token.id === this.id && token.epoch === this.epoch()
  }
}

async function post(path: string, body: unknown, signal: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 16_000)
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
    if (!response.ok) throw new Error(`服务请求失败 (${response.status})`)
    return await response.json()
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort) }
}

export function localDirector(requirement: string, reason: string): DirectorResponse {
  const noPerformance = /(不用|不要|不看|不介绍).{0,6}性能/.test(requirement)
  const family = noPerformance || /家庭|一家|出游|装东西|行李|后备[箱厢]|尾门/.test(requirement)
  const persona = family ? 'family' : 'performance'
  let ids = [...personaChapters.fallbackChapterIdsByPersona[persona]]
  if (noPerformance) ids = ['family-space', 'frameless-windows']
  if (/双箱|装载演示|放入行李/.test(requirement)) ids = ['rear-hatch', 'cargo-demo', 'frameless-windows']
  if (/先.{0,6}灯.{0,10}再.{0,6}(车身|外观)/.test(requirement)) ids = ['front-design', 'interactive-finale']
  return validateDirector({ requestId: `local-${Date.now()}`, schemaVersion: registry.schemaVersion,
    registryVersion: registry.registryVersion, packId: registry.packId, packVersion: registry.packVersion,
    mode: 'fallback', provider: null, model: null, fallbackReason: reason,
    selection: { persona, chapterIds: ids }, chapters: ids.map((id) => chapterPool.find((c) => c.id === id)!),
    citations: [], limitations: ['后端不可用或校验失败，使用本地规则选择；不代表真实模型理解。仅展示已注册能力，不能模拟驾驶或实车容量。'],
  })
}

export async function requestDirector(requirement: string, signal: AbortSignal): Promise<DirectorResponse> {
  try {
    return validateDirector(await post('/api/ai-director', { requirement, packId: registry.packId }, signal))
  } catch {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    // Reject the entire plan, never repair arbitrary partial model output.
    return localDirector(requirement, 'backend_unavailable_or_invalid_response')
  }
}
export async function requestRag(question: string, signal: AbortSignal): Promise<RagResponse> {
  return validateRag(await post('/api/rag', { question, packId: registry.packId }, signal))
}
