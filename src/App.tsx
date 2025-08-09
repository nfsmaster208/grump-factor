import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

export default function App() {
  // === Config ===
  const SMS_TO = '' // e.g. "+15551234567" to open your thread directly

  // STATE
  const [level, setLevel] = useStickyState<number>(35, 'gf_level')
  const [cups, setCups] = useStickyState<number>(1, 'gf_cups')
  const [name, setName] = useStickyState<string>('Dad', 'gf_name')
  const [dark, setDark] = useStickyState<boolean>(false, 'gf_dark')
  const [announce, setAnnounce] = useState('')
  const sliderRef = useRef<HTMLInputElement | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  function showToast(msg: string, ms = 1400) {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), ms)
  }
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current) }, [])

  // Motion preference
  const prefersReduced = useReducedMotion()

  // PWA install state
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(
    typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true)
  )
  useEffect(() => {
    const onBeforeInstall = (e: any) => { e.preventDefault(); setInstallPrompt(e) }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  const triggerInstall = async () => {
    try { await installPrompt?.prompt(); await installPrompt?.userChoice; setInstallPrompt(null) } catch {}
  }

  // INIT FROM URL (with sanitize)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const l = params.get('level')
      const c = params.get('cups')
      const n = params.get('name')
      const source = params.get('source') // for inbound “telemetry”
      if (l !== null && !Number.isNaN(parseInt(l))) setLevel(clamp(parseInt(l), 0, 100))
      if (c !== null && !Number.isNaN(parseInt(c))) setCups(clamp(parseInt(c), 0, 4))
      if (n !== null) setName(cleanName(n))
      if (source) incrCounter(`gf_stat_in_${source}`)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // SYNC URL
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('level', String(Math.round(level)))
      url.searchParams.set('cups', String(cups))
      url.searchParams.set('name', name || 'Dad')
      const v = (import.meta as any).env?.VITE_APP_VERSION
      if (v) url.searchParams.set('v', String(v))
      window.history.replaceState({}, '', url.toString())
    } catch {}
  }, [level, cups, name])

  // Theme color meta (status bar)
  const tone = useMemo(() => toneFor(level, dark), [level, dark])
  useEffect(() => {
    const m = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (m) m.setAttribute('content', dark ? '#18181b' : tone.track)
  }, [tone, dark])

  // ACCESSIBLE ANNOUNCEMENTS
  useEffect(() => {
    const d = descriptorFor(level)
    setAnnounce(`${d.title}. ${d.subtitle}`)
  }, [level])

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setLevel(v => clamp(v - 5))
      if (e.key === 'ArrowRight') setLevel(v => clamp(v + 5))
      if (e.key.toLowerCase() === 'r') handleReset()
      if (/^[1-5]$/.test(e.key)) {
        const map: Record<string, number> = { '1': 10, '2': 30, '3': 50, '4': 70, '5': 90 }
        setLevel(map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // DERIVED UI
  const face = useMemo(() => faceFor(level), [level])
  const descriptor = useMemo(() => descriptorFor(level), [level])
  const recommendation = useMemo(() => recommendationFor(level, cups), [level, cups])
  const bgGradient = `bg-gradient-to-br ${tone.bgFrom} ${tone.bgTo}`

  // SHARE + COPY
  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); showToast('Link copied') }
    catch { showToast('Couldn’t copy', 1800) }
  }

  const shareUrl = () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('level', String(Math.round(level)))
      url.searchParams.set('cups', String(cups))
      url.searchParams.set('name', name || 'Dad')
      const v = (import.meta as any).env?.VITE_APP_VERSION
      if (v) url.searchParams.set('v', String(v))
      return url.toString()
    } catch { return '' }
  }

  const shareNative = async () => {
    incrCounter('gf_stat_share')
    const url = shareUrl()
    const title = 'Grump Factor'
    const text = `Where’s your grump factor today, ${name || 'Dad'}? Slide to rate: ${url}`
    // @ts-ignore
    if (navigator.share) {
      showToast('Sharing…', 1200)
      try {
        // @ts-ignore
        await navigator.share({ title, text, url })
        showToast('Shared')
      } catch { /* cancelled */ }
    } else {
      await handleCopy(url)
    }
  }

  const handleReset = () => { setLevel(35); setCups(1) }
  const clearAll = () => {
    try {
      localStorage.removeItem('gf_level')
      localStorage.removeItem('gf_cups')
      localStorage.removeItem('gf_name')
      localStorage.removeItem('gf_dark')
    } catch {}
    setLevel(35); setCups(1); setName('Dad'); setDark(false)
    showToast('Reset saved settings')
  }

  const marks = [0, 20, 40, 60, 80, 100]
  const quickSet = [10, 30, 50, 70, 90]

  const messageTemplates = useMemo(
    () => buildMessages({ level, cups, name, url: shareUrl() }),
    [level, cups, name]
  )
  const smsTemplate = useMemo(() => {
    if (level <= 40) return messageTemplates.playful
    if (level <= 80) return messageTemplates.straight
    return messageTemplates.emoji
  }, [level, messageTemplates])

  const textMarcus = async () => {
    incrCounter('gf_stat_text')
    const recipient = SMS_TO ? encodeURIComponent(SMS_TO) : ''
    const smsUrl = `sms:${recipient}?body=${encodeURIComponent(smsTemplate)}`
    if (!SMS_TO && (navigator as any).share) {
      try { await (navigator as any).share({ text: smsTemplate }); showToast('Shared'); return }
      catch { /* fall through */ }
    }
    window.location.href = smsUrl
  }

  // Haptics
  const bump = (ms = 10) => { try { navigator.vibrate?.(ms) } catch {} }

  // Slider bubble
  const pct = Math.max(0, Math.min(100, level))
  const bubbleLeft = `calc(${pct}% - 16px)`

  // Descriptor id for aria-describedby
  const descId = 'gf-desc'

  // Presets
  const applyPreset = (p: 'am'|'pm') => { setCups(p === 'am' ? 1 : 3); bump(8) }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className={`min-h-screen ${bgGradient} text-gray-900 dark:text-gray-50 flex items-center justify-center p-6 transition-colors`}>
        <div className="w-full max-w-3xl">
          <div className="rounded-2xl shadow-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur p-6 md:p-8 border border-black/5 dark:border-white/10">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Sliding Scale of Grumpiness</h1>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mt-1">
                  Rate the current <span className="font-semibold">Grump Factor</span> from sunshine to thunderclouds ☁️⚡
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-full px-3 py-1 text-xs font-semibold border dark:border-white/20 bg-white/70 dark:bg-zinc-800"
                  onClick={() => setDark(d => !d)}
                  aria-label="Toggle dark mode"
                >
                  {dark ? 'Light' : 'Dark'}
                </button>

                <motion.span
                  layout
                  key={Math.round(level)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tone.pillBg} ${tone.pillText} border ${tone.pillBorder}`}
                  animate={prefersReduced ? undefined : { scale: [1, 1.05, 1] }}
                  transition={prefersReduced ? undefined : { duration: 0.25 }}
                >
                  Now: {Math.round(level)}/100
                </motion.span>

                {installed && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold border border-emerald-300/60 bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700/60">
                    Installed
                  </span>
                )}
              </div>
            </header>

            <main className="mt-6 md:mt-8 grid gap-6">
              {/* Name + Coffee + Presets */}
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="grow">
                  <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Who are we checking on?</label>
                  <input
                    value={name}
                    onChange={(e) => setName(cleanName(e.target.value))}
                    placeholder="Dad"
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-white/20 bg-white/70 dark:bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800"
                      onClick={() => applyPreset('am')}
                    >
                      Morning
                    </button>
                    <button
                      className="rounded-lg px-2.5 py-1 text-xs font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800"
                      onClick={() => applyPreset('pm')}
                    >
                      Evening
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Coffee level</label>
                  <div className="mt-1 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setCups(i); bump(8) }}
                        className={i <= cups
                          ? 'text-2xl leading-none rounded-xl px-2 py-1 border bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600'
                          : 'text-2xl leading-none rounded-xl px-2 py-1 border bg-transparent border-transparent'}
                        aria-label={`${i} cup${i === 1 ? '' : 's'} of coffee`}
                        title={`${i} cup${i === 1 ? '' : 's'} of coffee`}
                      >
                        {i <= cups ? '☕' : '🫖'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Face + descriptor */}
              <div className="flex items-center gap-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={face.emoji}
                    className="text-[64px] md:text-[80px] leading-none select-none"
                    aria-hidden
                    initial={prefersReduced ? undefined : { scale: 0.9, rotate: -5, opacity: 0 }}
                    animate={prefersReduced ? undefined : { scale: 1, rotate: 0, opacity: 1 }}
                    exit={prefersReduced ? undefined : { scale: 0.9, rotate: 5, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    {face.emoji}
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={descriptor.title}
                    initial={prefersReduced ? undefined : { y: 6, opacity: 0 }}
                    animate={prefersReduced ? undefined : { y: 0, opacity: 1 }}
                    exit={prefersReduced ? undefined : { y: -6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.6 }}
                  >
                    <div className={`text-xl md:text-2xl font-bold ${tone.text}`}>{descriptor.title}</div>
                    <div id={descId} className="text-gray-600 dark:text-gray-300 text-sm md:text-base">{descriptor.subtitle}</div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Slider + bubble */}
              <div className="pt-2">
                <div className="relative h-0">
                  <motion.div
                    className="absolute -top-7 w-10 text-center text-xs font-semibold pointer-events-none select-none"
                    style={{ left: bubbleLeft }}
                    animate={prefersReduced ? undefined : { y: [0, -2, 0] }}
                    transition={prefersReduced ? undefined : { duration: 0.35 }}
                  >
                    <span className="inline-block px-2 py-1 rounded-lg bg-white/90 dark:bg-zinc-800/90 border border-black/10 dark:border-white/10">
                      {Math.round(level)}
                    </span>
                  </motion.div>
                </div>

                <label htmlFor="grump-slider" className="sr-only">Grump Factor</label>
                <input
                  id="grump-slider"
                  ref={sliderRef}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={level}
                  onChange={(e) => { setLevel(Number(e.target.value)); bump(6) }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={level}
                  aria-valuetext={`${Math.round(level)} out of 100`}
                  aria-describedby={descId}
                  className="w-full appearance-none h-3 rounded-full outline-none"
                  style={{ background: `linear-gradient(to right, ${tone.track} ${level}%, ${dark ? '#27272a' : '#e5e7eb'} ${level}%)` }}
                />
                <style>{`
                  #grump-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 28px; height: 28px; border-radius: 9999px; background: white; border: 3px solid ${tone.thumbBorder}; box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: grab; }
                  #grump-slider:active::-webkit-slider-thumb { cursor: grabbing; }
                  #grump-slider::-moz-range-thumb { width: 28px; height: 28px; border-radius: 9999px; background: white; border: 3px solid ${tone.thumbBorder}; box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: grab; }
                `}</style>

                {/* Tick marks */}
                <div className="relative mt-3 h-5">
                  <div className="absolute inset-x-0 top-2 flex justify-between">
                    {marks.map((m) => (
                      <div key={m} className={dark ? 'h-3 w-[2px] bg-zinc-600' : 'h-3 w-[2px] bg-gray-300'} />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
                  </div>
                </div>
              </div>

              {/* Quick faces */}
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Quick set</p>
                <div className="grid grid-cols-5 gap-2">
                  {quickSet.map((val, idx) => {
                    const pressed = level === val
                    return (
                      <motion.button
                        key={val}
                        whileTap={prefersReduced ? undefined : { scale: 0.96 }}
                        className={`group rounded-2xl border px-3 py-2 text-2xl transition ${valToTone(val).btnBg} ${valToTone(val).btnBorder} hover:shadow-md`}
                        onClick={() => { setLevel(val); bump(8) }}
                        aria-label={`Set to ${labels[idx]}`}
                        aria-pressed={pressed}
                        title={`Set to ${labels[idx]}`}
                      >
                        <span className="block">{faces[idx].emoji}</span>
                        <span className="block text-[10px] mt-1 text-gray-600 dark:text-gray-300">{labels[idx]}</span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Recommendation */}
              <div className={dark ? 'rounded-xl p-4 border border-white/15 bg-zinc-900/60' : 'rounded-xl p-4 border border-black/10 bg-white/70'}>
                <div className="text-sm font-semibold mb-1">Suggested approach</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">{recommendation}</div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  className={`rounded-xl px-4 py-2 font-semibold border ${tone.btnBorder} ${tone.btnBg} ${tone.btnText} hover:shadow`}
                  onClick={shareNative}
                >
                  Share link
                </button>

                <button
                  className="rounded-xl px-4 py-2 font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 hover:shadow"
                  onClick={() => handleCopy(shareUrl())}
                >
                  Copy link
                </button>

                <button
                  className="rounded-xl px-4 py-2 font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 hover:shadow"
                  onClick={() => handleCopy(messageTemplates.playful)}
                >
                  Copy playful text
                </button>

                <button
                  className="rounded-xl px-4 py-2 font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 hover:shadow"
                  onClick={() => handleCopy(messageTemplates.straight)}
                >
                  Copy simple text
                </button>

                <button
                  className="rounded-xl px-4 py-2 font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 hover:shadow"
                  onClick={() => handleCopy(messageTemplates.emoji)}
                >
                  Copy emoji text
                </button>

                <button
                  className="rounded-xl px-4 py-2 font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 hover:shadow"
                  onClick={textMarcus}
                >
                  Text Marcus
                </button>

                <button
                  className="rounded-xl px-4 py-2 font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 hover:shadow"
                  onClick={handleReset}
                >
                  Reset
                </button>

                <button
                  className="rounded-xl px-4 py-2 font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 hover:shadow"
                  onClick={clearAll}
                >
                  Reset saved settings
                </button>
              </div>

              {/* Install banner */}
              {!installed && installPrompt && (
                <div className="rounded-xl p-4 border border-black/10 dark:border-white/15 bg-white/80 dark:bg-zinc-900/70 flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-semibold">Install Grump Factor</div>
                    <div className="text-gray-600 dark:text-gray-300">One-tap from your home screen. Works offline.</div>
                  </div>
                  <button
                    className="rounded-xl px-4 py-2 font-semibold border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 hover:shadow"
                    onClick={triggerInstall}
                  >
                    Install
                  </button>
                </div>
              )}

              {/* Toast */}
              <AnimatePresence>
                {toast && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-x-0 bottom-6 flex justify-center pointer-events-none"
                    aria-live="polite"
                  >
                    <div className="pointer-events-auto rounded-full border border-black/10 dark:border-white/15 bg-white/90 dark:bg-zinc-800/90 px-4 py-2 text-sm font-medium shadow">
                      {toast}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Live region for SR users */}
              <div aria-live="polite" className="sr-only">{announce}</div>
            </main>

            <footer className="mt-6 border-t dark:border-white/10 border-black/10 pt-4 text-xs text-gray-500 dark:text-gray-400">
              Made with ❤️ for checking in on {name || 'Dad'}. Keyboard: ←/→ to adjust, 1–5 jump, R to reset. URL saves your settings.
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ===== Helpers ===== */

function clamp(n: number, min = 0, max = 100) { return Math.min(max, Math.max(min, n)) }

function cleanName(s: string) {
  // letters, numbers, spaces, . ' -
  return s.replace(/[^\p{L}\p{N}\s.'-]/gu, '').slice(0, 30)
}

function useStickyState<T>(initial: T, key: string): [T, (v: T | ((v: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try { const stored = localStorage.getItem(key); return stored ? (JSON.parse(stored) as T) : initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch {} }, [key, value])
  return [value, setValue]
}

// ultra-light local counters
function incrCounter(key: string) {
  try {
    const v = parseInt(localStorage.getItem(key) || '0')
    localStorage.setItem(key, String((Number.isNaN(v) ? 0 : v) + 1))
  } catch {}
}

const labels = ['happy', 'slightly grumpy', 'grumpy', 'very grumpy', 'extremely grumpy']
const faces = [{ emoji: '😄' }, { emoji: '🙂' }, { emoji: '😐' }, { emoji: '😠' }, { emoji: '😡' }]

function faceFor(level: number) {
  if (level <= 20) return { emoji: '😄' }
  if (level <= 40) return { emoji: '🙂' }
  if (level <= 60) return { emoji: '😐' }
  if (level <= 80) return { emoji: '😠' }
  return { emoji: '😡' }
}

function descriptorFor(level: number) {
  if (level <= 20) return { title: 'Sunny disposition', subtitle: 'Whistling while making coffee.' }
  if (level <= 40) return { title: 'Mild clouds', subtitle: 'May require one dad joke to clear.' }
  if (level <= 60) return { title: 'Grump adjacent', subtitle: 'Proceed with snacks and small talk.' }
  if (level <= 80) return { title: 'Storm watch', subtitle: 'Caffeine before conversation recommended.' }
  return { title: 'Full curmudgeon', subtitle: 'Deploy hugs, retreat cautiously.' }
}

function toneFor(level: number, dark: boolean) {
  if (level <= 20) return tone('green', dark, '#86efac', '#22c55e', 'from-green-100 dark:from-green-950', 'to-emerald-100 dark:to-emerald-950')
  if (level <= 40) return tone('lime', dark, '#bef264', '#84cc16', 'from-lime-100 dark:from-lime-950', 'to-amber-100 dark:to-amber-950')
  if (level <= 60) return tone('amber', dark, '#fcd34d', '#f59e0b', 'from-amber-100 dark:from-amber-950', 'to-orange-100 dark:to-orange-950')
  if (level <= 80) return tone('orange', dark, '#fdba74', '#f97316', 'from-orange-100 dark:from-orange-950', 'to-red-100 dark:to-red-950')
  return tone('red', dark, '#fca5a5', '#ef4444', 'from-rose-100 dark:from-rose-950', 'to-red-100 dark:to-red-950')
}

function tone(hue: string, _dark: boolean, track: string, thumbBorder: string, from: string, to: string) {
  return {
    text: `text-${hue}-800 dark:text-${hue}-300`,
    track,
    thumbBorder,
    bgFrom: from,
    bgTo: to,
    pillBg: `bg-${hue}-100/80 dark:bg-${hue}-900/40`,
    pillText: `text-${hue}-800 dark:text-${hue}-200`,
    pillBorder: `border-${hue}-300/70 dark:border-${hue}-700/60`,
    btnBg: `bg-${hue}-600`,
    btnText: 'text-white',
    btnBorder: `border-${hue}-700`,
  } as const
}

function valToTone(_val: number) {
  return { btnBg: 'bg-white dark:bg-zinc-800', btnBorder: 'border-gray-200 dark:border-white/15' } as const
}

function recommendationFor(level: number, cups: number) {
  let base = 'Offer warmth and keep it light.'
  if (level <= 20) base = 'No notes—lead with a smile and maybe a quick win for the day.'
  else if (level <= 40) base = 'Open with a light check-in and one (1) tasteful dad joke.'
  else if (level <= 60) base = 'Start with small talk; bring snacks or a coffee assist.'
  else if (level <= 80) base = 'Give space, deliver caffeine, circle back with empathy.'
  else base = 'Proceed with maximum kindness. Coffee and a hug are your best bets.'
  if (cups === 0) base += ' (Note: zero cups detected—espresso diplomacy advised.)'
  if (cups >= 3) base += ' (Caution: caffeine saturation; avoid rapid-fire questions.)'
  return base
}

function labelFor(level: number) {
  if (level <= 20) return 'happy'
  if (level <= 40) return 'slightly grumpy'
  if (level <= 60) return 'grumpy'
  if (level <= 80) return 'very grumpy'
  return 'extremely grumpy'
}

function buildMessages({ level, cups, name, url }: { level: number; cups: number; name: string; url: string }) {
  const who = name || 'Dad'
  const label = labelFor(level)
  const cupText = `${cups} cup${cups === 1 ? '' : 's'}`
  return {
    playful: `Morning ${who}! Quick *grump check*: are we at ${label}? I logged ${cupText} ☕ so far. Slide to report in: ${url}`,
    straight: `Hey ${who}, where’s your grump factor today (0–100)? Slide and tell me: ${url}`,
    emoji: `Grump factor today? 👉 😄–🙂–😐–😠–😡  Slide: ${url}`,
  } as const
    }
