import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { requestDirector, requestRag, RequestGate } from '../runtime/ai-client'
import { routeAssistantInput, type AssistantIntent } from '../runtime/input-router'
import { dispatchVehicleActions } from '../runtime/action-dispatcher'
import { explorationTopics } from '../pack/exploration-topics'
import type { Citation, DirectorResponse, RagResponse, ResponseMeta } from '../runtime/ai-contract'
import { useExperienceStore } from '../store/experience-store'
import type { VoiceState } from '../types'

export type AiPanelHandle = { submitText: (text: string) => void }
type Message = { text: string; response?: RagResponse; plan?: DirectorResponse; error?: string }
type Props = {
  command: string; onCommandChange: (text: string) => void; onFeedback: (text: string) => void
  voiceState: VoiceState; onVoice: () => void
  onReadingChange: (open: boolean) => void
}

function SourceMode({ meta }: { meta: ResponseMeta }) {
  return <p className="ai-mode">{meta.mode === 'live' ? '在线检索结果' : '精选资料与本地规则'}</p>
}

function Citations({ citations }: { citations: Citation[] }) {
  return <details className="ai-citations"><summary>资料与适用范围（{citations.length}）</summary>
    {!citations.length && <p>本次没有可引用的产品资料；演示仅使用已注册能力。</p>}
    {citations.map((citation, index) => <article key={citation.chunkId}>
      <strong>[{index + 1}] {citation.heading}</strong>
      <small>{citation.modelScope === 'SU7-Ultra' ? 'SU7 Ultra' : 'SU7 车系共用资料'} · 资料版本 {citation.version} · 外部来源未实时复核</small>
      {citation.sources.map((source, i) => <a key={`${source.url}-${i}`} href={source.url} target="_blank" rel="noreferrer">{source.title || '原始来源'} ↗</a>)}
      <p>{citation.text}</p>
    </article>)}
  </details>
}

