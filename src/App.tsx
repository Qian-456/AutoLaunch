import { Component, type CSSProperties, type ErrorInfo, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { Experience } from './components/Experience'
import { LaunchPlayer } from './components/LaunchPlayer'
import { DOOR_LABELS, DOOR_TARGETS, su7ConceptPack, WINDOW_LABELS, WINDOW_TARGETS } from './pack/su7-concept.pack'
import { routeInput } from './runtime/input-router'
import { AiPanel, type AiPanelHandle } from './components/AiPanel'
import { dispatchVehicleAction } from './runtime/action-dispatcher'
import { createBrowserSpeechRecognition, type BrowserSpeechRecognition } from './runtime/browser-speech'
import { useExperienceStore } from './store/experience-store'
import { buildSiteTitle } from './runtime/site-title'
import type { OrbitPreset, VehicleAction, WindowTarget } from './types'
import { propCatalog, type PropId } from './props/prop-catalog'
import { preloadCargoProps } from './components/PropDisplay'

const orbitButtons: Array<{ preset: OrbitPreset; label: string }> = [
  { preset: 'hero_front_left', label: '主视觉' },
  { preset: 'front', label: '前脸' },
  { preset: 'driver_side', label: '主驾侧' },
  { preset: 'rear_three_quarter', label: '车尾' },
  { preset: 'cargo_rear', label: '装载' },
  { preset: 'cargo_overview', label: '容量俯视' },
  { preset: 'turntable', label: '自动运镜' },
]

const commandExamples = ['打开主驾车窗', '打开主驾车门', '全部车门打开', '打开前备箱', '打开后备箱', '开灯'] as const

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
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false)
  const [isPropWarehouseOpen, setIsPropWarehouseOpen] = useState(false)
  const [propLoadError, setPropLoadError] = useState<PropId | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [feedback, setFeedback] = useState('拖动车身区域可自由旋转 · 滚轮缩放 · 文字可输入：主驾车窗50%')
  const { progress: loadingProgress } = useProgress()
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const aiRef = useRef<AiPanelHandle>(null)
  const playback = useExperienceStore((s) => s.playback)
  const playbackScript = useExperienceStore((s) => s.playbackScript)
  const showTakeoverPrompt = useExperienceStore((s) => s.showTakeoverPrompt)
  const aiEnabled = import.meta.env.VITE_ENABLE_AI_PANELS !== '0'

  useEffect(() => {
    // Dual guard: Vite replaces %VITE_APP_SITE_TITLE% in index.html at build time,
    // but this runtime assignment guarantees a Chinese-bearing title even if the
    // static replacement is skipped (e.g. raw-static hosting, non-Vite proxy).
    document.title = buildSiteTitle()
  }, [])

  useEffect(() => {
    // Decode the two local luggage assets while the initial vehicle view is idle,
    // instead of blocking the first "demo combination" click with both GLBs.
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(preloadCargoProps, { timeout: 2500 })
      return () => idleWindow.cancelIdleCallback?.(handle)
    }
    const handle = window.setTimeout(preloadCargoProps, 600)
    return () => window.clearTimeout(handle)
  }, [])
  const modelStatus = useExperienceStore((state) => state.modelStatus)
  const stageMode = useExperienceStore((state) => state.stageMode)
  const activeOrbitPreset = useExperienceStore((state) => state.activeOrbitPreset)
  const manualOrbit = useExperienceStore((state) => state.manualOrbit)
  const notice = useExperienceStore((state) => state.notice)
  const voiceState = useExperienceStore((state) => state.inputMode.voice)
  const windowProgress = useExperienceStore((state) => state.windowProgress)
  const trunkState = useExperienceStore((state) => state.vehiclePartStates.get('trunk'))
  const frunkState = useExperienceStore((state) => state.vehiclePartStates.get('hatch_front'))
  const vehiclePartStates = useExperienceStore((state) => state.vehiclePartStates)
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
  const cargoPlacements = useExperienceStore((state) => state.cargoPlacements)
  const cargoPlacementSession = useExperienceStore((state) => state.cargoPlacementSession)
  const setVoiceState = useExperienceStore((state) => state.setVoiceState)
  const setStageMode = useExperienceStore((state) => state.setStageMode)

  const handlePropLoadError = useCallback((assetId: string) => {
    if (assetId !== 'carry_on_20' && assetId !== 'checked_24') return
    setPropLoadError(assetId)
    setFeedback('道具加载失败，车辆展示与控制不受影响')
  }, [])

  const addProp = useCallback((id: PropId) => {
    setPropLoadError(null)
    if (useExperienceStore.getState().stageMode === 'launch') useExperienceStore.getState().setStageMode('studio')
    const result = dispatchVehicleAction({ type: 'cargo', operation: 'spawn', propId: id })
    setFeedback(result.message)
  }, [])

  const runOrbit = useCallback((preset: OrbitPreset) => {
    if (useExperienceStore.getState().stageMode === 'launch') {
      useExperienceStore.getState().setStageMode('studio')
    }
    const result = dispatchVehicleAction({ type: 'orbit', preset })
    setFeedback(result.message)
  }, [])

  const runVehicleAction = useCallback((action: Exclude<VehicleAction, { type: 'orbit' }>) => {
    if (useExperienceStore.getState().stageMode === 'launch') {
      useExperienceStore.getState().setStageMode('studio')
    }
    const result = dispatchVehicleAction(action)
    setFeedback(result.message)
  }, [])

  const runCargoAction = useCallback((action: Extract<VehicleAction, { type: 'cargo' }>) => {
    if (useExperienceStore.getState().stageMode === 'launch') useExperienceStore.getState().setStageMode('studio')
    const result = dispatchVehicleAction(action)
    setFeedback(result.message)
  }, [])

  const closePropWarehouse = useCallback(() => {
    if (useExperienceStore.getState().cargoPlacementSession) {
      const cancelled = dispatchVehicleAction({ type: 'cargo', operation: 'cancel' })
      setFeedback(cancelled.message)
    }
    setIsPropWarehouseOpen(false)
  }, [])

  const runCommandText = useCallback((text: string, clearAfter = false) => {
    const parsed = routeInput(text)
    if (parsed.kind === 'requirement') {
      if (aiRef.current) aiRef.current.submitRequirement(text)
      else setFeedback('请尝试直接指令：打开主驾车窗、打开后备箱、开灯')
      return
    }
    if (useExperienceStore.getState().stageMode === 'launch') {
      useExperienceStore.getState().setStageMode('studio')
    }
    const result = dispatchVehicleAction(parsed.action)
    setFeedback(result.message)
    if (clearAfter) setCommand('')
  }, [])

  const toggleLaunchMode = useCallback(() => {
    const state = useExperienceStore.getState()
    if (state.playback === 'playing') {
      state.interruptPlayback(); state.keepManual()
      setFeedback('发布会已停止，控制权已交还给您')
    } else if (state.playback === 'paused') state.resumePlayback()
    else {
      setIsControlPanelOpen(false); setIsCommandDrawerOpen(false); setIsPropWarehouseOpen(false)
      state.playScript(su7ConceptPack.recordingScript)
    }
  }, [])

  const finishLaunch = useCallback(() => {
    useExperienceStore.getState().finishPlayback()
    setFeedback('发布会演示完成，您可以继续自由体验车辆')
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      setFeedback('浏览器未允许切换全屏，请检查浏览器权限后重试')
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (stageMode === 'launch' && manualOrbit) {
      setFeedback('您已接管发布会；只有显式恢复才会继续')
    }
  }, [manualOrbit, stageMode])

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
      if (finalTranscript.trim()) runCommandText(finalTranscript)
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
    <main className={`app-shell${aiEnabled ? ' app-shell--ai' : ''}${isFullscreen && stageMode === 'launch' ? ' app-shell--launch-fullscreen' : ''}${isFullscreen && stageMode === 'launch' && manualOrbit ? ' app-shell--manual-orbit' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p>AUTOLAUNCH / PRODUCT VIEW</p>
            <h1>2025 SU7 ULTRA · 交互式数字展车</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className={`stage-mode-button${stageMode === 'launch' ? ' active' : ''}`}
            type="button"
            disabled={modelStatus !== 'ready'}
            onClick={toggleLaunchMode}
          >
            <span aria-hidden="true" />
            {playback === 'playing' ? '停止发布会' : playback === 'paused' ? '恢复发布会' : '开启发布会'}
          </button>
          <button className="fullscreen-button" type="button" onClick={toggleFullscreen}>
            {isFullscreen ? '退出全屏' : '全屏浏览'}
          </button>
          <div className={`model-state model-state--${modelStatus}`}>
            <span />
            {modelStatus === 'ready' ? '3D READY' : modelStatus === 'error' ? 'MODEL ERROR' : `${Math.round(loadingProgress)}% LOADING`}
          </div>
        </div>
      </header>

      <section className={`stage stage--${stageMode}${isCommandDrawerOpen ? ' stage--command-open' : ''}${isControlPanelOpen || isPropWarehouseOpen ? ' stage--controls-open' : ''}`} aria-label="SU7 Ultra 三维交互展示">
        <SceneErrorBoundary>
          <Canvas
            shadows
            dpr={[1, 1.5]}
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
            <Experience
              onPropLoadError={handlePropLoadError}
              onCargoFeedback={setFeedback}
            />
          </Canvas>
        </SceneErrorBoundary>

        <div className="hero-copy">
          <p className="eyebrow">PERFORMANCE, REFRAMED</p>
          <p>点击真实车窗直接开合 · 拖动镜头自由观察</p>
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

        <LaunchPlayer
          active={playback === 'playing' && modelStatus === 'ready'}
          onFinished={finishLaunch}
          script={playbackScript ?? su7ConceptPack.recordingScript}
        />

        {showTakeoverPrompt && <div className="takeover-prompt" role="status">
          <span>已接管自动发布会</span>
          <button onClick={() => useExperienceStore.getState().resumePlayback()}>恢复自动发布会</button>
          <button onClick={() => useExperienceStore.getState().keepManual()}>保持手动控制</button>
        </div>}

        <div className="control-deck">
          <button
            className={`control-deck__launcher${isControlPanelOpen ? ' active' : ''}`}
            type="button"
            aria-expanded={isControlPanelOpen}
            onClick={() => {
              setIsControlPanelOpen((open) => !open)
              setIsPropWarehouseOpen(false)
              setIsCommandDrawerOpen(false)
            }}
          >
            {isControlPanelOpen ? '收起控制' : '车辆控制'}
          </button>
          <section className={`vehicle-quickbar${isControlPanelOpen ? ' vehicle-quickbar--open' : ''}`} aria-label="车辆控制" aria-hidden={!isControlPanelOpen}>
            <div className="deck-heading">
              <span>车窗</span>
              <strong>也可以直接点击车上的玻璃</strong>
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
              <span>车门与前备箱</span>
              <strong>真实外门皮 · 独立铰链</strong>
            </div>
            <div className="vehicle-buttons">
              {DOOR_TARGETS.map((target) => {
                const active = vehiclePartStates.get(`door_${target}`) === 'open'
                return (
                  <button
                    key={target}
                    className={active ? 'active' : ''}
                    disabled={modelStatus !== 'ready'}
                    onClick={() => runVehicleAction({ type: 'door', target, open: !active, progress: active ? 0 : 100 })}
                    aria-pressed={active}
                  >
                    <span aria-hidden="true" />
                    {DOOR_LABELS[target]}
                    <small>{active ? 'OPEN' : 'CLOSED'}</small>
                  </button>
                )
              })}
              <button
                disabled={modelStatus !== 'ready'}
                onClick={() => runVehicleAction({ type: 'door', target: 'all', open: true, progress: 100 })}
              >全部开门</button>
              <button
                disabled={modelStatus !== 'ready'}
                onClick={() => runVehicleAction({ type: 'door', target: 'all', open: false, progress: 0 })}
              >全部关门</button>
              <button
                className={frunkState === 'open' ? 'active' : ''}
                disabled={modelStatus !== 'ready'}
                onClick={() => runVehicleAction({ type: 'trunk', frunk: true, open: frunkState !== 'open' })}
                aria-pressed={frunkState === 'open'}
              >
                <span aria-hidden="true" />
                前备箱
                <small>{frunkState === 'open' ? 'OPEN' : 'CLOSED'}</small>
              </button>
            </div>
            <div className="deck-heading" style={{ marginTop: 12 }}>
              <span>其他部件</span>
              <strong>批量车窗 · 尾门 · 灯光</strong>
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

          <button
            className={`prop-warehouse__launcher${isPropWarehouseOpen ? ' active' : ''}`}
            type="button"
            aria-expanded={isPropWarehouseOpen}
            aria-controls="prop-warehouse-panel"
            onClick={() => {
              if (isPropWarehouseOpen) {
                closePropWarehouse()
              } else {
                setIsPropWarehouseOpen(true)
                runOrbit('cargo_rear')
              }
              setIsControlPanelOpen(false)
            }}
          >
            道具仓库
            {(cargoPlacementSession || cargoPlacements.size > 0) && <span aria-label={`当前已放置 ${cargoPlacements.size} 件`} />}
          </button>

          <section
            className={`prop-warehouse${isPropWarehouseOpen ? ' prop-warehouse--open' : ''}`}
            id="prop-warehouse-panel"
            aria-label="道具仓库"
            aria-hidden={!isPropWarehouseOpen}
          >
            <div className="prop-warehouse__heading">
              <div>
                <span>PROP LIBRARY</span>
                <h2>行李道具</h2>
              </div>
              <button className="prop-warehouse__close" type="button" onClick={closePropWarehouse} aria-label="收起道具仓库">× 收起</button>
            </div>
            <p className="prop-warehouse__summary">当前 {cargoPlacements.size} 件 · 场景安全上限 {su7ConceptPack.cargoVolume.collider.maxInstances} 件 · 实际容量取决于尺寸与姿态</p>
            <button
              className="prop-warehouse__demo"
              type="button"
              onClick={() => runCargoAction({ type: 'cargo', operation: 'demonstrate', combinationId: 'two_suitcases' })}
            >
              演示 20 寸 + 24 寸组合装载
            </button>
            <div className="prop-warehouse__grid">
              {propCatalog.map((entry) => {
                const failed = propLoadError === entry.id
                const count = [...cargoPlacements.values()].filter((placement) => placement.catalogPropId === entry.id && placement.state !== 'returning').length
                const [height, width, depth] = entry.dimensionsM.map((value) => {
                  const centimetres = value * 100
                  return Number.isInteger(centimetres) ? String(centimetres) : centimetres.toFixed(1)
                })
                return (
                  <article className={`prop-card${failed ? ' failed' : ''}`} key={entry.id}>
                    <div className="prop-card__swatch" style={{ '--prop-color': entry.previewColor } as CSSProperties}>
                      <span aria-hidden="true" />
                    </div>
                    <div className="prop-card__copy">
                      <strong>{entry.name}</strong>
                      <small>{height} × {width} × {depth} cm</small>
                      <span>场景内 {count} 件</span>
                    </div>
                    <div className="prop-card__actions">
                      <button type="button" disabled={cargoPlacements.size >= su7ConceptPack.cargoVolume.collider.maxInstances} onClick={() => addProp(entry.id)}>
                        {failed ? '重试' : '＋ 添加'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
            {cargoPlacements.size > 0 && (
              <div className="cargo-capacity-status">
                <strong>{cargoPlacements.size >= 2 ? '20 寸 + 24 寸可同时放入' : '已占用实际物品外廓，剩余空间仍可继续判断'}</strong>
                <span>示意布局，非官方测量结果</span>
              </div>
            )}
            {cargoPlacements.size > 0 && (
              <button className="prop-warehouse__clear" type="button" onClick={() => runCargoAction({ type: 'cargo', operation: 'clear' })}>
                ↩ 收回场景内全部道具
              </button>
            )}
            <details className="prop-warehouse__details">
              <summary>尺寸、操作与素材许可</summary>
              <p>滚轮或 Q/E 旋转 · R 切换姿态 · 右键拖动镜头 · Shift 关闭磁吸 · Esc 取消。道具由 AutoLaunch Contributors 原创，CC BY-NC-SA 4.0。</p>
            </details>
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
            onClick={() => {
              setIsCommandDrawerOpen((open) => !open)
              setIsControlPanelOpen(false)
              setIsPropWarehouseOpen(false)
            }}
          >
            <span aria-hidden="true">{isCommandDrawerOpen ? '⌄' : '⌃'}</span>
            文字 / 语音
          </button>
          <div className="interaction-bar" id="command-drawer-content" aria-hidden={!isCommandDrawerOpen}>
            <form onSubmit={submitCommand}>
              <label htmlFor="camera-command">输入车辆指令</label>
              <div>
                <input
                  id="camera-command"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="例如：主驾车窗50% / 打开后备箱 / 开灯"
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
                  {voiceState === 'listening' ? '● 识别中' : '🎙 语音'}
                </button>
                <button type="submit" tabIndex={isCommandDrawerOpen ? 0 : -1}>执行</button>
              </div>
              <div className="command-examples" aria-label="示例指令">
                {commandExamples.map((example) => (
                  <button key={example} type="button" onClick={() => runCommandText(example)} tabIndex={isCommandDrawerOpen ? 0 : -1}>
                    {example}
                  </button>
                ))}
              </div>
            </form>
            <p>{feedback}</p>
          </div>
        </div>
      </section>

      {aiEnabled && <AiPanel ref={aiRef} onFeedback={setFeedback} />}

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
