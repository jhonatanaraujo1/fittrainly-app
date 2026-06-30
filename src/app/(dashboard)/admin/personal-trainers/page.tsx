'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Users, Loader2, AlertTriangle, CheckCircle2, Lock, Eye, EyeOff, Shield, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CustomSelect } from '@/components/ui/custom-select'
import { ptApi, planApi } from '@/lib/api'
import { getInitials, avatarColor, planTypeLabel, planTypeBadge } from '@/lib/utils'
import type { PersonalTrainer, RentalPlan } from '@/types'

// ── NovoPTSheet — redesigned 2-step form ──────────────────────────────────────

interface NovoPTSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  plans: RentalPlan[]
  onCreate: (data: { name: string; email: string; password: string; phone: string; specialty: string; bio: string; planId: string }) => void
  isPending: boolean
}

const SPECIALTIES = [
  'Musculação e Força', 'Funcional e Mobilidade', 'Emagrecimento e Saúde',
  'Pilates', 'CrossFit', 'Cardio e Resistência', 'Nutrição e PT', 'Reabilitação',
]

function NovoPTSheet({ open, onOpenChange, plans, onCreate, isPending }: NovoPTSheetProps) {
  const [step, setStep] = useState(1)
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', specialty: '', bio: '', planId: '' })
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const touch = (field: string) => setTouched(t => ({ ...t, [field]: true }))
  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const errors = {
    name: touched.name && !form.name ? 'Nome obrigatório' : '',
    email: touched.email && !form.email ? 'Email obrigatório'
      : touched.email && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? 'Email inválido' : '',
    password: touched.password && !form.password ? 'Password obrigatória'
      : touched.password && form.password && form.password.length < 6 ? 'Mínimo 6 caracteres' : '',
  }

  const step1Valid = form.name && form.email && !errors.name && !errors.email
  const step2Valid = form.password && !errors.password

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      setStep(1)
      setForm({ name: '', email: '', password: '', phone: '', specialty: '', bio: '', planId: '' })
      setTouched({})
    }, 300)
  }

  function handleSubmit() {
    setTouched({ name: true, email: true, password: true })
    if (!step2Valid) return
    onCreate(form)
    handleClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose(); else onOpenChange(true) }}>
      <SheetTrigger>
        <span
          onClick={() => onOpenChange(true)}
          className="inline-flex items-center gap-2 h-10 px-4 text-white text-sm font-bold rounded-xl transition-all hover:opacity-90 active:scale-95 min-h-[44px] cursor-pointer"
          style={{ background: '#111111' }}
        >
          <Plus className="w-4 h-4" /> Adicionar PT
        </span>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-lg font-black text-gray-900">Novo Personal Trainer</SheetTitle>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Apenas administradores podem cadastrar PTs
              </p>
            </div>
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mt-1 flex-shrink-0">
              {[1, 2].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-6 bg-gray-900' : s < step ? 'w-3 bg-emerald-500' : 'w-3 bg-gray-200'
                }`} />
              ))}
              <span className="text-[10px] text-gray-400 ml-1 font-medium">{step}/2</span>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }} className="space-y-4">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-[11px] text-blue-700 font-semibold">Passo 1 de 2 — Dados Pessoais e Profissionais</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Nome completo *</Label>
                  <div className="relative">
                    <Input
                      placeholder="João Silva"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      onBlur={() => touch('name')}
                      className={`h-11 ${errors.name ? 'border-red-300 bg-red-50/30' : form.name ? 'border-emerald-300' : ''}`}
                    />
                    {form.name && !errors.name && (
                      <CheckCircle2 className="absolute right-3 top-3 w-4 h-4 text-emerald-500 pointer-events-none" />
                    )}
                  </div>
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Email profissional *</Label>
                  <div className="relative">
                    <Input
                      type="email"
                      inputMode="email"
                      placeholder="joao@mgstudio.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      onBlur={() => touch('email')}
                      className={`h-11 ${errors.email ? 'border-red-300 bg-red-50/30' : form.email && !errors.email ? 'border-emerald-300' : ''}`}
                    />
                    {form.email && !errors.email && (
                      <CheckCircle2 className="absolute right-3 top-3 w-4 h-4 text-emerald-500 pointer-events-none" />
                    )}
                  </div>
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Telefone</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="+351 912 000 000"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Especialidade</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SPECIALTIES.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set('specialty', form.specialty === s ? '' : s)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                          form.specialty === s
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {form.specialty && (
                    <p className="text-[11px] text-emerald-600 font-medium">✓ {form.specialty} seleccionado</p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }} className="space-y-4">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[11px] text-emerald-700 font-semibold">Passo 2 de 2 — Credenciais de Acesso e Plano</p>
                </div>

                {/* Security notice */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <Shield className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-gray-600">Armazenamento seguro</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                      Password encriptada com bcrypt (cost factor 12) antes de ser armazenada.
                      Nunca armazenamos passwords em texto simples.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Password de acesso *</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      onBlur={() => touch('password')}
                      className={`h-11 pr-10 ${errors.password ? 'border-red-300 bg-red-50/30' : form.password && !errors.password ? 'border-emerald-300' : ''}`}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-700" tabIndex={-1}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password
                    ? <p className="text-xs text-red-500">{errors.password}</p>
                    : form.password && (
                      <div className="flex items-center gap-1">
                        <div className={`h-1 flex-1 rounded-full transition-colors ${form.password.length >= 6 ? 'bg-emerald-400' : 'bg-red-300'}`} />
                        <div className={`h-1 flex-1 rounded-full transition-colors ${form.password.length >= 8 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                        <div className={`h-1 flex-1 rounded-full transition-colors ${form.password.length >= 12 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                        <span className="text-[10px] text-gray-400 ml-1">
                          {form.password.length >= 12 ? 'Forte' : form.password.length >= 8 ? 'Boa' : 'Fraca'}
                        </span>
                      </div>
                    )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Plano de Aluguel</Label>
                  <Select value={form.planId} onValueChange={v => set('planId', v ?? '')}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar plano (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {plans.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-gray-400 ml-1.5">— {planTypeLabel(p.type)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.planId && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      ✓ {plans.find(p => p.id === form.planId)?.name} seleccionado
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Apresentação / Bio</Label>
                  <textarea
                    placeholder="Especialista em... com X anos de experiência em..."
                    value={form.bio}
                    onChange={e => set('bio', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 resize-none"
                  />
                </div>

                {/* Summary preview */}
                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/50 space-y-2">
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Resumo do cadastro</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${avatarColor(form.name || 'PT')} flex items-center justify-center text-white text-sm font-black`}>
                      {getInitials(form.name || 'PT')}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{form.name || '—'}</p>
                      <p className="text-xs text-gray-400">{form.email || '—'}</p>
                    </div>
                  </div>
                  {form.specialty && <p className="text-xs text-gray-500">📍 {form.specialty}</p>}
                  {form.phone && <p className="text-xs text-gray-500">📞 {form.phone}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          {step === 1 ? (
            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{ background: '#111111', color: 'white' }}
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!step2Valid || isPending}
                onClick={handleSubmit}
                className="flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                style={{ background: '#111111', color: 'white' }}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Criar Personal Trainer</>}
              </button>
            </div>
          )}
          <p className="text-center text-[10px] text-gray-300">
            🔒 Dados encriptados · Acesso restrito ao administrador
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

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
        <NovoPTSheet
          open={open}
          onOpenChange={setOpen}
          plans={plans}
          onCreate={data => createPT.mutate({ ...data, planId: data.planId || undefined })}
          isPending={createPT.isPending}
        />
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
