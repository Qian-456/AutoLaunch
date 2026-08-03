import { Component, type ErrorInfo, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { Experience } from './components/Experience'
import { su7ConceptPack } from './pack/su7-concept.pack'
import { parseCommand } from './runtime/command-parser'
import { dispatchVehicleAction } from './runtime/action-dispatcher'
import { createBrowserSpeechRecognition, type BrowserSpeechRecognition } from './runtime/browser-speech'
import { useExperienceStore } from './store/experience-store'
import type { OrbitPreset, VehicleAction } from './types'

const orbitButtons: Array<{ preset: OrbitPreset; label: string }> = [
  { preset: 'hero_front_left', label: '参考图视角' },
  { preset: 'front', label: '正面' },
  { preset: 'driver_side', label: '主驾侧' },
  { preset: 'rear_three_quarter', label: '车尾 3/4' },
  { preset: 'turntable', label: '360° 环绕' },
]

const vehicleButtons: Array<{ label: string; action: Exclude<VehicleAction, { type: 'orbit' }> }> = [
  { label: '打开车窗', action: { type: 'window', target: 'driver_front', open: true } },
  { label: '关闭车窗', action: { type: 'window', target: 'driver_front', open: false } },
  { label: '打开后备箱', action: { type: 'trunk', open: true } },
  { label: '关闭后备箱', action: { type: 'trunk', open: false } },
  { label: '开启大灯', action: { type: 'lights', target: 'headlight', on: true } },
  { label: '关闭大灯', action: { type: 'lights', target: 'headlight', on: false } },
  { label: '开启尾灯', action: { type: 'lights', target: 'taillight', on: true } },
  { label: '关闭尾灯', action: { type: 'lights', target: 'taillight', on: false } },
]

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
  const [feedback, setFeedback] = useState('拖动车身区域可自由旋转 · 滚轮缩放')
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const modelStatus = useExperienceStore((state) => state.modelStatus)
  const activeOrbitPreset = useExperienceStore((state) => state.activeOrbitPreset)
  const notice = useExperienceStore((state) => state.notice)
  const voiceState = useExperienceStore((state) => state.inputMode.voice)
  const windowState = useExperienceStore((state) => state.vehiclePartStates.get('window_driver_front'))
  const trunkState = useExperienceStore((state) => state.vehiclePartStates.get('trunk'))
  const headlightOn = useExperienceStore((state) => state.lightStates.get('headlight'))
  const taillightOn = useExperienceStore((state) => state.lightStates.get('taillight'))
  const setVoiceState = useExperienceStore((state) => state.setVoiceState)

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
            <h1>2025 SU7 ULTRA</h1>
          </div>
        </div>
        <div className={`model-state model-state--${modelStatus}`}>
          <span />
          {modelStatus === 'ready' ? '3D MODEL ONLINE' : modelStatus === 'error' ? 'MODEL ERROR' : 'LOADING 3D MODEL'}
        </div>
      </header>

      <section className="stage" aria-label="SU7 Ultra 三维交互展示">
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
          <p>可注册镜头动作 · 确定性 3D 执行</p>
        </div>

        {modelStatus === 'loading' && (
          <div className="loading-card" role="status">
            <span className="loader" />
            <strong>正在载入 2025 SU7 Ultra</strong>
            <small>首次加载约 34 MB</small>
          </div>
        )}

        {notice && <div className="notice">{notice}</div>}

        <aside className="vehicle-panel">
          <p>VEHICLE ACTIONS</p>
          <h2>车辆控制</h2>
          <div className="vehicle-buttons">
            {vehicleButtons.map(({ label, action }) => {
              const active = action.type === 'window'
                ? windowState === (action.open ? 'open' : 'closed')
                : action.type === 'trunk'
                  ? trunkState === (action.open ? 'open' : 'closed')
                  : (action.target === 'headlight' ? headlightOn : taillightOn) === action.on
              return (
                <button
                  className={active ? 'active' : ''}
                  disabled={modelStatus !== 'ready'}
                  key={label}
                  onClick={() => runVehicleAction(action)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </aside>

        <aside className="camera-panel">
          <p>ORBIT ACTIONS</p>
          <h2>镜头控制</h2>
          <div className="camera-buttons">
            {orbitButtons.map(({ preset, label }, index) => (
              <button
                className={activeOrbitPreset === preset ? 'active' : ''}
                key={preset}
                onClick={() => runOrbit(preset)}
              >
                <span>0{index + 1}</span>{label}
              </button>
            ))}
          </div>
        </aside>

        <div className={`interaction-drawer${isCommandDrawerOpen ? ' interaction-drawer--open' : ''}`}>
          <button
            className="interaction-drawer__handle"
            type="button"
            aria-expanded={isCommandDrawerOpen}
            aria-controls="command-drawer-content"
            onClick={() => setIsCommandDrawerOpen((open) => !open)}
          >
            <span aria-hidden="true">{isCommandDrawerOpen ? '⌄' : '⌃'}</span>
            文字 / 语音控制
          </button>
          <div className="interaction-bar" id="command-drawer-content" aria-hidden={!isCommandDrawerOpen}>
            <form onSubmit={submitCommand}>
              <label htmlFor="camera-command">统一 VehicleAction 控制</label>
              <div>
                <input
                  id="camera-command"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="试试：打开主驾车窗 / 打开后备箱 / 开灯"
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
