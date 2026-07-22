'use client'

import { useRef, useState, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SelectOption<T extends string | number = string> {
  value: T
  label: string
}

interface CustomSelectProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  className?: string
  // 'lg' = 44px, o mínimo de alvo de toque (Apple HIG). Usar em formulários
  // e filtros; 'sm'/'md' só em barras densas de desktop.
  size?: 'sm' | 'md' | 'lg'
  prefix?: React.ReactNode
}

export function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Selecionar',
  className,
  size = 'md',
  prefix,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 w-full rounded-md border bg-white text-left transition-colors',
          'hover:bg-gray-50 focus:outline-none',
          open
            ? 'border-[#C9A84C] ring-1 ring-[#C9A84C]/40'
            : 'border-gray-200',
          size === 'sm' ? 'h-8 px-2.5 text-xs' : size === 'lg' ? 'min-h-[44px] px-3.5 text-sm' : 'h-9 px-3 text-sm',
        )}>
        {prefix}
        <span className={cn('flex-1 font-medium', selected ? 'text-gray-700' : 'text-gray-400')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            // max-h + scroll: o seletor de ano do DatePicker chega a 121
            // opções (datas de nascimento até validades de documentos). Sem
            // limite, a lista saía do ecrã e ficava inalcançável.
            className="absolute z-50 mt-1 w-full min-w-[140px] max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white shadow-xl"
          >
            {options.map(opt => {
              const active = opt.value === value
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  // Numa lista longa (anos), abrir no topo deixava o valor
                  // atual fora de vista. Traz o selecionado para o centro.
                  ref={active ? (el) => el?.scrollIntoView({ block: 'center' }) : undefined}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={cn(
                    'flex items-center justify-between gap-3 w-full px-3 py-2.5 text-sm text-left transition-colors',
                    active
                      ? 'bg-[#C9A84C]/10 text-gray-900 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 font-medium',
                  )}>
                  {opt.label}
                  {active && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C9A84C' }} />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
