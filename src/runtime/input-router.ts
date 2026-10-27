import { parseCommand } from './command-parser'

/** Don't mistake a question/request mentioning “车窗” for “open window”. */
export function routeInput(text: string) {
  const requirement = /[？?，,。；;]|看看|介绍|展示|一家|周末|出游|先.*再|不用|不要|不看|别|多大|多少|几秒|如何|为什么|怎么|是否|能否|吗|舒适|舒服|方便|容量/.test(text)
  const parsed = requirement ? null : parseCommand(text)
  return parsed?.matched ? { kind: 'command' as const, action: parsed.action } : { kind: 'requirement' as const, text }
}

export type AssistantIntent = 'auto' | 'question' | 'director'

export function routeAssistantInput(text: string, intent: AssistantIntent = 'auto') {
  const routed = routeInput(text)
  if (routed.kind === 'command') return routed
  const question = /[？?]|吗|什么|怎么|如何|为什么|是否|能否|多大|多少|几秒|区别/.test(text)
  const presentation = /带我|来一段|生成|播放|发布会|演示|展示|介绍|看看|先.+(?:再|然后)/.test(text)
  const kind = intent === 'auto' ? (question || !presentation ? 'question' : 'director') : intent
  return { kind, text }
}
