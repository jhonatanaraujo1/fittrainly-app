'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Clock, Calendar, CalendarDays, Loader2, Pencil, AlertTriangle } from 'lucide-react'
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
import { planApi } from '@/lib/api'
import { TierEditor } from '@/components/tier-editor'
import { formatCurrency, planTypeLabel, planTypeBadge } from '@/lib/utils'
import type { RentalPlan } from '@/types'

// TIERED_HOURLY is not selectable when creating a plan and never rendered
// here — it's a single studio-wide billing config, edited in Configurações.
const PLAN_ICONS = { HOURLY: Clock, WEEKLY: Calendar, MONTHLY: CalendarDays }

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
    return '—'
  }

  // TIERED_HOURLY is a single studio-wide config, not a plan the admin
  // creates/duplicates/deletes — kept out of the plan grid above, but its
  // tier editor lives at the bottom of this same page (a Configurações
  // screen só para isto não se justificava).
  const rentalPlans = plans.filter(p => p.type !== 'TIERED_HOURLY')
  const tieredConfig = plans.find(p => p.type === 'TIERED_HOURLY')

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planos de Aluguel</h1>
          <p className="text-sm text-gray-400 mt-0.5">Configure o custo do espaço por Personal Trainer</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#111111] hover:bg-gray-800 text-white gap-2 h-9 text-sm"
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
          {rentalPlans.map((plan, i) => {
            const Icon = PLAN_ICONS[plan.type as keyof typeof PLAN_ICONS] ?? Calendar
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-white rounded-xl p-5 led-gold flex flex-col gap-3"
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
                  {/* text-gray-900, não text-[#111111]: a folha de dark mode
                      remapeia as escalas do Tailwind, mas não valores
                      arbitrários — o preço ficava preto sobre preto. */}
                  <p className="text-2xl font-bold text-gray-900 mt-1">{planPrice(plan)}</p>
                  {plan.description && (
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">{plan.description}</p>
                  )}
                </div>
                <div className="pt-1 border-t border-gray-50">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${planTypeBadge(plan.type)}`}>
                    {planTypeLabel(plan.type)}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Cobrança por hora progressiva (TIERED_HOURLY) — antes numa tela
          Configurações à parte, agora aqui dentro de Planos de Aluguel. */}
      {!isLoading && tieredConfig && (
        <div className="bg-white rounded-xl p-5 led-gold">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-50 text-violet-600 border border-violet-100 flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Cobrança por Hora (Progressiva)</p>
              <p className="text-xs text-gray-400">Vale para todos os PTs neste modelo</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 mb-4 leading-relaxed">
            {tieredConfig.description || 'Preço por hora decrescente por faixa, com acerto retroativo na última segunda do mês.'}
          </p>
          <TierEditor planId={tieredConfig.id} />
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
            <Button type="submit" disabled={createPlan.isPending} className="w-full bg-[#111111] hover:bg-gray-800 text-white h-9 text-sm">
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
              {/* Preço — o campo que faltava. Ligado ao valor certo conforme o
                  tipo do plano; o backend (PATCH) aplica priceHourly/Weekly/Monthly. */}
              {editPlan.type !== 'TIERED_HOURLY' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {editPlan.type === 'MONTHLY' ? 'Preço mensal (€)'
                      : editPlan.type === 'WEEKLY' ? 'Preço semanal (€)'
                      : 'Preço por hora (€)'}
                  </Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={editPlan.type === 'MONTHLY' ? (editPlan.priceMonthly ?? '')
                      : editPlan.type === 'WEEKLY' ? (editPlan.priceWeekly ?? '')
                      : (editPlan.priceHourly ?? '')}
                    onChange={e => {
                      const v = e.target.value === '' ? undefined : parseFloat(e.target.value)
                      setEditPlan(p => {
                        if (!p) return null
                        if (p.type === 'MONTHLY') return { ...p, priceMonthly: v }
                        if (p.type === 'WEEKLY') return { ...p, priceWeekly: v }
                        return { ...p, priceHourly: v }
                      })
                    }}
                  />
                  {/* Aviso: o preço é lido ao vivo pela faturação. Recorded
                      weeks ficam com snapshot (ver PtPaymentService); o resto
                      recalcula. O dono TEM de saber que não é só p/ a frente. */}
                  <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-snug text-amber-800">
                      Muda o cálculo do <strong>aluguer de todos os PTs</strong> neste plano — não só dos novos.
                      Recalcula a faturação <strong>ainda em aberto</strong>, incluindo semanas passadas que ainda não registaste como recebidas.
                      Semanas <strong>já com recebimento registado ficam congeladas</strong> e não mudam.
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={editPlan.description ?? ''} onChange={e => setEditPlan(p => p ? ({ ...p, description: e.target.value }) : null)} />
              </div>
              <Button type="submit" disabled={updatePlan.isPending} className="w-full bg-[#111111] hover:bg-gray-800 text-white h-9 text-sm">
                {updatePlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
