'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Clock, Calendar, CalendarDays, Layers, Loader2, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { planApi, planTierApi } from '@/lib/api'
import { formatCurrency, planTypeLabel, planTypeBadge } from '@/lib/utils'
import type { RentalPlan, PlanHourTier } from '@/types'

const PLAN_ICONS = { HOURLY: Clock, WEEKLY: Calendar, MONTHLY: CalendarDays, TIERED_HOURLY: Layers }

type TierDraft = { hoursFrom: string; hoursTo: string; pricePerHour: string; bonus: string }

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
    <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Faixas de horas (progressivo)</p>
      <div className="space-y-1.5">
        {draft.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input placeholder="De" value={row.hoursFrom} onChange={e => set(i, 'hoursFrom', e.target.value)} className="h-8 text-xs w-14" type="number" />
            <span className="text-gray-300 text-xs">–</span>
            <Input placeholder="Até (vazio=∞)" value={row.hoursTo} onChange={e => set(i, 'hoursTo', e.target.value)} className="h-8 text-xs w-20" type="number" />
            <Input placeholder="€/h" value={row.pricePerHour} onChange={e => set(i, 'pricePerHour', e.target.value)} className="h-8 text-xs w-16" type="number" step="0.01" />
            <Input placeholder="Bónus €" value={row.bonus} onChange={e => set(i, 'bonus', e.target.value)} className="h-8 text-xs w-16" type="number" step="0.01" />
            <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>+ Faixa</Button>
        <Button type="button" size="sm" className="h-7 text-xs bg-[#1F3864] hover:bg-[#162c52] text-white" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar faixas'}
        </Button>
      </div>
    </div>
  )
}

export default function PlansPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<RentalPlan | null>(null)

  const emptyForm = { name: '', type: 'MONTHLY', description: '', priceHourly: '', priceWeekly: '', priceMonthly: '' }
  const [form, setForm] = useState<Record<string, string>>(emptyForm)

  const { data: plans = [], isLoading } = useQuery<RentalPlan[]>({
    queryKey: ['plans'],
    queryFn: planApi.list,
  })

  const createPlan = useMutation({
    mutationFn: planApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success('Plano criado com sucesso! 🎉')
      setCreateOpen(false)
      setForm(emptyForm)
    },
    onError: () => toast.error('Erro ao criar plano'),
  })

  const updatePlan = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => planApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success('Plano atualizado')
      setEditPlan(null)
    },
    onError: () => toast.error('Erro ao atualizar plano'),
  })

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    createPlan.mutate({
      name: form.name,
      type: form.type,
      description: form.description,
      ...(form.type === 'HOURLY' && { priceHourly: parseFloat(form.priceHourly) }),
      ...(form.type === 'WEEKLY' && { priceWeekly: parseFloat(form.priceWeekly) }),
      ...(form.type === 'MONTHLY' && { priceMonthly: parseFloat(form.priceMonthly) }),
    })
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editPlan) return
    updatePlan.mutate({ id: editPlan.id, data: editPlan })
  }

  function planPrice(p: RentalPlan): string {
    if (p.type === 'HOURLY' && p.priceHourly) return `${formatCurrency(p.priceHourly)} / hora`
    if (p.type === 'WEEKLY' && p.priceWeekly) return `${formatCurrency(p.priceWeekly)} / semana`
    if (p.type === 'MONTHLY' && p.priceMonthly) return `${formatCurrency(p.priceMonthly)} / mês`
    if (p.type === 'TIERED_HOURLY') return 'Por faixas'
    return '—'
  }

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planos de Aluguel</h1>
          <p className="text-sm text-gray-400 mt-0.5">Configure o custo do espaço por Personal Trainer</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#1F3864] hover:bg-[#162c52] text-white gap-2 h-9 text-sm"
        >
          <Plus className="w-4 h-4" /> Novo Plano
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const Icon = PLAN_ICONS[plan.type as keyof typeof PLAN_ICONS] ?? Calendar
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${planTypeBadge(plan.type)} border`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <button
                    onClick={() => setEditPlan(plan)}
                    className="text-gray-300 hover:text-gray-600 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <p className="font-bold text-gray-900">{plan.name}</p>
                  <p className="text-2xl font-bold text-[#1F3864] mt-1">{planPrice(plan)}</p>
                  {plan.description && (
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">{plan.description}</p>
                  )}
                </div>
                <div className="pt-1 border-t border-gray-50">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${planTypeBadge(plan.type)}`}>
                    {planTypeLabel(plan.type)}
                  </span>
                </div>
                {plan.type === 'TIERED_HOURLY' && <TierEditor planId={plan.id} />}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Plano de Aluguel</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input placeholder="Plano Mensal" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v ?? 'MONTHLY' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mensal</SelectItem>
                  <SelectItem value="WEEKLY">Semanal</SelectItem>
                  <SelectItem value="HOURLY">Por Hora</SelectItem>
                  <SelectItem value="TIERED_HOURLY">Por Hora (Faixas progressivas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === 'MONTHLY' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Preço por mês (€)</Label>
                <Input type="number" placeholder="200" value={form.priceMonthly} onChange={e => setForm(f => ({ ...f, priceMonthly: e.target.value }))} />
              </div>
            )}
            {form.type === 'WEEKLY' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Preço por semana (€)</Label>
                <Input type="number" placeholder="55" value={form.priceWeekly} onChange={e => setForm(f => ({ ...f, priceWeekly: e.target.value }))} />
              </div>
            )}
            {form.type === 'HOURLY' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Preço por hora (€)</Label>
                <Input type="number" placeholder="8" value={form.priceHourly} onChange={e => setForm(f => ({ ...f, priceHourly: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input placeholder="Inclui acesso ilimitado..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <Button type="submit" disabled={createPlan.isPending} className="w-full bg-[#1F3864] hover:bg-[#162c52] text-white h-9 text-sm">
              {createPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Plano'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editPlan} onOpenChange={open => !open && setEditPlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Plano</DialogTitle></DialogHeader>
          {editPlan && (
            <form onSubmit={handleEditSubmit} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={editPlan.name} onChange={e => setEditPlan(p => p ? ({ ...p, name: e.target.value }) : null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={editPlan.description ?? ''} onChange={e => setEditPlan(p => p ? ({ ...p, description: e.target.value }) : null)} />
              </div>
              <Button type="submit" disabled={updatePlan.isPending} className="w-full bg-[#1F3864] hover:bg-[#162c52] text-white h-9 text-sm">
                {updatePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
