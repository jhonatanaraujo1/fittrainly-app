'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Users, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CustomSelect } from '@/components/ui/custom-select'
import { ptApi, planApi } from '@/lib/api'
import { getInitials, avatarColor, planTypeLabel, planTypeBadge } from '@/lib/utils'
import type { PersonalTrainer, RentalPlan } from '@/types'

type FilterTab = 'todos' | 'ativos' | 'inativos' | 'inadimplentes'
type SortKey = 'nome' | 'horas_desc' | 'horas_asc' | 'alunos_desc'

const SORT_LABELS: Record<SortKey, string> = {
  nome: 'Nome (A–Z)',
  horas_desc: 'Mais horas este mês',
  horas_asc: 'Menos horas este mês',
  alunos_desc: 'Mais alunos',
}

export default function PersonalTrainersPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('todos')
  const [sort, setSort] = useState<SortKey>('horas_desc')
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', specialty: '', bio: '', planId: '' })

  const { data: pts = [], isLoading } = useQuery<PersonalTrainer[]>({
    queryKey: ['admin-pts'],
    queryFn: ptApi.list,
  })

  const { data: plans = [] } = useQuery<RentalPlan[]>({
    queryKey: ['plans'],
    queryFn: planApi.list,
  })

  const createPT = useMutation({
    mutationFn: ptApi.create,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin-pts'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success(`${created.name ?? 'PT'} adicionado com sucesso! 🎉`)
      setOpen(false)
      setForm({ name: '', email: '', password: '', phone: '', specialty: '', bio: '', planId: '' })
    },
    onError: () => toast.error('Erro ao criar Personal Trainer. Verifica os dados e tente novamente.'),
  })

  const toggleInadimplente = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      ptApi.update(id, { inadimplente: value }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-pts'] })
      toast.success(vars.value ? 'PT marcado como inadimplente' : 'PT marcado como em dia ✅')
    },
    onError: () => toast.error('Erro ao atualizar status de pagamento'),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      ptApi.update(id, { active: value }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-pts'] })
      toast.success(vars.value ? 'PT ativado ✅' : 'PT desativado')
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })

  const displayed = useMemo(() => {
    let list = [...pts]

    // filter
    if (filter === 'ativos') list = list.filter(p => p.active)
    else if (filter === 'inativos') list = list.filter(p => !p.active)
    else if (filter === 'inadimplentes') list = list.filter(p => p.inadimplente)

    // sort
    if (sort === 'nome') list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'horas_desc') list.sort((a, b) => b.hoursThisMonth - a.hoursThisMonth)
    else if (sort === 'horas_asc') list.sort((a, b) => a.hoursThisMonth - b.hoursThisMonth)
    else if (sort === 'alunos_desc') list.sort((a, b) => b.alunoCount - a.alunoCount)

    return list
  }, [pts, filter, sort])

  // summary counts
  const totalHoras = pts.reduce((s, p) => s + p.hoursThisMonth, 0)
  const inadimplenteCount = pts.filter(p => p.inadimplente).length
  const inativoCount = pts.filter(p => !p.active).length

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('Nome, email e password são obrigatórios')
      return
    }
    createPT.mutate({ ...form, planId: form.planId || undefined })
  }

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'todos', label: 'Todos', count: pts.length },
    { key: 'ativos', label: 'Ativos', count: pts.filter(p => p.active).length },
    { key: 'inativos', label: 'Inativos', count: inativoCount },
    { key: 'inadimplentes', label: 'Inadimplentes', count: inadimplenteCount },
  ]

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Personal Trainers</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {pts.length} PT{pts.length !== 1 ? 's' : ''} · {totalHoras}h este mês
            {inadimplenteCount > 0 && (
              <span className="ml-2 text-red-500 font-medium">· {inadimplenteCount} inadimplente{inadimplenteCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 h-9 px-4 text-white text-sm font-medium rounded-lg transition-colors" style={{ background: '#111111' }}>
            <Plus className="w-4 h-4" /> Adicionar PT
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Personal Trainer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Nome completo *</Label>
                  <Input placeholder="João Silva" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" placeholder="joao@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Password *</Label>
                  <Input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input placeholder="+351 912 000 000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Especialidade</Label>
                  <Input placeholder="Musculação e Força" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Plano de Aluguel</Label>
                  <Select value={form.planId} onValueChange={v => setForm(f => ({ ...f, planId: v ?? '' }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                    <SelectContent>
                      {plans.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {planTypeLabel(p.type)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Bio / Apresentação</Label>
                  <Input placeholder="Especialista em..." value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-9 text-sm">Cancelar</Button>
                <Button type="submit" disabled={createPT.isPending} className="h-9 text-sm text-white" style={{ background: '#111111' }}>
                  {createPT.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar PT'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs + Sort */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Filter tabs */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                filter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              } ${tab.key === 'inadimplentes' && tab.count && tab.count > 0 ? 'text-red-500' : ''}`}>
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  filter === tab.key
                    ? tab.key === 'inadimplentes' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                    : 'bg-gray-200 text-gray-500'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Sort select */}
        <CustomSelect<SortKey>
          value={sort}
          onChange={setSort}
          options={(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([value, label]) => ({ value, label }))}
          size="sm"
          className="w-44"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum PT encontrado</p>
          <p className="text-sm text-gray-400 mt-0.5">Tenta outro filtro</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((pt, i) => (
            <motion.div key={pt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className={`bg-white rounded-xl p-5 shadow-sm border flex flex-col gap-3 ${
                pt.inadimplente ? 'border-red-200' : 'border-gray-100'
              }`}>

              {/* Top row: avatar + name + status badges */}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full ${avatarColor(pt.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                  {getInitials(pt.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{pt.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{pt.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                    pt.active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}>
                    {pt.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                    pt.inadimplente
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  }`}>
                    {pt.inadimplente ? '⚠ Inadimplente' : '✓ Em dia'}
                  </span>
                </div>
              </div>

              {/* Specialty */}
              {pt.specialty && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-snug">{pt.specialty}</p>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-gray-50">
                <Link
                  href={`/admin/personal-trainers/${pt.id}/alunos`}
                  className="text-center group hover:bg-gray-50 rounded-lg transition-colors py-1 -mx-1 px-1"
                  title="Ver alunos"
                >
                  <p className="text-base font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                    {pt.alunoCount}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5 group-hover:text-blue-400 transition-colors">
                    Alunos ↗
                  </p>
                </Link>
                <div className="text-center border-x border-gray-100">
                  <p className="text-base font-black text-gray-900">{pt.hoursThisMonth}h</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Horas/mês</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-gray-900 truncate">
                    {pt.plan ? planTypeLabel(pt.plan.type) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Plano</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/admin/personal-trainers/${pt.id}`}
                  className="flex-1 h-8 text-xs font-semibold rounded-md border border-gray-900 bg-gray-900 text-white hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  Ver perfil
                </Link>
                <button
                  onClick={() => toggleInadimplente.mutate({ id: pt.id, value: !pt.inadimplente })}
                  disabled={toggleInadimplente.isPending}
                  className={`h-8 px-2 text-xs font-medium rounded-md border transition-colors flex items-center justify-center gap-1 ${
                    pt.inadimplente
                      ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}>
                  {pt.inadimplente
                    ? <><CheckCircle2 className="w-3 h-3" /></>
                    : <><AlertTriangle className="w-3 h-3" /></>}
                </button>
                <button
                  onClick={() => toggleActive.mutate({ id: pt.id, value: !pt.active })}
                  disabled={toggleActive.isPending}
                  className="h-8 px-2 text-xs font-medium rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
                  {pt.active ? 'Off' : 'On'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
