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

const PAGE_SIZE = 10

export default function AlunoHistoryPage() {
  const [filter, setFilter] = useState('ALL')
  const [page, setPage] = useState(0)

  const { data: all = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: bookingApi.myBookings,
  })

  const past = all.filter(b => {
    const inPast = new Date(b.endTime) < new Date()
    if (filter === 'ALL') return inPast
    return inPast && b.status === filter
  })

  const totalPages = Math.ceil(past.length / PAGE_SIZE)
  const visible = past.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Histórico</h1>
          <p className="text-sm text-gray-400 mt-0.5">{past.length} sessão{past.length !== 1 ? 'ões' : ''} no passado</p>
        </div>
        <Select value={filter} onValueChange={v => { if (v) { setFilter(v); setPage(0) } }}>
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
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sem histórico</p>
          <p className="text-sm text-gray-400">As sessões passadas aparecem aqui</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="divide-y divide-gray-50">
            {visible.map((b, i) => (
              <div key={b.id ?? i} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{formatDate(b.startTime)}</p>
                  <p className="text-xs text-gray-400">
                    {formatTime(b.startTime)} – {formatTime(b.endTime)} · {b.personalTrainerName}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${bookingStatusColor(b.status)}`}>
                  {bookingStatusLabel(b.status)}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="text-xs text-gray-500 disabled:text-gray-200 hover:text-gray-900 transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-xs text-gray-400">{page + 1} / {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="text-xs text-gray-500 disabled:text-gray-200 hover:text-gray-900 transition-colors"
              >
                Seguinte →
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
