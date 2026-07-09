'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Users2, Search, Loader2, UserX, Phone, Mail,
  CalendarDays, Target, ChevronRight, ChevronLeft, Check,
  Heart, Dumbbell, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { adminApi, ptApi } from '@/lib/api'
import { getInitials, avatarColor, formatDate } from '@/lib/utils'
import type { MockAluno, MockPT } from '@/lib/mock-db'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'todos' | 'ATIVO' | 'INATIVO' | 'SUSPENSO'

const DOENCAS_OPTIONS = [
  { key: 'HIPERTENSAO',  label: 'Hipertensão' },
  { key: 'DIABETES',     label: 'Diabetes' },
  { key: 'CARDIOPATIA',  label: 'Cardiopatia' },
  { key: 'ARTRITE',      label: 'Artrite' },
  { key: 'OSTEOPOROSE',  label: 'Osteoporose' },
  { key: 'ASMA',         label: 'Asma' },
  { key: 'COLUNA',       label: 'Problema de coluna' },
  { key: 'OBESIDADE',    label: 'Obesidade' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: MockAluno['status']) {
  const map: Record<MockAluno['status'], string> = {
    ATIVO:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    INATIVO:  'bg-gray-100 text-gray-500 border-gray-200',
    SUSPENSO: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const label: Record<MockAluno['status'], string> = { ATIVO: 'Ativo', INATIVO: 'Inativo', SUSPENSO: 'Suspenso' }
  return { cls: map[status] ?? 'bg-gray-100 text-gray-500', label: label[status] ?? status }
}

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'ATIVO',    label: 'Ativo' },
  { key: 'INATIVO',  label: 'Inativo' },
  { key: 'SUSPENSO', label: 'Suspenso' },
]

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  // Passo 1 — Dados pessoais
  name: '', email: '', phone: '', personalTrainerId: '',
  dataNascimento: '', genero: '' as '' | 'MASCULINO' | 'FEMININO' | 'OUTRO',
  profissao: '',
  // Passo 2 — Saúde
  doencas: [] as string[], doencasOutras: '', cirurgias: '', medicamentos: '',
  limitacoesFisicas: '', fumante: '' as '' | 'true' | 'false',
  alcool: '' as '' | 'NUNCA' | 'OCASIONAL' | 'FREQUENTE',
  // Passo 3 — Histórico & objetivos
  praticouAtividade: '' as '' | 'true' | 'false',
  atividadeAnterior: '', tempoSemAtividade: '',
  nivelAtividade: '' as '' | 'SEDENTARIO' | 'POUCO_ATIVO' | 'ATIVO' | 'MUITO_ATIVO',
  horasSono: '', nivelEstresse: '' as '' | 'BAIXO' | 'MEDIO' | 'ALTO',
  objetivo: '', prazoObjetivo: '', disponibilidadeSemanal: '',
  observacoesGerais: '',
}

// ── Step indicator ─────────────────────────────────────────────────────────────

