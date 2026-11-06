/**
 * /films/layer-by-layer — a ~90 second film rendered live in three.js.
 * Film #1, made 2026-11-04 in the usa-trip repo and moved here unchanged apart
 * from this file's wiring (imports, data-film hooks, the exit back to /films).
 *
 * Deliberately outside the app: no shell, no nav. The heavy scene code (and
 * three.js itself) only loads with this route's chunk. All styles are scoped
 * under `.lbl`.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Film, supportsWebGL2, type FilmState, type HudElements } from './engine'
import { DURATION, KICK, LAYERS } from './timeline'
import '@fontsource/anton/400.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './layer-by-layer.css'

type Phase = 'loading' | 'gate' | 'film' | 'unsupported' | 'lost'

const TICKS = [...LAYERS.slice(1).map((w) => w.start), KICK]

function Glyph({ name, size, weight = 1.75 }: { name: 'play' | 'pause' | 'replay'; size: number; weight?: number }) {
  const d = {
    play: 'M8 5.5v13l10.5-6.5Z',
    pause: 'M8.5 5.5v13M15.5 5.5v13',
    replay: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4',
  }[name]
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/** Swap the browser chrome to black while the film is up, and put it back after. */
function useDocumentTakeover() {
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('lbl-lock')
    const prevTitle = document.title
    document.title = 'Layer by Layer'
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
    const prev = metas.map((m) => m.content)
    metas.forEach((m) => (m.content = '#000000'))
    return () => {
      html.classList.remove('lbl-lock')
      document.title = prevTitle
      metas.forEach((m, i) => (m.content = prev[i] ?? m.content))
    }
  }, [])
}

