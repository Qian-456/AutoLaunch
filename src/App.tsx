import { Component, type ErrorInfo, type FormEvent, type ReactNode, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { Experience } from './components/Experience'
import { su7ConceptPack } from './pack/su7-concept.pack'
import { parseCommand } from './runtime/command-parser'
import { dispatchVehicleAction } from './runtime/action-dispatcher'
import { useExperienceStore } from './store/experience-store'
import type { OrbitPreset } from './types'

const orbitButtons: Array<{ preset: OrbitPreset; label: string }> = [
  { preset: 'hero_front_left', label: '参考图视角' },
  { preset: 'front', label: '正面' },
  { preset: 'driver_side', label: '主驾侧' },
  { preset: 'rear_three_quarter', label: '车尾 3/4' },
  { preset: 'turntable', label: '360° 环绕' },
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
  const modelStatus = useExperienceStore((state) => state.modelStatus)
  const activeOrbitPreset = useExperienceStore((state) => state.activeOrbitPreset)
  const notice = useExperienceStore((state) => state.notice)

  const runOrbit = (preset: OrbitPreset) => {
    const result = dispatchVehicleAction({ type: 'orbit', preset })
    setFeedback(result.message)
  }

  const submitCommand = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseCommand(command)
    if (!parsed.matched) {
      setFeedback(parsed.suggestion)
      return
    }
    const result = dispatchVehicleAction(parsed.action)
    setFeedback(result.message)
    setCommand('')
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
            文字控制
          </button>
          <div className="interaction-bar" id="command-drawer-content" aria-hidden={!isCommandDrawerOpen}>
            <form onSubmit={submitCommand}>
              <label htmlFor="camera-command">文字控制 OrbitAction</label>
              <div>
                <input
                  id="camera-command"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="试试：参考图视角 / 看侧面 / 旋转一圈"
                  tabIndex={isCommandDrawerOpen ? 0 : -1}
                />
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
