import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { requestDirector, requestRag, RequestGate } from '../runtime/ai-client'
import { routeInput } from '../runtime/input-router'
import { dispatchVehicleAction } from '../runtime/action-dispatcher'
import type { Citation, DirectorResponse, RagResponse, ResponseMeta } from '../runtime/ai-contract'
import { useExperienceStore } from '../store/experience-store'

export type AiPanelHandle = { submitRequirement: (text: string) => void }
type Message = { question: string; response?: RagResponse; error?: string }

function SourceMode({ meta }: { meta: ResponseMeta }) {
  return <p className="ai-mode">{meta.mode === 'live' ? `在线 · ${meta.provider} / ${meta.model}` : '本地规则 fallback'}
    {meta.fallbackReason && <small>原因：{meta.fallbackReason}</small>}
  </p>
}
function Citations({ citations }: { citations: Citation[] }) {
  return <details className="ai-citations"><summary>查看 {citations.length} 条证据与出处</summary>
    {citations.map((c, index) => <article key={c.chunkId}>
      <strong>[{index + 1}] {c.heading}</strong>
      <small>{c.documentPath} · {c.modelScope} · {c.sourceType} · 精选资料未实时复核</small>
      <code>{c.chunkId}</code>
      {c.sources.map((s, i) => <a key={`${s.url}-${i}`} href={s.url} target="_blank" rel="noreferrer">{s.title || '原始来源'} ↗</a>)}
      <p>{c.text}</p>
    </article>)}
  </details>
}

