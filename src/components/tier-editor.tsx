'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { planTierApi } from '@/lib/api'
import type { PlanHourTier } from '@/types'

type TierDraft = { hoursFrom: string; hoursTo: string; pricePerHour: string; bonus: string }

// Editor das faixas progressivas de um plano TIERED_HOURLY. Cada faixa é um
// card rotulado 2x2 (nunca uma linha densa de 4 inputs sem label — o layout
// antigo truncava em mobile). Extraído da antiga tela Configurações para
// viver dentro de Planos de Aluguel.
export function TierEditor({ planId }: { planId: string }) {
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
            <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 transition-colors min-w-[44px] min-h-[44px] -m-2.5 flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-400">De (horas)</Label>
              <Input value={row.hoursFrom} onChange={e => set(i, 'hoursFrom', e.target.value)} className="h-9 text-base md:text-sm" type="number" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-400">Até (vazio = sem limite)</Label>
              <Input value={row.hoursTo} onChange={e => set(i, 'hoursTo', e.target.value)} className="h-9 text-base md:text-sm" type="number" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-400">€ por hora</Label>
              <Input value={row.pricePerHour} onChange={e => set(i, 'pricePerHour', e.target.value)} className="h-9 text-base md:text-sm" type="number" step="0.01" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-gray-400">Bónus (€)</Label>
              <Input value={row.bonus} onChange={e => set(i, 'bonus', e.target.value)} className="h-9 text-base md:text-sm" type="number" step="0.01" />
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
