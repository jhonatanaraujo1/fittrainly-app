'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Phone, Mail, Dumbbell, Calendar, Clock, Receipt,
  CheckCircle2, AlertTriangle, Users, Edit2, X, Loader2, KeyRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { pt as ptLocale } from 'date-fns/locale'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PtDocuments } from '@/components/pt-documents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ptApi, adminApi, billingApi, planApi } from '@/lib/api'
import {
  getInitials, avatarColor, formatCurrency, formatDate,
  planTypeLabel, planTypeBadge, bookingStatusLabel, bookingStatusColor, docStatus,
} from '@/lib/utils'
import { whatsappCredentialsUrl } from '@/lib/notify'
import type { PersonalTrainer, RentalPlan, BillingEntry } from '@/types'
import type { MockAluno, MockBooking } from '@/lib/mock-db'

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(s: MockAluno['status']) {
  const map: Record<MockAluno['status'], string> = {
    ATIVO:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    INATIVO:  'bg-gray-100 text-gray-500 border-gray-200',
    SUSPENSO: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const label: Record<MockAluno['status'], string> = { ATIVO: 'Ativo', INATIVO: 'Inativo', SUSPENSO: 'Suspenso' }
  return { cls: map[s] ?? 'bg-gray-100 text-gray-500', label: label[s] ?? s }
}

// ── Edit Sheet ────────────────────────────────────────────────────────────────

function EditSheet({ pt, plans, onClose }: {
  pt: PersonalTrainer
  plans: RentalPlan[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:      pt.name,
    email:     pt.email ?? '',
    phone:     pt.phone ?? '',
    specialty: pt.specialty ?? '',
    bio:       pt.bio ?? '',
    planId:    pt.plan?.id ?? '',
    teefNumber:          pt.teefNumber ?? '',
    teefValidUntil:      pt.teefValidUntil ?? '',
    insuranceValidUntil: pt.insuranceValidUntil ?? '',
    taxId:               (pt as { taxId?: string }).taxId ?? '',
    address:             (pt as { address?: string }).address ?? '',
  })

  const update = useMutation({
    mutationFn: () => ptApi.update(pt.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pt-detail', pt.id] })
      qc.invalidateQueries({ queryKey: ['admin-pts'] })
      toast.success('Perfil actualizado ✅')
      onClose()
    },
    // A mensagem real importa: "Email já cadastrado" é acionável, "Erro ao
    // actualizar PT" faz o admin tentar de novo às cegas.
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao actualizar PT'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.22 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Editar Personal Trainer</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); update.mutate() }} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nome</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</Label>
            <Input
              type="email" inputMode="email" autoComplete="off"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="pt@exemplo.com"
              className="min-h-[44px]"
            />
            <p className="text-[11px] text-gray-500">É o login do PT. Alterar aqui muda o acesso dele à plataforma.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Telefone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+351 912 000 000" className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Especialidade</Label>
            <Input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} className="min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Plano de aluguel</Label>
            <Select value={form.planId} onValueChange={v => setForm(f => ({ ...f, planId: v ?? '' }))} items={plans.map(p => ({ value: p.id, label: `${p.name} — ${planTypeLabel(p.type)}` }))}>
              <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
              <SelectContent>
                {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {planTypeLabel(p.type)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Número TEEF</Label>
            <Input value={form.teefNumber} onChange={e => setForm(f => ({ ...f, teefNumber: e.target.value }))} placeholder="TEEF-2026-00000" className="min-h-[44px]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Validade TEEF</Label>
              <DatePicker value={form.teefValidUntil} onChange={v => setForm(f => ({ ...f, teefValidUntil: v }))} placeholder="Selecionar data" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Validade Seguro</Label>
              <DatePicker value={form.insuranceValidUntil} onChange={v => setForm(f => ({ ...f, insuranceValidUntil: v }))} placeholder="Selecionar data" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">NIF</Label>
              <Input value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} placeholder="Contribuinte" className="min-h-[44px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Morada</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Morada fiscal" className="min-h-[44px]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bio</Label>
            <textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
          </div>
          {/* Documentos (seguro/cédula) — o upload é imediato e independente
              do "Guardar" acima, por isso vai avisado para não confundir. */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <div className="flex items-baseline justify-between gap-2 pt-3">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Documentos</Label>
              <span className="text-[11px] text-gray-400">Guardado ao enviar — não precisa do &ldquo;Guardar&rdquo;</span>
            </div>
            <PtDocuments ptId={pt.id} />
          </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-100 flex-shrink-0 bg-white">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 min-h-[44px]">
              Cancelar
            </button>
            <button type="submit" disabled={update.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#111111' }}>
              {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PTDetailPage({ params }: { params: Promise<{ ptId: string }> }) {
  const { ptId } = use(params)
  const router = useRouter()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [tab, setTab] = useState<'alunos' | 'sessoes'>('alunos')
  const [resetResult, setResetResult] = useState<{ tempPassword: string; emailSent: boolean } | null>(null)

  const { data: pt, isLoading: ptLoading } = useQuery<PersonalTrainer>({
    queryKey: ['admin-pt-detail', ptId],
    queryFn: async () => {
      const list = await ptApi.list()
      const found = list.find((p: PersonalTrainer) => p.id === ptId)
      if (!found) throw new Error('PT não encontrado')
      return found
    },
  })

  const { data: plans = [] } = useQuery<RentalPlan[]>({ queryKey: ['plans'], queryFn: planApi.list })

  const { data: alunos = [] } = useQuery<MockAluno[]>({
    queryKey: ['admin-pt-alunos', ptId],
    queryFn: () => adminApi.alunosByPt(ptId),
  })

  const { data: billing } = useQuery<{ entries: BillingEntry[]; total: number; month: string }>({
    queryKey: ['billing', new Date().toISOString().slice(0, 7)],
    queryFn: () => billingApi.byMonth(),
  })

  const ptBilling = billing?.entries.find(e => e.ptId === ptId)

  // Sessões do mês: da faturação REAL do backend (sessionsCount). A lista de
  // sessões recentes ainda não tem endpoint dedicado — fica vazia (a aba mostra
  // o empty state) em vez de ler dados fake do mock.
  const recentBookings: MockBooking[] = []
  const sessionsThisMonth = ptBilling?.sessionsCount ?? 0

  const toggleInadimplente = useMutation({
    mutationFn: (value: boolean) => ptApi.update(ptId, { inadimplente: value }),
    onSuccess: (_, value) => {
      qc.invalidateQueries({ queryKey: ['admin-pt-detail', ptId] })
      qc.invalidateQueries({ queryKey: ['admin-pts'] })
      toast.success(value ? 'PT marcado como inadimplente' : 'PT marcado como em dia ✅')
    },
  })

  const toggleActive = useMutation({
    mutationFn: (value: boolean) => ptApi.update(ptId, { active: value }),
    onSuccess: (_, value) => {
      qc.invalidateQueries({ queryKey: ['admin-pt-detail', ptId] })
      qc.invalidateQueries({ queryKey: ['admin-pts'] })
      toast.success(value ? 'PT ativado ✅' : 'PT desativado')
    },
  })

  // Reset forçado — para quando o PT perde o acesso e não pode/quer esperar
  // pelo self-service de "esqueci a password". Gera uma nova password, tenta
  // email real, e mostra sempre a password + um link de WhatsApp pronto,
  // para o admin nunca ficar sem forma de entregar o acesso.
  const resetPassword = useMutation({
    mutationFn: () => {
      if (!pt) throw new Error('PT não carregado')
      // ptApi.resetPassword existe no mock E no real (POST
      // /personal-trainers/{id}/reset-password) e devolve {tempPassword,
      // emailSent} — antes chamava authApi.adminResetPassword, que só o
      // mock tinha, quebrando em produção com "is not a function".
      return ptApi.resetPassword(pt.id)
    },
    onSuccess: (result) => {
      setResetResult(result)
      if (result.emailSent) toast.success('Nova password enviada por email')
    },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível gerar nova password'),
  })

  if (ptLoading) {
    return (
      <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-5">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!pt) return (
    <div className="p-7 text-center text-gray-400">
      <p>PT não encontrado.</p>
      <button onClick={() => router.back()} className="text-sm text-[#2E75B6] mt-2 hover:underline">← Voltar</button>
    </div>
  )

  const avatarBg = avatarColor(pt.name)

  return (
    <div className="p-4 sm:p-5 lg:p-7 max-w-4xl mx-auto space-y-5 pb-10">
      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Personal Trainers
      </button>

      {/* Profile card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={`bg-white rounded-2xl p-5 sm:p-6 ${pt.inadimplente ? 'border border-red-200 shadow-sm' : 'led-gold'}`}
      >
        <div className="flex items-start gap-4 flex-wrap">
          {/* Avatar */}
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${avatarBg} flex items-center justify-center text-white text-xl sm:text-2xl font-black flex-shrink-0`}>
            {getInitials(pt.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h1 className="text-xl font-black text-gray-900 tracking-tight">{pt.name}</h1>
              <div className="flex gap-1.5 flex-wrap mt-0.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  pt.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'
                }`}>{pt.active ? 'Ativo' : 'Inativo'}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  pt.inadimplente ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>{pt.inadimplente ? '⚠ Inadimplente' : '✓ Em dia'}</span>
                {pt.plan && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${planTypeBadge(pt.plan.type)}`}>
                    {pt.plan.name}
                  </span>
                )}
              </div>
            </div>
            {pt.specialty && <p className="text-sm text-gray-500 mt-1">{pt.specialty}</p>}
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 mt-2">
              <a href={`mailto:${pt.email}`}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#2E75B6] transition-colors">
                <Mail className="w-3.5 h-3.5" />{pt.email}
              </a>
              {pt.phone && (
                <a href={`tel:${pt.phone}`}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#2E75B6] transition-colors">
                  <Phone className="w-3.5 h-3.5" />{pt.phone}
                </a>
              )}
            </div>
            {pt.bio && <p className="text-xs text-gray-400 mt-2 leading-relaxed">{pt.bio}</p>}

            {/* Documentação — TEEF + seguro */}
            {(pt.teefNumber || pt.teefValidUntil || pt.insuranceValidUntil) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {pt.teefNumber && (
                  <span className="text-[11px] font-medium text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
                    TEEF {pt.teefNumber}
                  </span>
                )}
                {(() => {
                  const teef = docStatus(pt.teefValidUntil)
                  if (!teef) return null
                  const cls = teef.status === 'expired'
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : teef.status === 'warning'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-50 text-gray-500 border-gray-100'
                  return (
                    <span className={`text-[11px] font-medium rounded-lg px-2.5 py-1 border ${cls}`}>
                      Validade TEEF: {formatDate(pt.teefValidUntil!)}
                      {teef.status !== 'ok' && (teef.status === 'expired' ? ` (vencida há ${Math.abs(teef.daysLeft)}d)` : ` (${teef.daysLeft}d)`)}
                    </span>
                  )
                })()}
                {(() => {
                  const insurance = docStatus(pt.insuranceValidUntil)
                  if (!insurance) return null
                  const cls = insurance.status === 'expired'
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : insurance.status === 'warning'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-50 text-gray-500 border-gray-100'
                  return (
                    <span className={`text-[11px] font-medium rounded-lg px-2.5 py-1 border ${cls}`}>
                      Validade Seguro: {formatDate(pt.insuranceValidUntil!)}
                      {insurance.status !== 'ok' && (insurance.status === 'expired' ? ` (vencido há ${Math.abs(insurance.daysLeft)}d)` : ` (${insurance.daysLeft}d)`)}
                    </span>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
            <button onClick={() => setEditOpen(true)}
              className="flex items-center justify-center gap-2 min-h-[40px] px-4 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Editar perfil
            </button>
            <button
              onClick={() => toggleInadimplente.mutate(!pt.inadimplente)}
              disabled={toggleInadimplente.isPending}
              className={`flex items-center justify-center gap-1.5 min-h-[40px] px-4 text-xs font-semibold rounded-xl border transition-colors ${
                pt.inadimplente
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}>
              {pt.inadimplente ? <><CheckCircle2 className="w-3.5 h-3.5" /> Marcar em dia</> : <><AlertTriangle className="w-3.5 h-3.5" /> Marcar inadimplente</>}
            </button>
            <button
              onClick={() => toggleActive.mutate(!pt.active)}
              disabled={toggleActive.isPending}
              className="flex items-center justify-center gap-1.5 min-h-[40px] px-4 text-xs font-medium rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              {pt.active ? 'Desativar PT' : 'Ativar PT'}
            </button>
            <button
              onClick={() => resetPassword.mutate()}
              disabled={resetPassword.isPending}
              className="flex items-center justify-center gap-1.5 min-h-[40px] px-4 text-xs font-medium rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              {resetPassword.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              Gerar nova senha
            </button>
          </div>
        </div>
      </motion.div>

      {/* Documentos do PT — o admin vê e baixa (compliance); só leitura */}
      <PtDocuments ptId={ptId} canManage={false} />

      {/* Resultado do reset de senha — sempre mostra a password + WhatsApp,
          nunca depende só do email real ter funcionado */}
      <Dialog open={!!resetResult} onOpenChange={o => !o && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova password gerada</DialogTitle>
          </DialogHeader>
          {resetResult && (
            <div className="space-y-3">
              {resetResult.emailSent && (
                <p className="text-sm text-emerald-600">✓ Enviada por email para {pt?.email}</p>
              )}
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 min-h-[44px]">
                <code className="flex-1 text-base font-mono font-bold tracking-wide text-gray-900">{resetResult.tempPassword}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(resetResult.tempPassword); toast.success('Password copiada') }}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 min-h-[44px] px-2"
                >
                  Copiar
                </button>
              </div>
              {pt?.phone && whatsappCredentialsUrl(pt.phone, pt.name, pt.email, resetResult.tempPassword, true) && (
                <a
                  href={whatsappCredentialsUrl(pt.phone, pt.name, pt.email, resetResult.tempPassword, true)!}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
                >
                  Enviar por WhatsApp
                </a>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setResetResult(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Alunos', value: String(alunos.length), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Horas/mês', value: `${pt.hoursThisMonth}h`, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Sessões/mês', value: String(sessionsThisMonth), icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Valor a pagar', value: ptBilling ? formatCurrency(ptBilling.value) : '—', icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl led-gold px-4 py-3.5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900 leading-none">{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl led-gold overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'alunos', label: `Alunos (${alunos.length})` },
            { key: 'sessoes', label: `Sessões recentes (${recentBookings.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'text-gray-900 border-b-2 border-gray-900 -mb-px'
                  : 'text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Alunos tab */}
        {tab === 'alunos' && (
          <div className="divide-y divide-gray-50">
            {alunos.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                Nenhum aluno associado
              </div>
            ) : alunos.map(aluno => {
              const badge = statusBadge(aluno.status)
              // Stats por-aluno (sessões feitas / próxima) precisam de endpoint
              // dedicado no backend — por agora neutros, nunca lidos do mock.
              const completedCount = 0
              return (
                <Link key={aluno.id} href={`/admin/alunos/${aluno.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                    style={{ background: avatarColor(aluno.name) }}>
                    {getInitials(aluno.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{aluno.name}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{aluno.email}</p>
                  </div>
                  <div className="flex items-center gap-5 flex-shrink-0 text-right">
                    <div className="hidden sm:block">
                      <p className="text-sm font-bold text-gray-900">{completedCount}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">sessões</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">
                        <span className="text-gray-300">—</span>
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">próx. sessão</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Sessões tab */}
        {tab === 'sessoes' && (
          <div className="divide-y divide-gray-50">
            {recentBookings.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                Sem sessões registadas
              </div>
            ) : recentBookings.map(booking => (
                <div key={booking.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{booking.alunoName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(parseISO(booking.startTime), "d MMM yyyy 'às' HH'h'mm", { locale: ptLocale })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${bookingStatusColor(booking.status)}`}>
                    {bookingStatusLabel(booking.status)}
                  </span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && pt && (
        <EditSheet pt={pt} plans={plans} onClose={() => setEditOpen(false)} />
      )}
    </div>
  )
}
