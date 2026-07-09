'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Calendar, Clock } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { pt } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// ── Calendar utils ─────────────────────────────────────────────────────────────

const WEEK_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const MONTH_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface CalCell { day: number; slot: 'prev' | 'curr' | 'next' }

function buildGrid(year: number, month: number): CalCell[] {
  const firstDow = new Date(year, month, 1).getDay()
  const offset = (firstDow + 6) % 7  // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev  = new Date(year, month, 0).getDate()
  const cells: CalCell[] = []
  for (let i = offset - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, slot: 'prev' })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, slot: 'curr' })
  let n = 1
  while (cells.length < 42) cells.push({ day: n++, slot: 'next' })
  return cells
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseYMD(s: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isValid(d) ? d : null
}

function resolveCell(cell: CalCell, viewYear: number, viewMonth: number) {
  let y = viewYear, m = viewMonth
  if (cell.slot === 'prev') { m -= 1; if (m < 0) { m = 11; y -= 1 } }
  if (cell.slot === 'next') { m += 1; if (m > 11) { m = 0; y += 1 } }
  return { y, m }
}

// ── Popup positioning (fixed) ──────────────────────────────────────────────────

function usePopupStyle(triggerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [style, setStyle] = useState<React.CSSProperties>({})

  const recalc = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const minW = Math.max(rect.width, 288)
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8

    if (spaceBelow < 340 && spaceAbove > spaceBelow) {
      setStyle({ position: 'fixed', left: rect.left, bottom: window.innerHeight - rect.top + 4, width: minW, zIndex: 9999 })
    } else {
      setStyle({ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: minW, zIndex: 9999 })
    }
  }, [triggerRef])

  useEffect(() => {
    if (!open) return
    recalc()
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
    }
  }, [open, recalc])

  return style
}

// ── CalendarBody (shared between DatePicker and DateTimePicker) ────────────────

interface CalendarBodyProps {
  value: string       // YYYY-MM-DD
  onSelect: (v: string) => void
  minDate?: string
  maxDate?: string
  initialView?: string  // YYYY-MM-DD — mês inicial quando value está vazio
}

