import { parseCommand } from './command-parser'

/** Don't mistake a question/request mentioning “车窗” for “open window”. */
export function routeInput(text: string) {
  const requirement = /[？?，,。；;]|看看|介绍|展示|一家|周末|出游|先.*再|不用|不要|不看|多大|多少|几秒|如何|为什么|方便|容量/.test(text)
  const parsed = requirement ? null : parseCommand(text)
  return parsed?.matched ? { kind: 'command' as const, action: parsed.action } : { kind: 'requirement' as const, text }
}
