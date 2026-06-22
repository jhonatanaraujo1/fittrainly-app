'use client'

import { useRef, useState, useEffect } from 'react'
import { Check, Pipette } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const DEFAULT_PRESETS = [
  '#111111', '#DC2626', '#EA580C', '#B45309', '#16A34A',
  '#0891B2', '#2563EB', '#7C3AED', '#DB2777', '#475569',
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  presets?: string[]
}

export function ColorPicker({ value, onChange, presets = DEFAULT_PRESETS }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setHex(value) }, [value])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function applyHex(raw: string) {
    const val = raw.startsWith('#') ? raw : `#${raw}`
    setHex(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) onChange(val)
  }

  return (
    <div ref={ref} className="relative inline-block">
      {/* trigger swatch */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 h-9 px-3 rounded-md border bg-white text-left transition-colors hover:bg-gray-50 focus:outline-none"
        style={{ borderColor: open ? '#C9A84C' : '#e5e7eb', boxShadow: open ? '0 0 0 1px rgba(201,168,76,0.4)' : undefined }}>
        <span
          className="w-5 h-5 rounded-full flex-shrink-0 border border-black/10"
          style={{ background: value }}
        />
        <span className="text-sm font-mono text-gray-600">{value.toUpperCase()}</span>
        <Pipette className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
      </button>

      {/* popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-50 mt-1.5 left-0 rounded-xl border border-gray-200 bg-white shadow-xl p-4"
            style={{ width: 236 }}>

            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">
              Cor de identificação
            </p>

            {/* preset grid */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {presets.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setHex(c) }}
                  className="w-8 h-8 rounded-full transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                  style={{
                    background: c,
                    outline: c === value ? '2px solid #C9A84C' : '2px solid transparent',
                    outlineOffset: 2,
                  }}>
                  {c === value && (
                    <Check className="w-3.5 h-3.5 drop-shadow" strokeWidth={3}
                      style={{ color: c === '#111111' ? '#C9A84C' : '#fff' }} />
                  )}
                </button>
              ))}
            </div>

            {/* hex input */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[10px] font-medium text-gray-400 mb-1.5">Código HEX</p>
              <div className="flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-md flex-shrink-0 border border-gray-200 transition-colors"
                  style={{ background: value }}
                />
                <input
                  type="text"
                  value={hex}
                  onChange={e => applyHex(e.target.value)}
                  maxLength={7}
                  spellCheck={false}
                  placeholder="#111111"
                  className="flex-1 h-8 px-2.5 text-sm font-mono border border-gray-200 rounded-md focus:outline-none transition-all"
                  style={{ borderColor: undefined }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
