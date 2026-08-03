import { Component, type ErrorInfo, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { Experience } from './components/Experience'
import { su7ConceptPack, WINDOW_LABELS, WINDOW_TARGETS } from './pack/su7-concept.pack'
import { parseCommand } from './runtime/command-parser'
import { dispatchVehicleAction } from './runtime/action-dispatcher'
import { createBrowserSpeechRecognition, type BrowserSpeechRecognition } from './runtime/browser-speech'
import { useExperienceStore } from './store/experience-store'
import type { OrbitPreset, VehicleAction, WindowTarget } from './types'

const orbitButtons: Array<{ preset: OrbitPreset; label: string }> = [
  { preset: 'hero_front_left', label: '主视觉' },
  { preset: 'front', label: '前脸' },
  { preset: 'driver_side', label: '主驾侧' },
  { preset: 'rear_three_quarter', label: '车尾' },
  { preset: 'turntable', label: '360°' },
]

const singleVehicleControls: Array<{
  id: 'trunk' | 'headlight' | 'taillight'
  label: string
  enable: Exclude<VehicleAction, { type: 'orbit' | { type: 'window' } }>
  disable: Exclude<VehicleAction, { type: 'orbit' | { type: 'window' } }>
}> = [
  { id: 'trunk', label: '后备箱', enable: { type: 'trunk', open: true }, disable: { type: 'trunk', open: false } },
  { id: 'headlight', label: '大灯', enable: { type: 'lights', target: 'headlight', on: true }, disable: { type: 'lights', target: 'headlight', on: false } },
  { id: 'taillight', label: '尾灯', enable: { type: 'lights', target: 'taillight', on: true }, disable: { type: 'lights', target: 'taillight', on: false } },
]

type ConcreteWindowTarget = Exclude<WindowTarget, 'all'>

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AutoLaunch] model scene failed:', error, info)
    useExperienceStore.getState().setModelStatus('error')
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="scene-error" role="alert">
          <strong>模型加载失败</strong>
          <span>请确认 public/assets/su7_ultra.glb 存在后刷新页面。</span>
          <button onClick={() => window.location.reload()}>重新加载</button>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  const [command, setCommand] = useState('')
  const [isCommandDrawerOpen, setIsCommandDrawerOpen] = useState(false)
  const [feedback, setFeedback] = useState('拖动车身区域可自由旋转 · 滚轮缩放 · 文字可输入：主驾车窗50%')
  const { progress: loadingProgress } = useProgress()
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const modelStatus = useExperienceStore((state) => state.modelStatus)
  const stageMode = useExperienceStore((state) => state.stageMode)
  const activeOrbitPreset = useExperienceStore((state) => state.activeOrbitPreset)
  const notice = useExperienceStore((state) => state.notice)
  const voiceState = useExperienceStore((state) => state.inputMode.voice)
  const windowProgress = useExperienceStore((state) => state.windowProgress)
  const trunkState = useExperienceStore((state) => state.vehiclePartStates.get('trunk'))
  const trunkTargetOpen = useExperienceStore((state) => {
    for (const execution of state.activeActions.values()) {
      if (execution.action.type === 'hatch' || execution.action.type === 'trunk') {
        return execution.targetValue
      }
    }
    return undefined
  })
  const headlightOn = useExperienceStore((state) => state.lightStates.get('headlight'))
  const taillightOn = useExperienceStore((state) => state.lightStates.get('taillight'))
  const setVoiceState = useExperienceStore((state) => state.setVoiceState)
  const setStageMode = useExperienceStore((state) => state.setStageMode)

  const runOrbit = useCallback((preset: OrbitPreset) => {
    const result = dispatchVehicleAction({ type: 'orbit', preset })
    setFeedback(result.message)
  }, [])

  const runVehicleAction = useCallback((action: Exclude<VehicleAction, { type: 'orbit' }>) => {
    const result = dispatchVehicleAction(action)
    setFeedback(result.message)
  }, [])

  const runCommandText = useCallback((text: string, clearAfter = false) => {
    const parsed = parseCommand(text)
    if (!parsed.matched) {
      setFeedback(parsed.suggestion)
      return
    }
    const result = dispatchVehicleAction(parsed.action)
    setFeedback(result.message)
    if (clearAfter) setCommand('')
  }, [])

  useEffect(() => {
    const recognition = createBrowserSpeechRecognition()
    if (!recognition) {
      setVoiceState('unsupported')
      return
    }

    recognition.lang = import.meta.env.VITE_VOICE_LANG || 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onstart = () => setVoiceState('listening')
    recognition.onresult = (event) => {
      let visibleTranscript = ''
      let finalTranscript = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript ?? ''
        visibleTranscript += transcript
        if (result.isFinal) finalTranscript += transcript
      }
      const visible = visibleTranscript.trim()
      if (visible) setCommand(visible)
      if (finalTranscript.trim()) runCommandText(finalTranscript.trim())
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceState('denied')
        setFeedback('麦克风不可用，请使用文字或按钮')
        return
      }
      setVoiceState('available')
      setFeedback(event.error === 'no-speech' ? '没有识别到语音，请再试一次' : '语音识别暂时不可用，请使用文字或按钮')
    }
    recognition.onend = () => {
      if (useExperienceStore.getState().inputMode.voice !== 'denied') setVoiceState('available')
    }
    recognitionRef.current = recognition
    setVoiceState('available')
    return () => {
      recognition.abort()
      recognitionRef.current = null
    }
  }, [runCommandText, setVoiceState])

  const toggleVoice = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (voiceState === 'listening') {
      recognition.stop()
      return
    }
    try {
      recognition.start()
    } catch {
      setFeedback('语音识别正在启动，请稍候再试')
    }
  }

  const submitCommand = (event: FormEvent) => {
    event.preventDefault()
    runCommandText(command, true)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p>AUTOLAUNCH / PRODUCT VIEW</p>
            <h1>2025 SU7 ULTRA · 四车窗进度控制</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className={`stage-mode-button${stageMode === 'launch' ? ' active' : ''}`}
            type="button"
            onClick={() => setStageMode(stageMode === 'launch' ? 'studio' : 'launch')}
          >
            <span aria-hidden="true" />
            {stageMode === 'launch' ? '退出发布会展位' : '发布会模式'}
          </button>
          <div className={`model-state model-state--${modelStatus}`}>
            <span />
            {modelStatus === 'ready' ? '3D READY' : modelStatus === 'error' ? 'MODEL ERROR' : `${Math.round(loadingProgress)}% LOADING`}
          </div>
        </div>
      </header>

      <section className={`stage stage--${stageMode}`} aria-label="SU7 Ultra 三维交互展示">
        <SceneErrorBoundary>
          <Canvas
            shadows
            dpr={[1.5, 2]}
            camera={{ position: [-6.25, 2.25, 4.6], fov: 32, near: 0.1, far: 100 }}
            gl={{
              antialias: true,
              alpha: false,
              outputColorSpace: SRGBColorSpace,
              toneMapping: ACESFilmicToneMapping,
              powerPreference: 'high-performance',
              precision: 'highp',
            }}
          >
            <Experience />
          </Canvas>
        </SceneErrorBoundary>

        <div className="hero-copy">
          <p className="eyebrow">PERFORMANCE, REFRAMED</p>
          <p>四车窗独立 0-100% 控制 · 文字/语音可指定具体进度</p>
        </div>

        {modelStatus === 'loading' && (
          <div className="loading-card" role="status">
            <div className="loading-card__value">{Math.round(loadingProgress)}<small>%</small></div>
            <strong>正在载入数字展车</strong>
            <div className="loading-card__track"><span style={{ width: `${Math.max(4, loadingProgress)}%` }} /></div>
            <small>32.3 MB 模型 · 已启用预加载与缓存复用</small>
          </div>
        )}

        {notice && <div className="notice">{notice}</div>}

        <div className="control-deck">
          <section className="vehicle-quickbar" aria-label="车辆快捷控制">
            <div className="deck-heading">
              <span>QUICK CONTROL</span>
              <strong>四车窗控制 · 点击按钮 = 全开/全关</strong>
            </div>
            <div className="vehicle-buttons vehicle-buttons--windows">
              {WINDOW_TARGETS.map((target) => {
                const progress = windowProgress.get(target) ?? 0
                const active = progress >= 1
                const enable = { type: 'window' as const, target, open: true, progress: 100 }
                const disable = { type: 'window' as const, target, open: false, progress: 0 }
                return (
                  <div className="window-control" key={target}>
                    <button
                      className={`window-control__toggle${active ? ' active' : ''}`}
                      disabled={modelStatus !== 'ready'}
                      onClick={() => runVehicleAction(active ? disable : enable)}
                      aria-pressed={active}
                      title={active ? `点击关闭 ${WINDOW_LABELS[target]}` : `点击打开 ${WINDOW_LABELS[target]}`}
                    >
                      <span aria-hidden="true" />
                      {WINDOW_LABELS[target]}
                      <small>{progress}%</small>
                    </button>
                    <div
                      className="window-control__track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                      aria-label={`${WINDOW_LABELS[target]} 开启进度`}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="deck-heading" style={{ marginTop: 12 }}>
              <span>BULK / PARTS</span>
              <strong>批量车窗 + 后备箱 + 灯光</strong>
            </div>
            <div className="vehicle-buttons">
              <button
                className="window-control__toggle bulk"
                disabled={modelStatus !== 'ready'}
                onClick={() => runVehicleAction({ type: 'window', target: 'all', open: true, progress: 100 })}
                title="一键开启全部车窗"
              >
                <span aria-hidden="true" />
                全部开窗
              </button>
              <button
                className="window-control__toggle bulk"
                disabled={modelStatus !== 'ready'}
                onClick={() => runVehicleAction({ type: 'window', target: 'all', open: false, progress: 0 })}
                title="一键关闭全部车窗"
              >
                <span aria-hidden="true" />
                全部关窗
              </button>
              {singleVehicleControls.map(({ id, label, enable, disable }) => {
                const active = id === 'trunk'
                  ? (trunkTargetOpen ?? trunkState === 'open')
                  : id === 'headlight' ? Boolean(headlightOn) : Boolean(taillightOn)
                return (
                  <button
                    key={id}
                    className={active ? 'active' : ''}
                    disabled={modelStatus !== 'ready'}
                    onClick={() => runVehicleAction(active ? disable : enable)}
                    aria-pressed={active}
                  >
                    <span aria-hidden="true" />
                    {label}
                    <small>{active ? 'ON' : 'OFF'}</small>
                  </button>
                )
              })}
            </div>
          </section>

          <nav className="camera-switcher" aria-label="镜头控制">
            {orbitButtons.map(({ preset, label }) => (
              <button
                className={activeOrbitPreset === preset ? 'active' : ''}
                key={preset}
                onClick={() => runOrbit(preset)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className={`interaction-drawer${isCommandDrawerOpen ? ' interaction-drawer--open' : ''}`}>
          <button
            className="interaction-drawer__handle"
            type="button"
            aria-expanded={isCommandDrawerOpen}
            aria-controls="command-drawer-content"
            onClick={() => setIsCommandDrawerOpen((open) => !open)}
          >
            <span aria-hidden="true">{isCommandDrawerOpen ? '⌄' : '⌃'}</span>
            文字 / 语音控制（支持具体进度，如：主驾车窗50%）
          </button>
          <div className="interaction-bar" id="command-drawer-content" aria-hidden={!isCommandDrawerOpen}>
            <form onSubmit={submitCommand}>
              <label htmlFor="camera-command">统一 VehicleAction 控制 · 支持 0-100% 进度</label>
              <div>
                <input
                  id="camera-command"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="试试：打开主驾车窗 / 副驾车窗30% / 全部车窗50% / 打开后备箱 / 开灯"
                  tabIndex={isCommandDrawerOpen ? 0 : -1}
                />
                <button
                  className={`voice-button${voiceState === 'listening' ? ' listening' : ''}`}
                  type="button"
                  disabled={voiceState === 'unsupported' || voiceState === 'denied'}
                  title={voiceState === 'unsupported' || voiceState === 'denied' ? '麦克风不可用，请使用文字或按钮' : '使用语音控制'}
                  aria-label={voiceState === 'listening' ? '停止语音识别' : '开始语音识别'}
                  onClick={toggleVoice}
                  tabIndex={isCommandDrawerOpen ? 0 : -1}
                >
                  {voiceState === 'listening' ? '●' : '🎙'}
                </button>
                <button type="submit" tabIndex={isCommandDrawerOpen ? 0 : -1}>执行</button>
              </div>
            </form>
            <p>{feedback}</p>
            <p className="interaction-bar__examples">
              示例：打开副驾车窗 · 主驾后窗70% · 全部车窗关闭 · 打开后备箱
            </p>
          </div>
        </div>
      </section>

      <footer className="legal-bar">
        <span>{import.meta.env.VITE_APP_UNOFFICIAL_DISCLAIMER || '非官方概念演示 | 模型：Ddiaz Design（Sketchfab CC BY-NC-SA 4.0）| 不代表小米官方'}</span>
        <span>
          来源：<a href={su7ConceptPack.attribution.sourceUrl} target="_blank" rel="noreferrer">Sketchfab</a>
          {' · '}
          <a href={su7ConceptPack.attribution.licenseUrl} target="_blank" rel="noreferrer">{su7ConceptPack.attribution.license}</a>
        </span>
      </footer>
    </main>
  )
}