const STEPS = [
  { icon: User,   label: 'Dados pessoais' },
  { icon: Heart,  label: 'Saúde' },
  { icon: Dumbbell, label: 'Objetivos' },
]

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const done    = i < step
        const current = i === step
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                done    ? 'bg-emerald-500 text-white' :
                current ? 'bg-gray-900 text-white' :
                          'bg-gray-100 text-gray-400'
              }`}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Multi-step form ────────────────────────────────────────────────────────────

function AlunoForm({ pts, onSuccess }: { pts: MockPT[]; onSuccess: () => void }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const createAluno = useMutation({
    mutationFn: adminApi.createAluno,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin-alunos'] })
      toast.success(`${created.name} adicionado com sucesso! 🎉`)
      setTimeout(() => {
        toast.success(
          `📧 Email de boas-vindas com dados de acesso enviado para ${created.email}`,
          { duration: 5000, id: 'email-aluno-bv' }
        )
      }, 800)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message ?? 'Erro ao criar aluno'),
  })

  function nextStep() {
    if (step === 0) {
      if (!form.name || !form.email || !form.personalTrainerId) {
        toast.error('Nome, email e Personal Trainer são obrigatórios')
        return
      }
    }
    setStep(s => Math.min(s + 1, 2))
  }

  function submit() {
    if (!form.objetivo) {
      toast.error('Objetivo é obrigatório')
      return
    }
    createAluno.mutate({
      name:             form.name,
      email:            form.email,
      phone:            form.phone || undefined,
      personalTrainerId: form.personalTrainerId,
      dataNascimento:   form.dataNascimento || undefined,
      genero:           form.genero || undefined,
      profissao:        form.profissao || undefined,
      doencas:          form.doencas,
      doencasOutras:    form.doencasOutras || undefined,
      cirurgias:        form.cirurgias || undefined,
      medicamentos:     form.medicamentos || undefined,
      limitacoesFisicas: form.limitacoesFisicas || undefined,
      fumante:          form.fumante ? form.fumante === 'true' : undefined,
      alcool:           form.alcool || undefined,
      praticouAtividade: form.praticouAtividade ? form.praticouAtividade === 'true' : undefined,
      atividadeAnterior: form.atividadeAnterior || undefined,
      tempoSemAtividade: form.tempoSemAtividade || undefined,
      nivelAtividade:   form.nivelAtividade || undefined,
      horasSono:        form.horasSono ? parseInt(form.horasSono) : undefined,
      nivelEstresse:    form.nivelEstresse || undefined,
      objetivo:         form.objetivo,
      prazoObjetivo:    form.prazoObjetivo || undefined,
      disponibilidadeSemanal: form.disponibilidadeSemanal ? parseInt(form.disponibilidadeSemanal) : undefined,
      observacoesGerais: form.observacoesGerais || undefined,
    })
  }

  return (
    <div>
      <StepIndicator step={step} />

      <AnimatePresence mode="wait">
        {/* ── Passo 1: Dados pessoais ──────────────────────────────────── */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }} className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Identificação</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome completo *</Label>
              <Input placeholder="Carlos Mendes" value={form.name} onChange={e => set('name', e.target.value)} className="min-h-[44px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" placeholder="carlos@email.com" value={form.email} onChange={e => set('email', e.target.value)} className="min-h-[44px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input placeholder="+351 912 000 000" value={form.phone} onChange={e => set('phone', e.target.value)} className="min-h-[44px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Personal Trainer *</Label>
              <Select value={form.personalTrainerId} onValueChange={v => set('personalTrainerId', v ?? '')} items={pts.map(pt => ({ value: pt.id, label: pt.name }))}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar PT" /></SelectTrigger>
                <SelectContent>{pts.map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data de nascimento</Label>
                <DatePicker value={form.dataNascimento} onChange={v => set('dataNascimento', v)} placeholder="DD/MM/AAAA" maxDate={new Date().toISOString().slice(0, 10)} initialView="2000-01-01" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Género</Label>
                <Select value={form.genero} onValueChange={v => set('genero', (v ?? '') as typeof form.genero)}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MASCULINO">Masculino</SelectItem>
                    <SelectItem value="FEMININO">Feminino</SelectItem>
                    <SelectItem value="OUTRO">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Profissão</Label>
              <Input placeholder="Engenheiro, Professor..." value={form.profissao} onChange={e => set('profissao', e.target.value)} className="min-h-[44px]" />
            </div>
          </motion.div>
        )}

        {/* ── Passo 2: Saúde / Anamnese ────────────────────────────────── */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }} className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Anamnese — Saúde</p>

            <div className="space-y-2">
              <Label className="text-xs">Doenças / Condições de saúde</Label>
              <div className="flex flex-wrap gap-2">
                {DOENCAS_OPTIONS.map(d => {
                  const sel = form.doencas.includes(d.key)
                  return (
                    <button key={d.key} type="button"
                      onClick={() => set('doencas', sel ? form.doencas.filter(x => x !== d.key) : [...form.doencas, d.key])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all min-h-[36px] ${sel ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                      {d.label}
                    </button>
                  )
                })}
              </div>
              <Input placeholder="Outras (descrever)..." value={form.doencasOutras} onChange={e => set('doencasOutras', e.target.value)} className="mt-1 min-h-[40px]" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cirurgias / Lesões passadas</Label>
              <Input placeholder="Ex: Meniscectomia joelho direito (2019)" value={form.cirurgias} onChange={e => set('cirurgias', e.target.value)} className="min-h-[44px]" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Medicamentos em uso</Label>
              <Input placeholder="Ex: Losartana 50mg, Vitamina D" value={form.medicamentos} onChange={e => set('medicamentos', e.target.value)} className="min-h-[44px]" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Limitações físicas / Restrições de exercício</Label>
              <Textarea placeholder="Ex: Evitar impacto elevado no joelho direito..." value={form.limitacoesFisicas} onChange={e => set('limitacoesFisicas', e.target.value)} className="resize-none" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fumante?</Label>
                <Select value={form.fumante} onValueChange={v => set('fumante', (v ?? '') as typeof form.fumante)}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Não</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Consumo de álcool</Label>
                <Select value={form.alcool} onValueChange={v => set('alcool', (v ?? '') as typeof form.alcool)}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NUNCA">Nunca</SelectItem>
                    <SelectItem value="OCASIONAL">Ocasional</SelectItem>
                    <SelectItem value="FREQUENTE">Frequente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Passo 3: Histórico & Objetivos ───────────────────────────── */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }} className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Histórico & Objetivos</p>

            <div className="space-y-2">
              <Label className="text-xs">Praticou atividade física antes?</Label>
              <div className="flex gap-2">
                {(['true', 'false'] as const).map(v => (
                  <button key={v} type="button"
                    onClick={() => set('praticouAtividade', v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors min-h-[44px] ${
                      form.praticouAtividade === v
                        ? v === 'true' ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-200 text-gray-700 border-gray-200'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}>
                    {v === 'true' ? 'Sim' : 'Não'}
                  </button>
                ))}
              </div>
            </div>

            {form.praticouAtividade === 'true' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Qual atividade?</Label>
                  <Input placeholder="Ex: Futebol, natação..." value={form.atividadeAnterior} onChange={e => set('atividadeAnterior', e.target.value)} className="min-h-[44px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Parado há quanto tempo?</Label>
                  <Input placeholder="Ex: 6 meses, 2 anos" value={form.tempoSemAtividade} onChange={e => set('tempoSemAtividade', e.target.value)} className="min-h-[44px]" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Nível de atividade atual</Label>
              <Select value={form.nivelAtividade} onValueChange={v => set('nivelAtividade', (v ?? '') as typeof form.nivelAtividade)}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEDENTARIO">Sedentário (sem exercício regular)</SelectItem>
                  <SelectItem value="POUCO_ATIVO">Pouco ativo (1-2×/semana)</SelectItem>
                  <SelectItem value="ATIVO">Ativo (3-4×/semana)</SelectItem>
                  <SelectItem value="MUITO_ATIVO">Muito ativo (5+×/semana)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Horas de sono/noite</Label>
                <Select value={form.horasSono} onValueChange={v => set('horasSono', v ?? '')}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {['4', '5', '6', '7', '8', '9', '10'].map(h => <SelectItem key={h} value={h}>{h}h</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nível de estresse</Label>
                <Select value={form.nivelEstresse} onValueChange={v => set('nivelEstresse', (v ?? '') as typeof form.nivelEstresse)}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAIXO">Baixo</SelectItem>
                    <SelectItem value="MEDIO">Médio</SelectItem>
                    <SelectItem value="ALTO">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Objetivo</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Objetivo principal *</Label>
                <Textarea placeholder="Ex: Hipertrofia e definição muscular, emagrecimento..." value={form.objetivo} onChange={e => set('objetivo', e.target.value)} className="resize-none" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Prazo pretendido</Label>
                  <Select value={form.prazoObjetivo} onValueChange={v => set('prazoObjetivo', v ?? '')}>
                    <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 mês">1 mês</SelectItem>
                      <SelectItem value="3 meses">3 meses</SelectItem>
                      <SelectItem value="6 meses">6 meses</SelectItem>
                      <SelectItem value="8 meses">8 meses</SelectItem>
                      <SelectItem value="12 meses">12 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dias/semana disponíveis</Label>
                  <Select value={form.disponibilidadeSemanal} onValueChange={v => set('disponibilidadeSemanal', v ?? '')}>
                    <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {['1', '2', '3', '4', '5', '6'].map(d => <SelectItem key={d} value={d}>{d}×/semana</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Observações gerais</Label>
                <Textarea placeholder="Informações adicionais relevantes..." value={form.observacoesGerais} onChange={e => set('observacoesGerais', e.target.value)} className="resize-none" rows={2} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-2 pt-5 mt-2 border-t border-gray-100">
        {step > 0 && (
          <button type="button" onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-1.5 h-11 px-4 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
        )}
        <div className="flex-1" />
        {step < 2 ? (
          <button type="button" onClick={nextStep}
            className="flex items-center gap-1.5 h-11 px-5 text-sm font-semibold rounded-xl text-white transition-colors hover:opacity-90"
            style={{ background: '#111111' }}>
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={createAluno.isPending}
            className="flex items-center gap-2 h-11 px-5 text-sm font-semibold rounded-xl text-white disabled:opacity-50 transition-colors hover:opacity-90"
            style={{ background: '#111111' }}>
            {createAluno.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Criar Aluno</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AlunosPage() {
  const qc = useQueryClient()
  const [sheetOpen, setSheetOpen]       = useState(false)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [ptFilter, setPtFilter]         = useState('todos')

  const { data: alunos = [], isLoading } = useQuery<MockAluno[]>({
    queryKey: ['admin-alunos'],
    queryFn: adminApi.allAlunos,
  })

  const { data: pts = [] } = useQuery<MockPT[]>({
    queryKey: ['admin-pts'],
    queryFn: ptApi.list,
  })

  const filtered = useMemo(() => {
    let list = [...alunos]
    const q = search.toLowerCase().trim()
    if (q) {
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.phone ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'todos') list = list.filter(a => a.status === statusFilter)
    if (ptFilter !== 'todos') list = list.filter(a => a.personalTrainerId === ptFilter)
    return list
  }, [alunos, search, statusFilter, ptFilter])

  const stats = useMemo(() => ({
    total:    alunos.length,
    ativos:   alunos.filter(a => a.status === 'ATIVO').length,
    inativos: alunos.filter(a => a.status !== 'ATIVO').length,
  }), [alunos])

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Alunos</h1>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{alunos.length}</span>
        </div>

        <Sheet open={sheetOpen} onOpenChange={open => { setSheetOpen(open) }}>
          <SheetTrigger
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90 min-h-[44px]"
            style={{ background: '#111111' }}
          >
            <Plus className="w-4 h-4" /> Novo Aluno
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="mb-2">
              <SheetTitle>Novo Aluno — Ficha Completa</SheetTitle>
            </SheetHeader>
            <AlunoForm
              pts={pts}
              onSuccess={() => setSheetOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {[
          { label: 'Total de Alunos', value: stats.total,    color: 'text-gray-900' },
          { label: 'Ativos',          value: stats.ativos,   color: 'text-emerald-600' },
          { label: 'Inativos / Susp', value: stats.inativos, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 text-center">
            <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + PT filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por nome, email ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ptFilter} onValueChange={v => setPtFilter(v ?? 'todos')} items={[{ value: 'todos', label: 'Todos os PTs' }, ...pts.map(pt => ({ value: pt.id, label: pt.name }))]}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Filtrar por PT" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os PTs</SelectItem>
            {pts.map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Status filter chips */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 overflow-x-auto max-w-full">
        {FILTER_TABS.map(tab => {
          const count = tab.key === 'todos' ? alunos.length : alunos.filter(a => a.status === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                statusFilter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                statusFilter === tab.key ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <UserX className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-600 font-semibold">
            {search || statusFilter !== 'todos' || ptFilter !== 'todos' ? 'Nenhum aluno encontrado' : 'Ainda sem alunos registados'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {search || statusFilter !== 'todos' || ptFilter !== 'todos' ? 'Tenta ajustar os filtros' : 'Adiciona o primeiro aluno para começar →'}
          </p>
          {!search && statusFilter === 'todos' && ptFilter === 'todos' && (
            <button
              className="mt-4 h-9 gap-2 text-white text-sm px-4 rounded-lg inline-flex items-center"
              style={{ background: '#111111' }}
              onClick={() => setSheetOpen(true)}
            >
              <Plus className="w-4 h-4" /> Adicionar primeiro aluno
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((aluno, i) => {
            const { cls, label } = statusBadge(aluno.status)
            return (
              <motion.div
                key={aluno.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.03 }}
              >
                <Link
                  href={`/admin/alunos/${aluno.id}`}
                  className="block bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-gray-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full ${avatarColor(aluno.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {getInitials(aluno.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-black transition-colors">{aluno.name}</p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>{label}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{aluno.email}</span>
                    </div>
                    {aluno.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" /><span>{aluno.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users2 className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">PT: {aluno.personalTrainerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" /><span>Inscrito em {formatDate(aluno.inscricaoDate)}</span>
                    </div>
                    {aluno.objetivo && (
                      <div className="flex items-start gap-2 text-xs text-gray-500">
                        <Target className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span className="line-clamp-1">{aluno.objetivo}</span>
                      </div>
                    )}
                  </div>

                  <div className="w-full h-8 rounded-md border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600 flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white group-hover:border-transparent transition-all min-h-[44px]">
                    Ver ficha →
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
