'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { billingApi } from '@/lib/api'
import { formatCurrency, getInitials, avatarColor, planTypeLabel } from '@/lib/utils'
import type { BillingEntry } from '@/types'

function monthOptions() {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

export default function BillingPage() {
  const months = monthOptions()
  const [selectedMonth, setSelectedMonth] = useState(months[0].value)

  const { data, isLoading } = useQuery<{ entries: BillingEntry[]; total: number; month: string }>({
    queryKey: ['billing', selectedMonth],
    queryFn: () => billingApi.byMonth(selectedMonth),
  })

  const entries = data?.entries ?? []
  const total = data?.total ?? 0

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Faturação</h1>
          <p className="text-sm text-gray-400 mt-0.5">Valores calculados por plano de aluguel</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-9 text-sm gap-1.5"
            onClick={() => toast.info('Exportação em breve')}
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Sem dados de faturação para este período
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium">Personal Trainer</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Plano</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Sessões</th>
                <th className="text-right px-5 py-3 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((e, i) => (
                <tr key={e.ptId ?? i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(e.ptName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {getInitials(e.ptName)}
                      </div>
                      <span className="font-medium text-gray-900">{e.ptName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-gray-500">{e.planName} — {planTypeLabel(e.planType)}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-gray-600">{e.sessionsCount ?? 0}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`font-bold text-sm ${e.value >= 100 ? 'text-emerald-700' : e.value >= 50 ? 'text-amber-700' : 'text-gray-700'}`}>
                      {formatCurrency(e.value ?? 0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Total */}
      {!isLoading && entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1F3864] rounded-xl px-5 py-4 flex items-center justify-between"
        >
          <span className="text-white/70 text-sm font-medium">Total do período</span>
          <span className="text-white text-xl font-bold">{formatCurrency(total)}</span>
        </motion.div>
      )}
    </div>
  )
}
