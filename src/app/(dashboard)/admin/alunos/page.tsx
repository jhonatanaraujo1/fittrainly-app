'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Plus, Users2, Search, Loader2, UserX,
  Phone, Mail, CalendarDays, Target,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { adminApi, ptApi } from '@/lib/api'
import { getInitials, avatarColor, formatDate } from '@/lib/utils'
import type { MockAluno, MockPT } from '@/lib/mock-db'

type StatusFilter = 'todos' | 'ATIVO' | 'INATIVO' | 'SUSPENSO'

function statusBadge(status: MockAluno['status']) {
  const map: Record<MockAluno['status'], string> = {
    ATIVO:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    INATIVO:  'bg-gray-100 text-gray-500 border-gray-200',
    SUSPENSO: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const label: Record<MockAluno['status'], string> = {
    ATIVO: 'Ativo', INATIVO: 'Inativo', SUSPENSO: 'Suspenso',
  }
  return { cls: map[status] ?? 'bg-gray-100 text-gray-500', label: label[status] ?? status }
}

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'ATIVO',    label: 'Ativo' },
  { key: 'INATIVO',  label: 'Inativo' },
  { key: 'SUSPENSO', label: 'Suspenso' },
]

const EMPTY_FORM = {
  name: '', email: '', phone: '', personalTrainerId: '',
  dataNascimento: '', objetivo: '',
}

export default function AlunosPage() {
  const qc = useQueryClient()
  const [sheetOpen, setSheetOpen]     = useState(false)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [ptFilter, setPtFilter]       = useState('todos')
  const [form, setForm]               = useState(EMPTY_FORM)

  const { data: alunos = [], isLoading } = useQuery<MockAluno[]>({
    queryKey: ['admin-alunos'],
    queryFn: adminApi.allAlunos,
  })

  const { data: pts = [] } = useQuery<MockPT[]>({
    queryKey: ['admin-pts'],
    queryFn: ptApi.list,
  })

  const createAluno = useMutation({
    mutationFn: adminApi.createAluno,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin-alunos'] })
      toast.success(`${created.name} adicionado com sucesso! 🎉`)
      setSheetOpen(false)
      setForm(EMPTY_FORM)
    },
    onError: (err: Error) => toast.error(err.message ?? 'Erro ao criar aluno'),
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.personalTrainerId) {
      toast.error('Nome, email e Personal Trainer são obrigatórios')
      return
    }
    createAluno.mutate({
      name:             form.name,
      email:            form.email,
      phone:            form.phone || undefined,
      personalTrainerId: form.personalTrainerId,
      dataNascimento:   form.dataNascimento || undefined,
      objetivo:         form.objetivo || undefined,
    })
  }

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-6xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Alunos</h1>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {alunos.length}
          </span>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: '#111111' }}
          >
            <Plus className="w-4 h-4" /> Novo Aluno
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Novo Aluno</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome completo *</Label>
                <Input
                  placeholder="Carlos Mendes"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  placeholder="carlos@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input
                  placeholder="+351 912 000 000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Personal Trainer *</Label>
                <Select
                  value={form.personalTrainerId}
                  onValueChange={v => setForm(f => ({ ...f, personalTrainerId: v ?? '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar PT" />
                  </SelectTrigger>
                  <SelectContent>
                    {pts.map(pt => (
                      <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data de Nascimento</Label>
                <Input
                  type="date"
                  value={form.dataNascimento}
                  onChange={e => setForm(f => ({ ...f, dataNascimento: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Objetivo</Label>
                <Textarea
                  placeholder="Emagrecimento, hipertrofia, condicionamento..."
                  value={form.objetivo}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, objetivo: e.target.value }))}
                  className="resize-none"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 text-sm"
                  onClick={() => setSheetOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createAluno.isPending}
                  className="h-9 text-sm text-white min-h-[44px]"
                  style={{ background: '#111111' }}
                >
                  {createAluno.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : 'Criar Aluno'}
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Stats rápidas ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {[
          { label: 'Total de Alunos', value: stats.total,   color: 'text-gray-900' },
          { label: 'Ativos',          value: stats.ativos,  color: 'text-emerald-600' },
          { label: 'Inativos / Susp', value: stats.inativos, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 text-center">
            <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Pesquisa + Filtros ─────────────────────────────────────────── */}
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
        <Select value={ptFilter} onValueChange={v => setPtFilter(v ?? 'todos')}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Filtrar por PT" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os PTs</SelectItem>
            {pts.map(pt => (
              <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Filter chips ───────────────────────────────────────────────── */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 overflow-x-auto max-w-full">
        {FILTER_TABS.map(tab => {
          const count = tab.key === 'todos'
            ? alunos.length
            : alunos.filter(a => a.status === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
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

      {/* ── Grid de cards ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <UserX className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-600 font-semibold">
            {search || statusFilter !== 'todos' || ptFilter !== 'todos'
              ? 'Nenhum aluno encontrado'
              : 'Ainda sem alunos registados'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {search || statusFilter !== 'todos' || ptFilter !== 'todos'
              ? 'Tenta ajustar os filtros'
              : 'Adiciona o primeiro aluno para começar →'}
          </p>
          {!search && statusFilter === 'todos' && ptFilter === 'todos' && (
            <Button
              className="mt-4 h-9 gap-2 text-white text-sm"
              style={{ background: '#111111' }}
              onClick={() => setSheetOpen(true)}
            >
              <Plus className="w-4 h-4" /> Adicionar primeiro aluno
            </Button>
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
                  {/* Avatar + nome + status */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full ${avatarColor(aluno.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {getInitials(aluno.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-black transition-colors">
                        {aluno.name}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
                        {label}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{aluno.email}</span>
                    </div>
                    {aluno.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{aluno.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">PT: {aluno.personalTrainerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Inscrito em {formatDate(aluno.inscricaoDate)}</span>
                    </div>
                    {aluno.objetivo && (
                      <div className="flex items-start gap-2 text-xs text-gray-500">
                        <Target className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{aluno.objetivo}</span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div
                    className="w-full h-8 rounded-md border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600 flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white group-hover:border-transparent transition-all min-h-[44px]"
                  >
                    Ver perfil →
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
