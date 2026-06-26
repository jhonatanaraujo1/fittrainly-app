'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { History } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { bookingApi } from '@/lib/api'
import { formatDate, formatTime, bookingStatusLabel, bookingStatusColor } from '@/lib/utils'
import type { Booking } from '@/types'

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  mon.setHours(0, 0, 0, 0)
  return mon.toISOString().slice(0, 10)
}

function weekLabel(weekKey: string): string {
  const mon = new Date(weekKey + 'T00:00:00')
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)

  const fmtDay = (d: Date) =>
    d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })

  const now = new Date()
  const thisWeekKey = getWeekKey(now.toISOString())
  const lastWeekDate = new Date(now)
  lastWeekDate.setDate(now.getDate() - 7)
  const lastWeekKey = getWeekKey(lastWeekDate.toISOString())

  if (weekKey === thisWeekKey) return `Esta semana · ${fmtDay(mon)} – ${fmtDay(sun)}`
  if (weekKey === lastWeekKey) return `Semana passada · ${fmtDay(mon)} – ${fmtDay(sun)}`
  return `${fmtDay(mon)} – ${fmtDay(sun)}`
}

function groupByWeek(bookings: Booking[]) {
  const map = new Map<string, Booking[]>()
  for (const b of bookings) {
    const key = getWeekKey(b.startTime)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(b)
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function AlunoHistoryPage() {
  const [filter, setFilter] = useState('ALL')

  const { data: all = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: bookingApi.myBookings,
  })

  const past = all.filter(b => {
    const inPast = new Date(b.endTime) < new Date()
    if (filter === 'ALL') return inPast
    return inPast && b.status === filter
  })

  const weeks = groupByWeek(past)

  const dotColor: Record<string, string> = {
    COMPLETED: 'bg-emerald-500',
    CANCELLED: 'bg-gray-300',
    CONFIRMED: 'bg-blue-500',
  }

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Histórico</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {past.length} sessão{past.length !== 1 ? 'ões' : ''} no passado
          </p>
        </div>
        <Select value={filter} onValueChange={v => { if (v) setFilter(v) }}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="COMPLETED">Realizadas</SelectItem>
            <SelectItem value="CANCELLED">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[...Array(2)].map((_, wi) => (
            <div key={wi} className="space-y-3">
              <Skeleton className="h-4 w-48 rounded" />
              <div className="space-y-2 pl-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : past.length === 0 ? (
        <div className="text-center py-16">
          <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sem histórico</p>
          <p className="text-sm text-gray-400">As sessões passadas aparecem aqui</p>
        </div>
      ) : (
        <div className="space-y-8">
          {weeks.map(([weekKey, bookings], wi) => (
            <motion.div
              key={weekKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: wi * 0.05 }}
            >
              {/* Week header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {weekLabel(weekKey)}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">{bookings.length} sess.</span>
              </div>

              {/* Timeline */}
              <div className="relative pl-6">
                {/* vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100" />

                <div className="space-y-2">
                  {bookings.map((b, i) => (
                    <div key={b.id ?? i} className="relative flex items-center gap-4">
                      {/* dot */}
                      <div
                        className={`absolute -left-[17px] w-3 h-3 rounded-full border-2 border-white shrink-0 ${dotColor[b.status] ?? 'bg-gray-300'}`}
                      />

                      {/* card */}
                      <div className="flex-1 flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(b.startTime)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatTime(b.startTime)} – {formatTime(b.endTime)}
                            {b.personalTrainerName ? ` · ${b.personalTrainerName}` : ''}
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${bookingStatusColor(b.status)}`}>
                          {bookingStatusLabel(b.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