function CalendarBody({ value, onSelect, minDate, maxDate, initialView }: CalendarBodyProps) {
  // Quando não há valor, abre em initialView (ex: data de nascimento abre ~2000
  // em vez do mês atual, evitando centenas de cliques até o ano de nascimento).
  const init = parseYMD(value) ?? parseYMD(initialView ?? '') ?? new Date()
  const [viewYear, setViewYear] = useState(init.getFullYear())
  const [viewMonth, setViewMonth] = useState(init.getMonth())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const todayStr = ymd(new Date())
  const cells = buildGrid(viewYear, viewMonth)

  return (
    <>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button type="button" onClick={prevMonth}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-bold text-gray-900 select-none">
          {MONTH_PT[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 px-3 mb-1">
        {WEEK_LABELS.map((l, i) => (
          <div key={i} className="flex items-center justify-center h-7 text-[11px] font-bold text-gray-400 uppercase select-none">
            {l}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-0.5">
        {cells.map((cell, i) => {
          const { y, m } = resolveCell(cell, viewYear, viewMonth)
          const dateStr = ymd(new Date(y, m, cell.day))
          const isSelected = dateStr === value
          const isToday    = dateStr === todayStr
          const isOther    = cell.slot !== 'curr'
          const disabled   = (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate)

          return (
            <button
              key={i}
              type="button"
              disabled={!!disabled}
              onClick={() => !disabled && onSelect(dateStr)}
              className={cn(
                'flex items-center justify-center aspect-square rounded-full text-[13px] transition-all select-none',
                isSelected
                  ? 'bg-[#111111] text-white font-bold'
                  : isToday
                    ? 'ring-2 ring-[#111111] text-gray-900 font-bold'
                    : isOther
                      ? 'text-gray-300'
                      : disabled
                        ? 'text-gray-200 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100 font-medium',
              )}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </>
  )
}

// ── DatePicker ─────────────────────────────────────────────────────────────────

export interface DatePickerProps {
  value: string           // YYYY-MM-DD or ''
  onChange: (v: string) => void
  placeholder?: string
  minDate?: string        // YYYY-MM-DD
  maxDate?: string        // YYYY-MM-DD
  initialView?: string    // YYYY-MM-DD — mês inicial quando vazio (ex: nascimento)
  className?: string
}

export function DatePicker({
  value, onChange, placeholder = 'Selecionar data', minDate, maxDate, initialView, className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef   = useRef<HTMLDivElement>(null)
  const popupStyle = usePopupStyle(triggerRef, open)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = triggerRef.current, p = popupRef.current
      if (!t?.contains(e.target as Node) && !p?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleSelect(v: string) {
    onChange(v)
    setOpen(false)
  }

  const displayValue = value
    ? (() => { try { return format(parseISO(value), "d 'de' MMMM 'de' yyyy", { locale: pt }) } catch { return value } })()
    : null

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-2.5 w-full rounded-xl border bg-white text-left transition-colors min-h-[44px] px-3.5',
          open
            ? 'border-gray-400 ring-2 ring-gray-200'
            : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className={cn('flex-1 text-base', displayValue ? 'text-gray-900' : 'text-gray-400')}>
          {displayValue ?? placeholder}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200',
          open && 'rotate-180',
        )} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popupRef}
            style={popupStyle}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[288px]"
          >
            <CalendarBody value={value} onSelect={handleSelect} minDate={minDate} maxDate={maxDate} initialView={initialView} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Time Spinner ───────────────────────────────────────────────────────────────

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

function TimeSpinner({
  value, onChange, items, label,
}: { value: string; onChange: (v: string) => void; items: string[]; label: string }) {
  const idx = items.indexOf(value)

  function prev() { onChange(items[(idx - 1 + items.length) % items.length]) }
  function next() { onChange(items[(idx + 1) % items.length]) }

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <button type="button" onClick={prev}
        className="p-2 rounded-xl hover:bg-gray-100 transition-colors min-h-[44px] min-w-[52px] flex items-center justify-center">
        <ChevronUp className="w-4 h-4 text-gray-500" />
      </button>
      <div className="text-2xl font-black text-gray-900 w-14 text-center select-none tabular-nums">
        {value}
      </div>
      <button type="button" onClick={next}
        className="p-2 rounded-xl hover:bg-gray-100 transition-colors min-h-[44px] min-w-[52px] flex items-center justify-center">
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  )
}

// ── DateTimePicker ─────────────────────────────────────────────────────────────

export interface DateTimePickerProps {
  value: string   // ISO datetime string or ''
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({
  value, onChange, placeholder = 'Selecionar data e hora', className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef   = useRef<HTMLDivElement>(null)
  const popupStyle = usePopupStyle(triggerRef, open)

  // Parse initial state from value
  const parsed = value ? (() => { try { const d = new Date(value); return isValid(d) ? d : null } catch { return null } })() : null

  const [dateStr, setDateStr] = useState<string>(parsed ? ymd(parsed) : '')
  const [hour,    setHour]    = useState<string>(parsed ? String(parsed.getHours()).padStart(2, '0') : '09')
  const [minute,  setMinute]  = useState<string>(
    parsed ? String(Math.round(parsed.getMinutes() / 5) * 5 % 60).padStart(2, '0') : '00'
  )

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = triggerRef.current, p = popupRef.current
      if (!t?.contains(e.target as Node) && !p?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function emit(d: string, h: string, m: string) {
    if (!d) return
    try {
      const iso = new Date(`${d}T${h}:${m}:00`).toISOString()
      onChange(iso)
    } catch { /* ignore */ }
  }

  function handleDateSelect(v: string) { setDateStr(v); emit(v, hour, minute) }
  function handleHour(h: string)       { setHour(h);    emit(dateStr, h, minute) }
  function handleMinute(m: string)     { setMinute(m);  emit(dateStr, hour, m) }

  const displayValue = dateStr
    ? `${format(parseISO(dateStr), "d MMM yyyy", { locale: pt })} às ${hour}h${minute}`
    : null

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-2.5 w-full rounded-xl border bg-white text-left transition-colors min-h-[44px] px-3.5',
          open
            ? 'border-gray-400 ring-2 ring-gray-200'
            : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className={cn('flex-1 text-base', displayValue ? 'text-gray-900' : 'text-gray-400')}>
          {displayValue ?? placeholder}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200',
          open && 'rotate-180',
        )} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popupRef}
            style={popupStyle}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[288px]"
          >
            {/* Calendar */}
            <CalendarBody value={dateStr} onSelect={handleDateSelect} />

            {/* Divider + Time */}
            <div className="border-t border-gray-100 px-4 py-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Hora</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <TimeSpinner value={hour}   onChange={handleHour}   items={HOURS}   label="Hora" />
                <span className="text-3xl font-black text-gray-300 pb-2 select-none">:</span>
                <TimeSpinner value={minute} onChange={handleMinute} items={MINUTES} label="Min" />
              </div>
            </div>

            {/* Confirm */}
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={!dateStr}
                className="w-full rounded-xl text-sm font-bold text-white min-h-[44px] transition-colors disabled:opacity-30"
                style={{ background: '#111111' }}
              >
                {dateStr ? `Confirmar — ${hour}:${minute}` : 'Selecione uma data'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
