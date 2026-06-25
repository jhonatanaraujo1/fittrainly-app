'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ChevronDown, Plus, Loader2, AlertTriangle,
  CalendarDays, Activity, Package, ClipboardList, History,
  Scale, Ruler, Percent, Dumbbell, CheckCircle2, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { adminApi, avaliacaoApi, packApi } from '@/lib/api'
import {
  getInitials, avatarColor, formatDate, formatTime, bookingStatusLabel, bookingStatusColor,
} from '@/lib/utils'
import type { MockAluno, MockBooking, MockPack, MockAvaliacao, MockWorkoutPlan } from '@/lib/mock-db'

// ── Types ──────────────────────────────────────────────────────────────────────
interface AlunoDetail {
  aluno: MockAluno
  bookings: MockBooking[]
  packs: MockPack[]
  avaliacoes: MockAvaliacao[]
  workoutPlan: MockWorkoutPlan | undefined
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusBadgeCls(status: MockAluno['status']) {
  return {
    ATIVO:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    INATIVO:  'bg-gray-100 text-gray-500 border-gray-200',
    SUSPENSO: 'bg-amber-50 text-amber-700 border-amber-200',
  }[status] ?? 'bg-gray-100 text-gray-500'
}

function packStatusCls(status: MockPack['status']) {
  return {
    ACTIVE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    EXPIRED:  'bg-gray-100 text-gray-500 border-gray-200',
    DEPLETED: 'bg-red-50 text-red-600 border-red-200',
  }[status] ?? 'bg-gray-100 text-gray-500'
}

function packStatusLabel(status: MockPack['status']) {
  return { ACTIVE: 'Ativo', EXPIRED: 'Expirado', DEPLETED: 'Esgotado' }[status] ?? status
}

function calcIMC(peso?: number, altura?: number): string {
  if (!peso || !altura) return '—'
  const imc = peso / ((altura / 100) ** 2)
  return imc.toFixed(1)
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AlunoPerfilPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const qc      = useQueryClient()

  const [evalSheetOpen, setEvalSheetOpen] = useState(false)
  const [packModalOpen, setPackModalOpen] = useState(false)
  const [bookingStatusFilter, setBookingStatusFilter] = useState('todos')

  // ── Eval form ────────────────────────────────────────────────────────────────
  const evalFormInit = {
    tipo: 'PRIMEIRA' as 'PRIMEIRA' | 'REAVALIACAO',
    data: '', diasTreino: [] as string[], peso: '', altura: '',
    percentualGordura: '', massaMuscular: '', objetivo: '',
    observacoes: '',
    marcarProximaAF: '' as '' | 'sim' | 'nao',
    proximaAFDate: '',
    lembreteDate: '',
    prescricaoPlanoDate: '',
  }
  const [evalForm, setEvalForm] = useState(evalFormInit)

  // ── Pack form ────────────────────────────────────────────────────────────────
  const [packTotal, setPackTotal]       = useState('10')
  const [packExpires, setPackExpires]   = useState('')

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery<AlunoDetail>({
    queryKey: ['aluno', id],
    queryFn: () => adminApi.alunoById(id),
    enabled: !!id,
  })

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: (status: MockAluno['status']) => adminApi.updateAluno(id, { status }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['aluno', id] })
      qc.invalidateQueries({ queryKey: ['admin-alunos'] })
      toast.success(`Status atualizado para ${updated.status}`)
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })

  const createEval = useMutation({
    mutationFn: avaliacaoApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno', id] })
      toast.success('Avaliação registada com sucesso! 🎉')
      setEvalSheetOpen(false)
      setEvalForm(evalFormInit)
    },
    onError: () => toast.error('Erro ao registar avaliação'),
  })

  const createPack = useMutation({
    mutationFn: packApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aluno', id] })
      toast.success('Pack adicionado com sucesso! 🎉')
      setPackModalOpen(false)
      setPackTotal('10')
      setPackExpires('')
    },
    onError: () => toast.error('Erro ao criar pack'),
  })

  // ── Derived ──────────────────────────────────────────────────────────────────
  const now = new Date()

  const activePack = useMemo(() => {
    if (!data?.packs) return undefined
    return [...data.packs]
      .filter(p => p.status === 'ACTIVE')
      .sort((a, b) => (b.total - b.used) - (a.total - a.used))[0]
  }, [data])

  const lastBookings = useMemo(() =>
    (data?.bookings ?? [])
      .filter(b => b.status !== 'CANCELLED')
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 5),
    [data]
  )

  const filteredBookings = useMemo(() => {
    const all = [...(data?.bookings ?? [])].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )
    if (bookingStatusFilter === 'todos') return all
    return all.filter(b => b.status === bookingStatusFilter)
  }, [data, bookingStatusFilter])

  const sortedAvaliacoes = useMemo(() =>
    [...(data?.avaliacoes ?? [])].sort(
      (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
    ), [data]
  )

  // IMC em tempo real no form
  const liveIMC = calcIMC(
    parseFloat(evalForm.peso) || undefined,
    parseFloat(evalForm.altura) || undefined,
  )

  // ── Submit eval ──────────────────────────────────────────────────────────────
  function handleEvalSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!evalForm.data) {
      toast.error('A data é obrigatória')
      return
    }
    if (!data?.aluno) return
    createEval.mutate({
      alunoId:           id,
      alunoName:         data.aluno.name,
      ptId:              data.aluno.personalTrainerId,
      tipo:              evalForm.tipo,
      data:              evalForm.data,
      frequenciaSemanal: evalForm.diasTreino.length > 0 ? evalForm.diasTreino.length : undefined,
      peso:              evalForm.peso     ? parseFloat(evalForm.peso)     : undefined,
      altura:            evalForm.altura   ? parseFloat(evalForm.altura)   : undefined,
      imc:               evalForm.peso && evalForm.altura ? parseFloat(calcIMC(parseFloat(evalForm.peso), parseFloat(evalForm.altura))) : undefined,
      percentualGordura: evalForm.percentualGordura ? parseFloat(evalForm.percentualGordura) : undefined,
      massaMuscular:     evalForm.massaMuscular     ? parseFloat(evalForm.massaMuscular)     : undefined,
      objetivo:          evalForm.objetivo || undefined,
      observacoes:       evalForm.observacoes || undefined,
      proximaAvaliacao:  evalForm.marcarProximaAF === 'sim' ? evalForm.proximaAFDate || undefined : undefined,
    })
  }

  // ── Submit pack ──────────────────────────────────────────────────────────────
  function handlePackSubmit(e: React.FormEvent) {
    e.preventDefault()
    createPack.mutate({
      alunoId:   id,
      total:     parseInt(packTotal),
      expiresAt: packExpires || undefined,
    })
  }

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-5 lg:p-7 space-y-5 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-7 text-center">
        <p className="text-gray-500">Aluno não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/alunos')}>
          ← Voltar
        </Button>
      </div>
    )
  }

  const { aluno, packs, workoutPlan } = data

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-5xl mx-auto">

      {/* ── Back ──────────────────────────────────────────────────────────── */}
      <button
        onClick={() => router.push('/admin/alunos')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Alunos
      </button>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-2xl ${avatarColor(aluno.name)} flex items-center justify-center text-white text-xl font-black flex-shrink-0`}>
            {getInitials(aluno.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-black text-gray-900 tracking-tight">{aluno.name}</h1>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${statusBadgeCls(aluno.status)}`}>
                {aluno.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">{aluno.email}</p>
            {aluno.phone && <p className="text-sm text-gray-500">{aluno.phone}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
              <span>PT: <span className="text-gray-600 font-medium">{aluno.personalTrainerName}</span></span>
              <span>Inscrito em <span className="text-gray-600 font-medium">{formatDate(aluno.inscricaoDate)}</span></span>
              {aluno.objetivo && (
                <span className="text-gray-500 italic">"{aluno.objetivo}"</span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {/* Editar status */}
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-sm font-medium bg-white hover:bg-gray-50 min-h-[44px] transition-colors disabled:opacity-50"
              >
                {updateStatus.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : 'Editar status'}
                <ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(['ATIVO', 'INATIVO', 'SUSPENSO'] as MockAluno['status'][]).map(s => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => updateStatus.mutate(s)}
                    className={aluno.status === s ? 'font-semibold' : ''}
                  >
                    {s === 'ATIVO' && <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />}
                    {s === 'INATIVO' && <Clock className="w-4 h-4 mr-2 text-gray-400" />}
                    {s === 'SUSPENSO' && <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />}
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Adicionar Pack rápido */}
            <Dialog open={packModalOpen} onOpenChange={setPackModalOpen}>
              <DialogTrigger
                onClick={() => setPackModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-white text-sm font-medium min-h-[44px] transition-colors hover:opacity-90"
                style={{ background: '#111111' }}
              >
                <Plus className="w-4 h-4" /> Pack
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Novo Pack de Sessões</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePackSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total de sessões *</Label>
                    <Select value={packTotal} onValueChange={v => setPackTotal(v ?? '10')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['5', '10', '20'].map(v => (
                          <SelectItem key={v} value={v}>{v} sessões</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de validade</Label>
                    <Input type="date" value={packExpires} onChange={e => setPackExpires(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setPackModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createPack.isPending} className="h-9 text-sm text-white" style={{ background: '#111111' }}>
                      {createPack.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Pack'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-gray-100 p-0.5 overflow-x-auto w-full flex">
          <TabsTrigger value="overview" className="gap-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0">
            <Activity className="w-3.5 h-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="gap-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0">
            <Scale className="w-3.5 h-3.5" /> Avaliações
          </TabsTrigger>
          <TabsTrigger value="packs" className="gap-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0">
            <Package className="w-3.5 h-3.5" /> Packs
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0">
            <History className="w-3.5 h-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Visão Geral ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">

            {/* Últimas sessões */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-400" /> Últimas sessões
              </h3>
              {lastBookings.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sem sessões registadas</p>
              ) : (
                <ul className="space-y-2">
                  {lastBookings.map(b => (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-gray-800">
                          {formatDate(b.startTime)}
                        </p>
                        <p className="text-[11px] text-gray-400">{formatTime(b.startTime)} — {formatTime(b.endTime)}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${bookingStatusColor(b.status)}`}>
                        {bookingStatusLabel(b.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              {/* Pack ativo */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" /> Pack ativo
                </h3>
                {!activePack ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sem pack ativo</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {activePack.total - activePack.used} de {activePack.total} sessões restantes
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${packStatusCls(activePack.status)}`}>
                        {packStatusLabel(activePack.status)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-emerald-500"
                        style={{ width: `${((activePack.total - activePack.used) / activePack.total) * 100}%` }}
                      />
                    </div>
                    {activePack.expiresAt && (
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Válido até {formatDate(activePack.expiresAt)}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Plano de treino */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-gray-400" /> Plano de treino
                </h3>
                {!workoutPlan ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sem plano de treino</p>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{workoutPlan.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{workoutPlan.focus}</p>
                    {workoutPlan.validUntil && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          new Date(workoutPlan.validUntil) > now
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {new Date(workoutPlan.validUntil) > now ? 'Válido' : 'Expirado'}
                        </span>
                        <span className="text-[11px] text-gray-400">até {formatDate(workoutPlan.validUntil)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB 2: Avaliações ──────────────────────────────────────────── */}
        <TabsContent value="avaliacoes" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Avaliações Físicas</h3>
            <Sheet open={evalSheetOpen} onOpenChange={setEvalSheetOpen}>
              <SheetTrigger
                onClick={() => setEvalSheetOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-white text-xs font-medium min-h-[44px] transition-colors hover:opacity-90"
                style={{ background: '#111111' }}
              >
                <Plus className="w-3.5 h-3.5" /> Nova Avaliação
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Nova Avaliação</SheetTitle>
                </SheetHeader>
                <form onSubmit={handleEvalSubmit} className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={evalForm.tipo} onValueChange={v => setEvalForm(f => ({ ...f, tipo: (v ?? 'PRIMEIRA') as 'PRIMEIRA' | 'REAVALIACAO' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRIMEIRA">1ª Avaliação</SelectItem>
                          <SelectItem value="REAVALIACAO">Reavaliação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-xs">Data *</Label>
                      <Input type="date" value={evalForm.data} onChange={e => setEvalForm(f => ({ ...f, data: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Peso (kg)</Label>
                      <Input type="number" step="0.1" placeholder="75.0" value={evalForm.peso} onChange={e => setEvalForm(f => ({ ...f, peso: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Altura (cm)</Label>
                      <Input type="number" placeholder="175" value={evalForm.altura} onChange={e => setEvalForm(f => ({ ...f, altura: e.target.value }))} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-xs">IMC (calculado automaticamente)</Label>
                      <div className={`h-9 flex items-center px-3 rounded-md border text-sm font-medium ${liveIMC !== '—' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        {liveIMC}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">% Gordura</Label>
                      <Input type="number" step="0.1" placeholder="22.0" value={evalForm.percentualGordura} onChange={e => setEvalForm(f => ({ ...f, percentualGordura: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Massa Muscular (kg)</Label>
                      <Input type="number" step="0.1" placeholder="35.0" value={evalForm.massaMuscular} onChange={e => setEvalForm(f => ({ ...f, massaMuscular: e.target.value }))} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-xs">Objetivo</Label>
                      <Input placeholder="Hipertrofia, emagrecimento..." value={evalForm.objetivo} onChange={e => setEvalForm(f => ({ ...f, objetivo: e.target.value }))} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <Label className="text-xs">Observações</Label>
                      <Textarea rows={2} className="resize-none" placeholder="Histórico de lesões, observações gerais..." value={evalForm.observacoes} onChange={e => setEvalForm(f => ({ ...f, observacoes: e.target.value }))} />
                    </div>
                  </div>

                  {/* ── Fecho da Avaliação ──────────────────────────────── */}
                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Fecho da Avaliação</p>

                    {/* P1: Dias de treino */}
                    <div className="space-y-2">
                      <Label className="text-xs">P1. Dias de treino por semana</Label>
                      <div className="flex flex-wrap gap-2">
                        {(['2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb'] as const).map(dia => {
                          const selected = evalForm.diasTreino.includes(dia)
                          return (
                            <button
                              key={dia}
                              type="button"
                              onClick={() => setEvalForm(f => ({
                                ...f,
                                diasTreino: selected
                                  ? f.diasTreino.filter(d => d !== dia)
                                  : [...f.diasTreino, dia],
                              }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] ${
                                selected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                              }`}
                            >
                              {dia}
                            </button>
                          )
                        })}
                        {evalForm.diasTreino.length > 0 && (
                          <span className="text-xs text-gray-400 self-center">{evalForm.diasTreino.length}×/semana</span>
                        )}
                      </div>
                    </div>

                    {/* P2: Marcar próxima AF? */}
                    <div className="space-y-2">
                      <Label className="text-xs">P2. Pretende marcar já a próxima Avaliação Física?</Label>
                      <div className="flex gap-2">
                        {(['sim', 'nao'] as const).map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setEvalForm(f => ({ ...f, marcarProximaAF: v }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[40px] ${
                              evalForm.marcarProximaAF === v
                                ? v === 'sim' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-200'
                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {v === 'sim' ? 'Sim' : 'Não'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* P3: Data próxima AF (se Sim) */}
                    {evalForm.marcarProximaAF === 'sim' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">P3. Data da próxima Avaliação Física <span className="text-gray-400 font-normal">(máx. 90 dias)</span></Label>
                        <Input
                          type="date"
                          value={evalForm.proximaAFDate}
                          min={new Date().toISOString().split('T')[0]}
                          max={new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]}
                          onChange={e => setEvalForm(f => ({ ...f, proximaAFDate: e.target.value }))}
                        />
                      </div>
                    )}

                    {/* P4: Lembrete (se Não) */}
                    {evalForm.marcarProximaAF === 'nao' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">P4. Data de lembrete para marcar a próxima AF <span className="text-gray-400 font-normal">(máx. 90 dias)</span></Label>
                        <Input
                          type="date"
                          value={evalForm.lembreteDate}
                          min={new Date().toISOString().split('T')[0]}
                          max={new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]}
                          onChange={e => setEvalForm(f => ({ ...f, lembreteDate: e.target.value }))}
                        />
                      </div>
                    )}

                    {/* P5: Prescrição do plano */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">P5. Data para Prescrição do Plano de Treino <span className="text-gray-400 font-normal">(máx. 7 dias)</span></Label>
                      <Input
                        type="date"
                        value={evalForm.prescricaoPlanoDate}
                        min={new Date().toISOString().split('T')[0]}
                        max={new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
                        onChange={e => setEvalForm(f => ({ ...f, prescricaoPlanoDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setEvalSheetOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createEval.isPending} className="h-9 text-sm text-white min-h-[44px]" style={{ background: '#111111' }}>
                      {createEval.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registar Avaliação'}
                    </Button>
                  </div>
                </form>
              </SheetContent>
            </Sheet>
          </div>

          {sortedAvaliacoes.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Scale className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Nenhuma avaliação registada</p>
              <p className="text-sm text-gray-400 mt-1">
                Realize a 1ª avaliação para começar o acompanhamento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedAvaliacoes.map((av, i) => (
                <motion.div
                  key={av.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{formatDate(av.data)}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                        av.tipo === 'PRIMEIRA'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-violet-50 text-violet-700 border-violet-200'
                      }`}>
                        {av.tipo === 'PRIMEIRA' ? '1ª Avaliação' : 'Reavaliação'}
                      </span>
                    </div>
                    {av.proximaAvaliacao && (
                      <p className="text-[11px] text-gray-400">
                        Próxima: {formatDate(av.proximaAvaliacao)}
                      </p>
                    )}
                  </div>

                  {/* Métricas em grid */}
                  {(av.peso || av.altura || av.imc || av.percentualGordura || av.massaMuscular) && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                      {av.peso && (
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <Scale className="w-3.5 h-3.5 text-gray-400 mx-auto mb-1" />
                          <p className="text-sm font-black text-gray-900">{av.peso}kg</p>
                          <p className="text-[10px] text-gray-400">Peso</p>
                        </div>
                      )}
                      {av.altura && (
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <Ruler className="w-3.5 h-3.5 text-gray-400 mx-auto mb-1" />
                          <p className="text-sm font-black text-gray-900">{av.altura}cm</p>
                          <p className="text-[10px] text-gray-400">Altura</p>
                        </div>
                      )}
                      {av.imc && (
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <Activity className="w-3.5 h-3.5 text-gray-400 mx-auto mb-1" />
                          <p className="text-sm font-black text-gray-900">{av.imc}</p>
                          <p className="text-[10px] text-gray-400">IMC</p>
                        </div>
                      )}
                      {av.percentualGordura !== undefined && (
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <Percent className="w-3.5 h-3.5 text-gray-400 mx-auto mb-1" />
                          <p className="text-sm font-black text-gray-900">{av.percentualGordura}%</p>
                          <p className="text-[10px] text-gray-400">Gordura</p>
                        </div>
                      )}
                      {av.massaMuscular !== undefined && (
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <Dumbbell className="w-3.5 h-3.5 text-gray-400 mx-auto mb-1" />
                          <p className="text-sm font-black text-gray-900">{av.massaMuscular}kg</p>
                          <p className="text-[10px] text-gray-400">Muscular</p>
                        </div>
                      )}
                    </div>
                  )}

                  {av.objetivo && (
                    <p className="text-xs text-gray-600 mb-1">
                      <span className="font-medium text-gray-700">Objetivo:</span> {av.objetivo}
                    </p>
                  )}
                  {av.observacoes && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2 leading-relaxed">
                      {av.observacoes}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 3: Packs ──────────────────────────────────────────────── */}
        <TabsContent value="packs" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Packs de Sessões</h3>
            <Dialog open={packModalOpen} onOpenChange={setPackModalOpen}>
              <DialogTrigger
                onClick={() => setPackModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-white text-xs font-medium min-h-[44px] transition-colors hover:opacity-90"
                style={{ background: '#111111' }}
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Pack
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Novo Pack de Sessões</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePackSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Total de sessões *</Label>
                    <Select value={packTotal} onValueChange={v => setPackTotal(v ?? '10')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['5', '10', '20'].map(v => (
                          <SelectItem key={v} value={v}>{v} sessões</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de validade</Label>
                    <Input type="date" value={packExpires} onChange={e => setPackExpires(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setPackModalOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createPack.isPending} className="h-9 text-sm text-white" style={{ background: '#111111' }}>
                      {createPack.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Pack'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {packs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Sem packs registados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {packs.map((pack, i) => {
                const remaining = pack.total - pack.used
                const pct = (remaining / pack.total) * 100
                const isLast = remaining === 1
                return (
                  <motion.div
                    key={pack.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className={`bg-white rounded-xl border shadow-sm p-5 ${isLast ? 'border-amber-200' : 'border-gray-100'}`}
                  >
                    {isLast && (
                      <div className="flex items-center gap-2 mb-3 text-amber-600 text-xs font-medium bg-amber-50 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        Última sessão disponível neste pack
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {remaining} / {pack.total} sessões restantes
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${packStatusCls(pack.status)}`}>
                        {packStatusLabel(pack.status)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {pack.expiresAt && (
                      <p className="text-[11px] text-gray-400">Válido até {formatDate(pack.expiresAt)}</p>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 4: Histórico ───────────────────────────────────────────── */}
        <TabsContent value="historico" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Histórico de Sessões</h3>
            <Select value={bookingStatusFilter} onValueChange={v => setBookingStatusFilter(v ?? 'todos')}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="CONFIRMED">Confirmadas</SelectItem>
                <SelectItem value="COMPLETED">Realizadas</SelectItem>
                <SelectItem value="CANCELLED">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Nenhuma sessão registada</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Data</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Hora</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">PT</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map(b => (
                    <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-700">{formatDate(b.startTime)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatTime(b.startTime)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{b.personalTrainerName}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${bookingStatusColor(b.status)}`}>
                          {bookingStatusLabel(b.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