export const AiPanel = forwardRef<AiPanelHandle, Props>(function AiPanel({ command, onCommandChange, onFeedback, voiceState, onVoice, onReadingChange }, ref) {
  const [intent, setIntent] = useState<AssistantIntent>('auto')
  const [topic, setTopic] = useState<(typeof explorationTopics)[number] | null>(null)
  const [reading, setReading] = useState<'topic' | 'answer' | null>(null)
  const [busy, setBusy] = useState<'question' | 'director' | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const settingsRef = useRef<HTMLDetailsElement>(null)
  const gate = useRef(new RequestGate(() => useExperienceStore.getState().controlEpoch))
  const playback = useExperienceStore((state) => state.playback)
  const modelStatus = useExperienceStore((state) => state.modelStatus)
  const latest = messages[messages.length - 1]

  useEffect(() => { onReadingChange(reading !== null) }, [reading, onReadingChange])

  useEffect(() => {
    const unsubscribe = useExperienceStore.subscribe((state, previous) => {
      if (state.controlEpoch !== previous.controlEpoch) { gate.current.cancel(); setBusy(null) }
    })
    return () => { unsubscribe(); gate.current.cancel() }
  }, [])

  function closeReader() {
    gate.current.cancel(); setBusy(null); setReading(null); inputRef.current?.focus()
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (settingsRef.current?.open) {
        settingsRef.current.open = false
        settingsRef.current.querySelector('summary')?.focus()
        event.preventDefault()
      } else if (reading) closeReader()
    }
    const dismissSettings = (event: PointerEvent) => {
      if (settingsRef.current?.open && !settingsRef.current.contains(event.target as Node)) settingsRef.current.open = false
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('pointerdown', dismissSettings)
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('pointerdown', dismissSettings) }
  }, [reading])

  async function submit(text: string, purpose: AssistantIntent = intent) {
    if (!text.trim()) return
    const routed = routeAssistantInput(text, purpose)
    onCommandChange('')
    if (routed.kind === 'command') {
      for (const result of dispatchVehicleActions([routed.action])) onFeedback(result.message)
      return
    }
    useExperienceStore.getState().interruptPlayback()
    const token = gate.current.begin()
    setBusy(routed.kind); setPendingText(text); setReading('answer')
    try {
      if (routed.kind === 'director') {
        const plan = await requestDirector(text, token.signal)
        if (!gate.current.accepts(token)) return
        setMessages((old) => [...old.slice(-7), { text, plan }])
        if (useExperienceStore.getState().modelStatus === 'ready') {
          useExperienceStore.getState().playScript(plan.chapters)
          onFeedback('展示路线已校验并开始播放，可随时手动接管')
        } else onFeedback('路线已生成，车辆载入后请点击播放')
      } else {
        const response = await requestRag(text, token.signal)
        if (!gate.current.accepts(token)) return
        setMessages((old) => [...old.slice(-7), { text, response }])
        // requestRag validates the entire response before any linked action runs.
        if (useExperienceStore.getState().modelStatus === 'ready') {
          for (const result of dispatchVehicleActions(response.linkedActions, 'rag')) onFeedback(result.message)
        }
      }
    } catch {
      if (gate.current.accepts(token)) setMessages((old) => [...old.slice(-7), {
        text, error: '请求暂不可用或响应未通过校验，未执行联动动作。请重试，或继续使用车辆控制。',
      }])
    } finally { if (gate.current.accepts(token)) setBusy(null) }
  }

  useImperativeHandle(ref, () => ({ submitText: (text) => { void submit(text) } }))

  function stop() {
    gate.current.cancel(); setBusy(null)
    useExperienceStore.getState().interruptPlayback(); useExperienceStore.getState().keepManual()
    onFeedback('已停止，由你决定何时播放或恢复')
  }

  function renderMessage(message: Message) {
    return <>
      <h3>{message.text}</h3>
      {message.error && <p role="alert">{message.error}</p>}
      {message.response && <>
        <SourceMode meta={message.response} />
        <p className="ai-answer">{message.response.answer}</p>
        <Citations citations={message.response.citations} />
        <div className="ai-examples">{message.response.suggestedFollowUps.map((question) => <button key={question} onClick={() => void submit(question, 'question')}>{question} ↗</button>)}</div>
      </>}
      {message.plan && <>
        <SourceMode meta={message.plan} />
        <p>{message.plan.selection.persona === 'family' ? '家庭空间路线' : '性能外观路线'} · {message.plan.chapters.reduce((sum, chapter) => sum + chapter.durationMs, 0) / 1000} 秒</p>
        <ol>{message.plan.chapters.map((chapter) => <li key={chapter.id}>{chapter.title}</li>)}</ol>
        <button className="ai-primary" disabled={modelStatus !== 'ready'} onClick={() => useExperienceStore.getState().playScript(message.plan!.chapters)}>从头播放这条路线</button>
        <details><summary>演示边界</summary>{message.plan.limitations.map((limit) => <p key={limit}>{limit}</p>)}</details>
        <Citations citations={message.plan.citations} />
      </>}
    </>
  }

  return <>
    <nav className="exploration-topics" aria-label="探索主题">
      <h2>你想了解什么？</h2>
      {explorationTopics.map((item) => <button key={item.id} aria-pressed={topic?.id === item.id} onClick={() => { setTopic(item); setReading('topic') }}>
        <strong>{item.title}</strong><small>{item.summary}</small><span aria-hidden="true">↗</span>
      </button>)}
      <button className="exploration-topics__free" onClick={closeReader}>返回自由探索</button>
    </nav>

    {reading && <aside className="ai-answer-panel" aria-label="探索详情">
      <div className="ai-reader-heading"><h2>{reading === 'topic' ? topic?.title : '随行助手'}</h2><button aria-label="收起探索详情" onClick={closeReader}>×</button></div>
      {reading === 'topic' && topic && <>
        <h3>{topic.headline}</h3><p>{topic.description}</p>
        <div className="ai-buttons">
          <button disabled={modelStatus !== 'ready'} onClick={() => {
            for (const result of dispatchVehicleActions(topic.actions)) onFeedback(result.message)
          }}>{topic.previewLabel}</button>
          {topic.id === 'family' && <button disabled={modelStatus !== 'ready'} onClick={() => {
            for (const result of dispatchVehicleActions([{ type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' }])) onFeedback(result.message)
          }}>体验双箱装载</button>}
        </div>
        <h3>继续了解</h3>
        <div className="ai-topic-questions">{topic.questions.map((question) => <button key={question} onClick={() => void submit(question, 'question')}>{question} ↗</button>)}</div>
        {topic.requirement && <button className="ai-primary" onClick={() => void submit(topic.requirement, 'director')}>带我看一段演示</button>}
      </>}
      {reading === 'answer' && <div aria-live="polite">
        {busy ? <><h3>{pendingText}</h3><p role="status">{busy === 'director' ? '正在选择适合的展示章节…' : '正在检索适用车型的资料…'}</p><button onClick={stop}>取消请求</button></> : latest && renderMessage(latest)}
      </div>}
      {messages.length > 0 && <details className="ai-history"><summary>最近的问答与路线（{messages.length}）</summary>
        {messages.map((message, index) => <article key={index}>{renderMessage(message)}</article>)}
      </details>}
    </aside>}

    <section className="ai-dock" aria-label="统一文字与语音入口">
      <form onSubmit={(event) => { event.preventDefault(); void submit(command) }}>
        <label className="sr-only" htmlFor="camera-command">产品问题、车辆指令或演示需求</label>
        <div className="ai-dock__input">
          <button className="ai-dock__history" type="button" aria-label="查看最近回答" title={messages.length ? '查看最近回答' : '随行助手'} disabled={!messages.length}
            aria-expanded={reading === 'answer'} onClick={() => setReading(reading === 'answer' ? null : 'answer')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" /><path d="M7 9h10M7 13h6" /></svg>
          </button>
          <input ref={inputRef} id="camera-command" value={command} maxLength={2000} onChange={(event) => onCommandChange(event.target.value)} placeholder="问问这辆车，或带我看一段演示…" />
          <details ref={settingsRef} className="ai-input-settings">
            <summary aria-label="调整输入方式" title="调整输入方式" data-mode={intent}>
              {intent === 'auto' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" /><circle cx="15" cy="17" r="2.5" /></svg> : <span>{intent === 'question' ? '问答' : '演示'}</span>}
            </summary>
            <div>
              <label htmlFor="assistant-intent">处理方式</label>
              <select id="assistant-intent" value={intent} onChange={(event) => {
                setIntent(event.target.value as AssistantIntent)
                if (settingsRef.current) settingsRef.current.open = false
                inputRef.current?.focus()
              }}>
                <option value="auto">自动识别</option><option value="question">了解产品</option><option value="director">编排演示</option>
              </select>
              <p>默认自动理解。识别不符合预期时，可在这里指定。</p>
            </div>
          </details>
          {(busy || playback === 'playing' || playback === 'paused') && <button type="button" aria-label="停止 / 取消" title="停止 / 取消" onClick={stop}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          </button>}
          <button className="voice-button" type="button" disabled={voiceState === 'unsupported' || voiceState === 'denied'}
            title={voiceState === 'unsupported' || voiceState === 'denied' ? '麦克风不可用，请使用文字或按钮' : '使用语音输入'}
            aria-label={voiceState === 'listening' ? '停止语音识别' : '开始语音识别'} aria-pressed={voiceState === 'listening'} onClick={onVoice}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M9 21h6" /></svg>
          </button>
          <button className="ai-primary ai-dock__send" type="submit" disabled={!command.trim()} aria-label={busy ? '提交新问题' : '发送'} title={busy ? '提交新问题' : '发送'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 11 6-6 6 6M12 5v15" /></svg>
          </button>
        </div>
      </form>
    </section>
  </>
})
