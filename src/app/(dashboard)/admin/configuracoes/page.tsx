'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Loader2, X, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { planApi, planTierApi } from '@/lib/api'
import type { RentalPlan, PlanHourTier } from '@/types'

type TierDraft = { hoursFrom: string; hoursTo: string; pricePerHour: string; bonus: string }

// Each tier is its own labeled 2x2 card — never a single dense row of
// unlabeled inputs. Guarantees the values are always readable regardless of
// screen width (the old flex-row-of-4-inputs layout truncated on mobile).
function TierEditor({ planId }: { planId: string }) {
  const qc = useQueryClient()
  const { data: tiers = [] } = useQuery<PlanHourTier[]>({
    queryKey: ['plan-tiers', planId],
    queryFn: () => planTierApi.listTiers(planId),
  })
  const [draft, setDraft] = useState<TierDraft[]>([])

  useEffect(() => {
    if (tiers.length > 0) {
      setDraft(tiers.map(t => ({
        hoursFrom: String(t.hoursFrom), hoursTo: t.hoursTo === null ? '' : String(t.hoursTo),
        pricePerHour: String(t.pricePerHour), bonus: String(t.bonus),
      })))
    }
  }, [tiers])

  const save = useMutation({
    mutationFn: () => planTierApi.saveTiers(planId, draft.map((d, i) => ({
      tierOrder: i + 1,
      hoursFrom: parseInt(d.hoursFrom) || 0,
      hoursTo: d.hoursTo.trim() === '' ? null : parseInt(d.hoursTo),
      pricePerHour: parseFloat(d.pricePerHour) || 0,
      bonus: parseFloat(d.bonus) || 0,
    }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan-tiers', planId] })
      toast.success('Faixas atualizadas')
    },
    onError: () => toast.error('Erro ao guardar faixas'),
  })

  const set = (i: number, k: keyof TierDraft, v: string) =>
    setDraft(d => d.map((row, idx) => idx === i ? { ...row, [k]: v } : row))

  const addRow = () => setDraft(d => [...d, { hoursFrom: '', hoursTo: '', pricePerHour: '', bonus: '0' }])
  const removeRow = (i: number) => setDraft(d => d.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      {draft.map((row, i) => (
        <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Faixa {i + 1}</span>
            <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 transition-colors p-1 -m-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-400">De (horas)</Label>
              <Input value={row.hoursFrom} onChange={e => set(i, 'hoursFrom', e.target.value)} className="h-9 text-sm" type="number" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-400">Até (vazio = sem limite)</Label>
              <Input value={row.hoursTo} onChange={e => set(i, 'hoursTo', e.target.value)} className="h-9 text-sm" type="number" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-400">€ por hora</Label>
              <Input value={row.pricePerHour} onChange={e => set(i, 'pricePerHour', e.target.value)} className="h-9 text-sm" type="number" step="0.01" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-400">Bónus (€)</Label>
              <Input value={row.bonus} onChange={e => set(i, 'bonus', e.target.value)} className="h-9 text-sm" type="number" step="0.01" />
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>+ Faixa</Button>
        <Button type="button" size="sm" className="bg-[#1F3864] hover:bg-[#162c52] text-white" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar faixas'}
        </Button>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const { data: plans = [], isLoading } = useQuery<RentalPlan[]>({
    queryKey: ['plans'],
    queryFn: planApi.list,
  })

  // TIERED_HOURLY is a single studio-wide config, not a plan the admin
  // creates/duplicates/deletes — this page is where it lives.
  const tieredConfig = plans.find(p => p.type === 'TIERED_HOURLY')

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-400 mt-0.5">Configurações gerais do estúdio, válidas para todos os PTs</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : tieredConfig ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-50 text-violet-600 border border-violet-100 flex-shrink-0">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Cobrança por Hora (Progressiva)</p>
              <p className="text-xs text-gray-400">Configuração do estúdio — vale para todos os PTs neste modelo</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 mb-4 leading-relaxed">
            {tieredConfig.description || 'Preço por hora decrescente por faixa, com acerto retroativo na última segunda do mês.'}
          </p>
          <TierEditor planId={tieredConfig.id} />
        </motion.div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-400 text-sm">Configuração de cobrança por hora ainda não existe</p>
        </div>
      )}
    </div>
  )
}
