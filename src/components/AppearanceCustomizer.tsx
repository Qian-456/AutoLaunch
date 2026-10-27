import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { paintOptions, seatOptions, su7ConceptPack, type PaintOptionId, type SeatOptionId } from '../pack/su7-concept.pack'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  paint: PaintOptionId
  seats: SeatOptionId
  onPaintChange: (paint: PaintOptionId) => void
  onSeatsChange: (seats: SeatOptionId) => void
}

export function AppearanceCustomizer({ open, onOpenChange, paint, seats, onPaintChange, onSeatsChange }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const [pointerEntry, setPointerEntry] = useState(false)
  const selectedPaint = paintOptions.find((option) => option.id === paint)!
  const selectedSeats = seatOptions.find((option) => option.id === seats)!

  const close = () => { onOpenChange(false); trigger.current?.focus() }

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onOpenChange(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open, onOpenChange])

  return <div className="appearance-customizer" ref={root} onBlur={(event) => {
    if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) onOpenChange(false)
  }}>
    <button className="appearance-trigger" type="button" ref={trigger} aria-expanded={open} tabIndex={open ? -1 : 0}
      aria-controls="appearance-panel" aria-haspopup="dialog" onClick={(event) => {
        setPointerEntry(event.detail > 0)
        onOpenChange(!open)
      }}>
      <span className="appearance-trigger__swatch" style={{ backgroundColor: selectedPaint.color }} aria-hidden="true" />
      <span><strong>外观自定义</strong><small>{selectedPaint.label} · {selectedSeats.label}</small></span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={open ? 'm7 14 5-5 5 5' : 'm9 5 7 7-7 7'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>

    {open && <section className="appearance-panel" id="appearance-panel" ref={panel} role="dialog"
      aria-labelledby="appearance-title" data-pointer-entry={pointerEntry}>
      <header className="appearance-panel__heading">
        <div><p>2025 SU7 ULTRA</p><h2 id="appearance-title">定义你的搭配</h2></div>
        <button className="appearance-panel__close" type="button" onClick={close} aria-label="收起外观自定义">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </header>

      <div className="appearance-panel__body">
        <fieldset className="appearance-options appearance-options--paint">
          <legend>车身颜色 <span>官方车色参考</span></legend>
          <div>{paintOptions.map((option) => <button type="button" key={option.id} title={option.label}
            aria-label={`车漆：${option.label}`} aria-pressed={paint === option.id} onClick={() => onPaintChange(option.id)}>
            <span className="appearance-swatch" style={{ backgroundColor: option.color }} aria-hidden="true">
              {paint === option.id && <i>✓</i>}
            </span>
            <span>{option.label}</span>
          </button>)}</div>
        </fieldset>

        <fieldset className="appearance-options appearance-options--seats">
          <legend>座椅点缀 <span>演示自定义</span></legend>
          <div>{seatOptions.map((option) => <button type="button" key={option.id}
            aria-label={`座椅点缀：${option.label}`} aria-pressed={seats === option.id} onClick={() => onSeatsChange(option.id)}>
            <span className="appearance-seat-swatch" style={{ '--seat-accent': option.color } as CSSProperties} aria-hidden="true" />
            <span>{option.label}</span>
          </button>)}</div>
        </fieldset>

        <p className="appearance-panel__selection" role="status">当前搭配 <strong>{selectedPaint.label} · {selectedSeats.label}</strong></p>
        <p className="appearance-panel__note">车色为视觉近似，座椅保留现有模型造型。<a href={su7ConceptPack.appearance.reference.url} target="_blank" rel="noreferrer">查看官方参考 ↗</a></p>
      </div>

      <footer className="appearance-panel__footer">
        <button type="button" className="appearance-panel__reset" disabled={paint === 'original' && seats === 'yellow'}
          onClick={() => { onPaintChange('original'); onSeatsChange('yellow') }}>恢复默认</button>
        <button type="button" className="appearance-panel__done" onClick={close}>完成，继续看车</button>
      </footer>
    </section>}
  </div>
}