export const AiPanel = forwardRef<AiPanelHandle, { onFeedback: (text: string) => void }>(function AiPanel({ onFeedback }, ref) {
  const [requirement, setRequirement] = useState('一家三口周末出游，重点看看装东西方便不方便。')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [plan, setPlan] = useState<DirectorResponse | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState('')
  const directorGate = useRef(new RequestGate(() => useExperienceStore.getState().controlEpoch))
  const ragGate = useRef(new RequestGate(() => useExperienceStore.getState().controlEpoch))
  const playback = useExperienceStore((s) => s.playback)
  const modelStatus = useExperienceStore((s) => s.modelStatus)

  useEffect(() => { if (playback === 'playing') setError('') }, [playback])

  useEffect(() => {
    const unsubscribe = useExperienceStore.subscribe((state, previous) => {
      if (state.controlEpoch !== previous.controlEpoch) {
        directorGate.current.cancel(); ragGate.current.cancel(); setBusy(false); setAsking(false)
      }
    })
    return () => { unsubscribe(); directorGate.current.cancel(); ragGate.current.cancel() }
  }, [])

  async function generate(text: string) {
    if (!text.trim()) return
    setRequirement(text)
    const routed = routeInput(text)
    if (routed.kind === 'command') {
      onFeedback(dispatchVehicleAction(routed.action).message); return
    }
    useExperienceStore.getState().interruptPlayback()
    const token = directorGate.current.begin()
    setBusy(true); setError('')
    try {
      const response = await requestDirector(text, token.signal)
      if (!directorGate.current.accepts(token)) return
      setPlan(response)
      if (useExperienceStore.getState().modelStatus === 'ready') {
        useExperienceStore.getState().playScript(response.chapters)
        onFeedback('导演计划已校验并开始播放，可随时手动接管')
      } else setError('计划已生成；模型就绪后请显式点击播放。')
    } catch {
      if (directorGate.current.accepts(token)) setError('生成中断，请重试；手动操作仍然可用。')
    } finally { if (directorGate.current.accepts(token)) setBusy(false) }
  }
  useImperativeHandle(ref, () => ({ submitRequirement: (text) => { void generate(text) } }))

  async function ask(text: string) {
    if (!text.trim()) return
    const routed = routeInput(text)
    if (routed.kind === 'command') { onFeedback(dispatchVehicleAction(routed.action).message); return }
    useExperienceStore.getState().interruptPlayback()
    const token = ragGate.current.begin()
    setAsking(true); setError(''); setQuestion('')
    try {
      const response = await requestRag(text, token.signal)
      if (!ragGate.current.accepts(token)) return
      setMessages((old) => [...old.slice(-7), { question: text, response }])
      // Validate the whole response before this synchronous action batch. No timers.
      if (useExperienceStore.getState().modelStatus === 'ready') {
        for (const action of response.linkedActions) onFeedback(dispatchVehicleAction(action, 'rag').message)
      }
    } catch {
      if (ragGate.current.accepts(token)) setMessages((old) => [...old.slice(-7), {
        question: text, error: '问答服务暂不可用或响应未通过校验；未执行联动动作，请使用车辆按钮。',
      }])
    } finally { if (ragGate.current.accepts(token)) setAsking(false) }
  }

  const stop = () => {
    directorGate.current.cancel(); ragGate.current.cancel()
    useExperienceStore.getState().interruptPlayback(); useExperienceStore.getState().keepManual()
    setBusy(false); setAsking(false); onFeedback('已停止，需显式点击播放或恢复才会继续')
  }
  return <aside className="ai-panel" aria-label="AI 导演与知识问答">
    <section>
      <p className="eyebrow">YOUR OWN LAUNCH</p><h2>告诉我，你想看什么</h2>
      <form onSubmit={(e) => { e.preventDefault(); void generate(requirement) }}>
        <label htmlFor="ai-requirement">展示需求 / 直接指令</label>
        <textarea id="ai-requirement" value={requirement} maxLength={2000} onChange={(e) => setRequirement(e.target.value)} rows={3} />
        <div className="ai-examples">
          <button type="button" onClick={() => setRequirement('一家三口周末出游，重点看看装东西方便不方便。')}>家庭出游</button>
          <button type="button" onClick={() => setRequirement('来一段有性能感的展示，先看灯光，再看车身。')}>性能与外观</button>
          <button type="button" onClick={() => setRequirement('不用介绍性能，看看后备箱和车窗就好。')}>只看空间</button>
        </div>
        <div className="ai-buttons"><button type="submit">{busy ? '重新生成并播放' : '生成并播放'}</button>
          <button type="button" onClick={stop}>停止 / 取消</button></div>
      </form>
      {busy && <p role="status">正在检索与选择章节…可停止或手动接管</p>}
      {error && <p role="alert">{error}</p>}
      {plan && <div className="ai-plan">
        <SourceMode meta={plan} />
        <p>{plan.selection.persona === 'family' ? '家庭空间路线' : '性能外观路线'} · {plan.chapters.reduce((n, c) => n + c.durationMs, 0) / 1000} 秒</p>
        <ol>{plan.chapters.map((c) => <li key={c.id}>{c.title}</li>)}</ol>
        <div className="ai-buttons">
          <button disabled={modelStatus !== 'ready'} onClick={() => useExperienceStore.getState().playScript(plan.chapters)}>从头播放</button>
          {playback === 'paused' && <button disabled={modelStatus !== 'ready'} onClick={() => useExperienceStore.getState().resumePlayback()}>恢复自动发布会</button>}
        </div>
        <details><summary>能力限制</summary>{plan.limitations.map((s) => <p key={s}>{s}</p>)}</details>
        <Citations citations={plan.citations} />
      </div>}
    </section>
    <section className="ai-qa"><h2>问一问这款车</h2>
      <form onSubmit={(e) => { e.preventDefault(); void ask(question) }}>
        <label htmlFor="ai-question">产品问题</label>
        <input id="ai-question" value={question} maxLength={2000} onChange={(e) => setQuestion(e.target.value)} placeholder="后备箱多大？" />
        <button type="submit">{asking ? '提交新问题' : '提问并联动'}</button>
      </form>
      {asking && <p role="status">正在检索适用版本的证据…</p>}
      <div className="ai-messages" aria-live="polite">
        {messages.map((m, index) => <article key={index}>
          <h3>{m.question}</h3>
          {m.error && <p role="alert">{m.error}</p>}
          {m.response && <>
            <SourceMode meta={m.response} /><p className="ai-answer">{m.response.answer}</p>
            <Citations citations={m.response.citations} />
            <div className="ai-examples">{m.response.suggestedFollowUps.map((q) => <button key={q} onClick={() => void ask(q)}>{q}</button>)}</div>
          </>}
        </article>)}
      </div>
    </section>
  </aside>
})
