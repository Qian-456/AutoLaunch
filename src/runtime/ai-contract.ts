import { chapterPool, registry, schemaVersion, registryVersion } from '../pack/ai-registry'
import type { LaunchChapter, VehicleAction } from '../types'

export type Citation = {
  chunkId: string; documentPath: string; heading: string; text: string
  sources: { title: string; url: string }[]; modelScope: string; version: string
  packId: string; entityId: string; sourceType: string; verification: string
}
export type ResponseMeta = {
  requestId: string; schemaVersion: string; registryVersion: string; packVersion: string; packId: string
  mode: 'live' | 'fallback'; provider: string | null; model: string | null; fallbackReason: string | null
}
export type DirectorResponse = ResponseMeta & {
  selection: { persona: string; chapterIds: string[] }; chapters: LaunchChapter[]; citations: Citation[]; limitations: string[]
}
export type RagResponse = ResponseMeta & { answer: string; citations: Citation[]; linkedActions: VehicleAction[]; suggestedFollowUps: string[] }

export function sameObject(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort()
  return ak.length === bk.length && ak.every((k, i) => k === bk[i] && sameObject((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
export function registeredAction(value: unknown): value is VehicleAction {
  return registry.actions.some((entry) => sameObject(value, entry.action))
}
function validateMeta(value: ResponseMeta) {
  if (!value || value.schemaVersion !== schemaVersion || value.registryVersion !== registryVersion
    || value.packId !== registry.packId || value.packVersion !== registry.packVersion
    || !['live', 'fallback'].includes(value.mode) || typeof value.requestId !== 'string') throw new Error('响应版本或产品包不匹配')
}
function validateCitations(citations: Citation[]) {
  if (!Array.isArray(citations) || citations.length > 10) throw new Error('引用格式不合法')
  const ids = new Set<string>()
  for (const c of citations) {
    if (c.packId !== registry.packId || typeof c.chunkId !== 'string' || ids.has(c.chunkId)
      || !['SU7-Ultra', 'SU7-series-shared'].includes(c.modelScope) || !c.documentPath.startsWith('knowledge/')
      || typeof c.text !== 'string' || !Array.isArray(c.sources)
      || c.sources.some((source) => !/^https?:\/\//.test(source.url) && source.url !== '/api/registry')) throw new Error('引用范围不合法')
    ids.add(c.chunkId)
  }
}
export function validateDirector(value: DirectorResponse): DirectorResponse {
  validateMeta(value)
  const selection = value.selection
  if (!selection || !registry.personas.includes(selection.persona) || !Array.isArray(selection.chapterIds)
    || !selection.chapterIds.length || selection.chapterIds.length > registry.limits.maxChapters
    || new Set(selection.chapterIds).size !== selection.chapterIds.length || !Array.isArray(value.chapters)
    || value.chapters.length !== selection.chapterIds.length) throw new Error('导演选择不合法')
  let total = 0
  value.chapters.forEach((chapter, index) => {
    const template = chapterPool.find((c) => c.id === selection.chapterIds[index])
    if (!template || !sameObject(template, chapter)) throw new Error('章节未通过已审核模板校验')
    total += chapter.durationMs
  })
  if (total > registry.limits.maxDurationMs) throw new Error('计划时长超过限制')
  validateCitations(value.citations)
  if (!Array.isArray(value.limitations) || value.limitations.some((s) => typeof s !== 'string')) throw new Error('限制说明格式不合法')
  return value
}
export function validateRag(value: RagResponse): RagResponse {
  validateMeta(value); validateCitations(value.citations)
  if (typeof value.answer !== 'string' || !Array.isArray(value.linkedActions) || value.linkedActions.length > 8
    || !value.linkedActions.every(registeredAction) || (!value.citations.length && value.linkedActions.length)
    || !Array.isArray(value.suggestedFollowUps) || value.suggestedFollowUps.some((s) => typeof s !== 'string')) throw new Error('问答动作或证据不合法')
  return value
}
