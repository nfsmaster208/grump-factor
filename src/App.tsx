import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function App() {
  // STATE
  const [level, setLevel] = useStickyState<number>(35, 'gf_level') // 0–100
  const [cups, setCups] = useStickyState<number>(1, 'gf_cups') // 0–4+
  const [name, setName] = useStickyState<string>('Dad', 'gf_name')
  const [dark, setDark] = useStickyState<boolean>(false, 'gf_dark')
  const [copied, setCopied] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const sliderRef = useRef<HTMLInputElement | null>(null)

  // INIT FROM URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const l = params.get('level')
      const c = params.get('cups')
      const n = params.get('name')
      if (l !== null && !Number.isNaN(parseInt(l))) setLevel(clamp(parseInt(l), 0, 100))
      if (c !== null && !Number.isNaN(parseInt(c))) setCups(clamp(parseInt(c), 0, 4))
      if (n !== null) setName(n)
    } catch {}
  }, [])

  // SYNC URL
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('level', String(Math.round(level)))
      url.searchParams.set('cups', String(cups))
      url.searchParams.set('name', name || 'Dad')
      window.history.replaceState({}, '', url.toString())
    } catch {}
  }, [level, cups, name])

  // ACCESSIBLE ANNOUNCEMENTS
  useEffect(() => {
    const d = descriptorFor(level)
    setAnnounce(`${d.title}. ${d.subtitle}`)
  }, [level])

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setLevel((v) => clamp(v - 5))
      if (e.key === 'ArrowRight') setLevel((v) => clamp(v + 5))
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
  const tone = useMemo(() => toneFor(level), [level])
  const descriptor = useMemo(() => descriptorFor(level), [level])
  const recommendation = useMemo(() => recommendationFor(level, cups), [level, cups])
  const bgGradient = `bg-gradient-to-br ${tone.bgFrom} ${tone.bgTo}`

  // SHARE + COPY
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('Copied!')
      setTimeout(() => setCopied(null), 1200)
    } catch {
      setCopied('Couldn’t copy')
      setTimeout(() => setCopied(null), 1500)
    }
  }

  const shareUrl = () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('level', String(Math.round(level)))
      url.searchParams.set('cups', String(cups))
      url.searchParams.set('name', name || 'Dad')
      return url.toString()
    } catch {
      return ''
    }
  }

  const shareNative = async () => {
    const url = shareUrl()
    const title = 'Grump Factor'
    const text = `Where’s your grump factor today, ${name || 'Dad'}? Slide to rate: ${url}`
    // @ts-ignore - Web Share API
    if (navigator.share) {
      try {
        // @ts-ignore
        await navigator.share({ title, text, url })
      } catch {}
    } else {
      handleCopy(url)
    }
  }

  const handleReset = () => {
    setLevel(35)
    setCups(1)
  }

  const marks = [0, 20, 40, 60, 80, 100]
  const quickSet = [10, 30, 50, 70, 90] // midpoint for each face

  const messageTemplates = useMemo(
    () => buildMessages({ level, cups, name, url