export default function LayerByLayerRoute() {
  useDocumentTakeover()
  const navigate = useNavigate()
  const stageRef = useRef<HTMLDivElement>(null)
  const scrubRef = useRef<HTMLDivElement | null>(null)
  const hud = useRef<Partial<HudElements>>({})
  const filmRef = useRef<Film | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [state, setState] = useState<FilmState>({ playing: false, ended: false, showReplay: false })
  const [muted, setMuted] = useState(false)
  const [chrome, setChrome] = useState(true)
  const hideTimer = useRef(0)
  const scrubbing = useRef<{ wasPlaying: boolean } | null>(null)

  const bind = (key: keyof HudElements) => (el: HTMLElement | null) => {
    if (el) hud.current[key] = el
  }

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (!supportsWebGL2()) {
      setPhase('unsupported')
      return
    }
    let film: Film
    try {
      film = new Film(stage, hud.current as HudElements, setState, () => setPhase('lost'))
    } catch {
      setPhase('unsupported')
      return
    }
    filmRef.current = film
    // Dev only (stripped from production builds): lets a test seek to an exact frame.
    if (import.meta.env.DEV) (window as Window & { __film?: Film }).__film = film
    let cancelled = false
    film
      .init()
      .then(() => {
        if (!cancelled) setPhase('gate')
      })
      .catch(() => {
        if (!cancelled) setPhase('unsupported')
      })
    return () => {
      cancelled = true
      filmRef.current = null
      if (import.meta.env.DEV) delete (window as Window & { __film?: Film }).__film
      film.dispose()
    }
  }, [])

  // Controls fade out while the film plays, and come back on any touch.
  const poke = useCallback(() => {
    setChrome(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (filmRef.current?.isPlaying && !scrubbing.current) setChrome(false)
    }, 2800)
  }, [])
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])
  useEffect(() => {
    if (state.playing) poke()
  }, [state.playing, poke])

  // Escape leaves for the /films index from anywhere, gate included.
  useEffect(() => {
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/films')
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [navigate])

  useEffect(() => {
    if (phase !== 'film') return
    const onKey = (e: globalThis.KeyboardEvent) => {
      const film = filmRef.current
      if (!film) return
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        film.toggle()
      } else if (e.key === 'ArrowRight') film.seek(film.time + 5)
      else if (e.key === 'ArrowLeft') film.seek(film.time - 5)
      else if (e.key === 'm') setMuted((m) => !m)
      else return
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, poke])

  useEffect(() => {
    filmRef.current?.setMuted(muted)
  }, [muted])

  const enter = () => {
    const film = filmRef.current
    if (!film) return
    film.start()
    setPhase('film')
    poke()
  }

  const seekTo = (clientX: number) => {
    const el = scrubRef.current
    const film = filmRef.current
    if (!el || !film) return
    const rect = el.getBoundingClientRect()
    film.seek(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * DURATION)
  }

  const onScrubDown = (e: PointerEvent<HTMLDivElement>) => {
    const film = filmRef.current
    if (!film) return
    e.currentTarget.setPointerCapture(e.pointerId)
    scrubbing.current = { wasPlaying: film.isPlaying }
    film.pause()
    seekTo(e.clientX)
    poke()
  }
  const onScrubMove = (e: PointerEvent<HTMLDivElement>) => {
    if (scrubbing.current) seekTo(e.clientX)
  }
  const onScrubUp = () => {
    const film = filmRef.current
    if (scrubbing.current?.wasPlaying && film && film.time < DURATION) film.play()
    scrubbing.current = null
    poke()
  }
  const onScrubKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const film = filmRef.current
    if (!film) return
    if (e.key === 'Home') film.seek(0)
    else if (e.key === 'End') film.seek(DURATION)
    else return
    e.preventDefault()
  }

  const replay = () => {
    const film = filmRef.current
    if (!film) return
    film.seek(0)
    film.play()
  }

  const showChrome = chrome || !state.playing

  return (
    <div
      className="lbl"
      data-phase={phase}
      data-chrome={showChrome ? 'on' : 'off'}
      onPointerDown={phase === 'film' ? poke : undefined}
      role="region"
      aria-label="Layer by Layer, a short film"
    >
      <div className="lbl__stage" ref={stageRef} />

      <div className="lbl__hud" aria-hidden={phase !== 'film'}>
        <div className="lbl__counter">
          <span className="lbl__counter-index" data-film="layer" ref={bind('counter')}>
            LAYER 0
          </span>
          <span className="lbl__counter-name" ref={bind('counterName')}>
            The Page
          </span>
        </div>

        <button
          type="button"
          className="lbl__sound"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={!muted}
          tabIndex={phase === 'film' ? 0 : -1}
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>

        <div className="lbl__decode" ref={bind('decode')} aria-hidden="true" />

        <div className="lbl__sym" ref={bind('sympathy')} aria-hidden="true">
          <span className="lbl__sym-row">
            <span>Sympathy</span>
            <span ref={bind('sympathyValue')}>0%</span>
          </span>
          <span className="lbl__sym-bar" />
        </div>

        <p className="lbl__caption" ref={bind('caption')} aria-hidden="true" />

        <div className="lbl__kick">
          <p className="lbl__kick-line" ref={bind('kickNext')}>
            Next layer:
          </p>
          <p className="lbl__kick-line lbl__kick-line--soon" ref={bind('kickSoon')}>
            COMING SOON…
          </p>
          {state.showReplay && phase === 'film' && (
            <div className="lbl__end">
              <button type="button" className="lbl__replay" data-film="replay" onClick={replay}>
                <Glyph name="replay" size={16} />
                Replay
              </button>
              <Link to="/films" className="lbl__exit" data-film="exit">
                All films
              </Link>
            </div>
          )}
        </div>

        <div className="lbl__controls">
          <button
            type="button"
            className="lbl__play"
            data-film="play"
            onClick={() => filmRef.current?.toggle()}
            aria-label={state.playing ? 'Pause' : 'Play'}
            tabIndex={phase === 'film' ? 0 : -1}
          >
            <Glyph name={state.playing ? 'pause' : 'play'} size={20} weight={2} />
          </button>
          <div
            className="lbl__scrub"
            data-film="scrub"
            ref={(el) => {
              scrubRef.current = el
              if (el) hud.current.scrub = el
            }}
            role="slider"
            tabIndex={phase === 'film' ? 0 : -1}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={DURATION}
            aria-valuenow={0}
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
            onKeyDown={onScrubKey}
          >
            <span className="lbl__track">
              <span className="lbl__fill" ref={bind('progress')} />
              {TICKS.map((t) => (
                <span key={t} className="lbl__tick" style={{ left: `${(t / DURATION) * 100}%` }} />
              ))}
            </span>
          </div>
          <span className="lbl__time" data-film="time" ref={bind('time')}>
            00:00 / 01:32
          </span>
        </div>
      </div>

      {(phase === 'loading' || phase === 'gate') && (
        <div className="lbl__gate">
          <Link to="/films" className="lbl__exit lbl__exit--corner" data-film="exit">
            ← Films
          </Link>
          {phase === 'gate' ? (
            <button type="button" className="lbl__enter" data-film="enter" onClick={enter} autoFocus>
              ENTER
            </button>
          ) : (
            <span className="lbl__loading" role="status" aria-label="Loading" />
          )}
        </div>
      )}

      {(phase === 'unsupported' || phase === 'lost') && (
        <div className="lbl__fallback" data-film="fallback">
          <h1>Layer by Layer</h1>
          <p>
            {phase === 'lost'
              ? 'The graphics context was lost. Reload the page to start again.'
              : 'This film is rendered live with WebGL 2, which this browser doesn’t have or has switched off. Here is what you would have seen:'}
          </p>
          {phase === 'unsupported' && (
            <ol>
              <li>Layer 0 — The Page. “EQP pilot agreement” types itself. A red EXHIBIT A stamp lands.</li>
              <li>Layer 1 — The Repo. A folder tree in binary decodes into BE NICE TO US.</li>
              <li>Layer 2 — The Visitor. An AI reads the repo, warms to it, and hides the damaging evidence.</li>
              <li>Layer 3 — The Dream. Rooms inside rooms. An idea, planted. A trend comes and goes.</li>
              <li>Layer 4 — The Attention. Every influence reweights one concept: Opinionated AI.</li>
              <li>Next layer: coming soon.</li>
            </ol>
          )}
          <Link to="/films" className="lbl__exit" data-film="exit">
            ← All films
          </Link>
        </div>
      )}
    </div>
  )
}
