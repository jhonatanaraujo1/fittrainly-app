'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, MoreHorizontal, ChevronRight, ChevronDown,
  Loader2, UserPlus, Phone, Mail, Share2,
  Globe, Users, ArrowRight, X, TrendingUp, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format, parseISO, isThisWeek } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { leadApi } from '@/lib/api'
import type { MockLead } from '@/lib/mock-db'

// ── Types ────────────────────────────────────────────────────────────────────
type LeadStatus = MockLead['status']

const PIPELINE: LeadStatus[] = [
  'NOVO',
  'CONTACTADO',
  'VISITA_AGENDADA',
  'VISITOU',
  'INSCRITO',
]

const COLUMN_META: Record<LeadStatus, { label: string; color: string; bg: string; ring: string }> = {
  NOVO:             { label: 'Novo Lead',       color: 'text-blue-700',   bg: 'bg-blue-50',   ring: 'ring-blue-200' },
  CONTACTADO:       { label: 'Contactado',       color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200' },
  VISITA_AGENDADA:  { label: 'Visita Agendada',  color: 'text-purple-700', bg: 'bg-purple-50', ring: 'ring-purple-200' },
  VISITOU:          { label: 'Visitou',           color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200' },
  INSCRITO:         { label: 'Inscrito',          color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200' },
  PERDIDO:          { label: 'Perdido',           color: 'text-gray-500',   bg: 'bg-gray-50',   ring: 'ring-gray-200' },
}

const SOURCE_ICON: Record<string, React.ElementType> = {
  Instagram: Share2,
  Google: Globe,
  Referência: Users,
  Amigo: Users,
  Outro: Globe,
}

const INTERESSE_OPTIONS = ['Musculação', 'Funcional', 'Yoga/Pilates', 'Emagrecimento', 'Outro']
const SOURCE_OPTIONS = ['Instagram', 'Google', 'Referência', 'Outro']

// ── Utils ─────────────────────────────────────────────────────────────────────
function nextStatus(current: LeadStatus): LeadStatus | null {
  const idx = PIPELINE.indexOf(current)
  if (idx === -1 || idx === PIPELINE.length - 1) return null
  return PIPELINE[idx + 1]
}

function daysAgo(isoDate: string): string {
  return formatDistanceToNow(parseISO(isoDate), { addSuffix: true, locale: pt })
}

// ── Advance Dialog ─────────────────────────────────────────────────────────────
type DialogMode = 'agendar-visita' | 'registar-visita'

function AdvanceDialog({
  lead,
  mode,
  onClose,
  onConfirm,
}: {
  lead: MockLead
  mode: DialogMode
  onClose: () => void
  onConfirm: (id: string, status: LeadStatus, data?: Partial<MockLead>) => void
}) {
  const [conseguiuMarcar, setConseguiuMarcar] = useState<boolean | null>(null)
  const [visitaDate, setVisitaDate] = useState('')
  const [compareceu, setCompareceu] = useState<boolean | null>(null)
  const [inscreveu, setInscreveu] = useState<boolean | null>(null)
  const [planoEscolhido, setPlanoEscolhido] = useState('')
  const [isPending, setIsPending] = useState(false)

  async function handleConfirm() {
    setIsPending(true)
    try {
      if (mode === 'agendar-visita') {
        if (conseguiuMarcar === null) return
        if (conseguiuMarcar) {
          const isoDate = visitaDate ? new Date(visitaDate).toISOString() : new Date().toISOString()
          onConfirm(lead.id, 'VISITA_AGENDADA', { visitaDate: isoDate })
        } else {
          toast.info('Ok — vamos criar um lembrete para tentar novamente.')
          onClose()
        }
      } else {
        if (compareceu === null) return
        if (!compareceu) {
          onConfirm(lead.id, 'VISITOU', {})
        } else if (inscreveu) {
          const obs = planoEscolhido ? `Plano: ${planoEscolhido}` : undefined
          onConfirm(lead.id, 'INSCRITO', obs ? { observacoes: obs } : {})
        } else {
          onConfirm(lead.id, 'VISITOU', {})
        }
      }
      onClose()
    } finally {
      setIsPending(false)
    }
  }

  const canConfirm = mode === 'agendar-visita'
    ? conseguiuMarcar !== null
    : compareceu !== null && (compareceu === false || inscreveu !== null)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              {mode === 'agendar-visita' ? 'Agendar Visita' : 'Registar Visita'}
            </p>
            <h3 className="text-base font-black text-gray-900">{lead.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-4 space-y-5">
          {mode === 'agendar-visita' ? (
            <>
              {/* P1: Conseguiu marcar? */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Conseguiu marcar uma visita ao estúdio?</p>
                <div className="flex gap-2">
                  {([true, false] as const).map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setConseguiuMarcar(v)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                        conseguiuMarcar === v
                          ? v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-200'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {v ? 'Sim' : 'Não'}
                    </button>
                  ))}
                </div>
              </div>

              {/* P2: Data da visita */}
              {conseguiuMarcar === true && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-sm font-semibold text-gray-700">Data e hora da visita</p>
                  <Input
                    type="datetime-local"
                    value={visitaDate}
                    onChange={e => setVisitaDate(e.target.value)}
                    className="text-sm"
                  />
                </motion.div>
              )}

              {conseguiuMarcar === false && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700"
                >
                  Ok. O lead mantém-se em "Contactado" para nova tentativa.
                </motion.div>
              )}
            </>
          ) : (
            <>
              {/* P1: Compareceu? */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">A lead compareceu à visita?</p>
                <div className="flex gap-2">
                  {([true, false] as const).map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => { setCompareceu(v); if (!v) setInscreveu(null) }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                        compareceu === v
                          ? v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-200'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {v ? 'Sim' : 'Não compareceu'}
                    </button>
                  ))}
                </div>
              </div>

              {/* P2: Inscreveu-se? */}
              {compareceu === true && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Inscreveu-se?</p>
                    <div className="flex gap-2">
                      {([true, false] as const).map(v => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => setInscreveu(v)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                            inscreveu === v
                              ? v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-200'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {v ? 'Sim' : 'Ainda não'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* P3: Plano escolhido */}
                  {inscreveu === true && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <p className="text-sm font-semibold text-gray-700">Plano escolhido <span className="text-gray-400 font-normal">(opcional)</span></p>
                      <Input
                        placeholder="Ex: Pack 10 sessões — Plano Mensal"
                        value={planoEscolhido}
                        onChange={e => setPlanoEscolhido(e.target.value)}
                      />
                      <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        Este lead será movido para "Inscrito"
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !canConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#111111' }}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────
function LeadCard({
  lead,
  onAdvance,
  onMarkLost,
  onConvert,
  onOpenDialog,
  isAdvancing,
}: {
  lead: MockLead
  onAdvance: (id: string, status: LeadStatus) => void
  onMarkLost: (id: string) => void
  onConvert: (id: string) => void
  onOpenDialog: (lead: MockLead, mode: DialogMode) => void
  isAdvancing: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const SourceIcon = lead.source ? (SOURCE_ICON[lead.source] ?? Globe) : Globe
  const next = nextStatus(lead.status)

  function handleQuickAdvance() {
    if (lead.status === 'CONTACTADO') {
      onOpenDialog(lead, 'agendar-visita')
    } else if (lead.status === 'VISITA_AGENDADA') {
      onOpenDialog(lead, 'registar-visita')
    } else if (next) {
      onAdvance(lead.id, next)
    }
  }

  function handleMenuAdvance() {
    setMenuOpen(false)
    if (lead.status === 'CONTACTADO') {
      onOpenDialog(lead, 'agendar-visita')
    } else if (lead.status === 'VISITA_AGENDADA') {
      onOpenDialog(lead, 'registar-visita')
    } else if (next) {
      onAdvance(lead.id, next)
    }
  }

  const quickLabel = lead.status === 'CONTACTADO'
    ? 'Agendar visita'
    : lead.status === 'VISITA_AGENDADA'
      ? 'Registar visita'
      : 'Avançar'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 group relative"
    >
      {/* Name + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{lead.name}</p>
          {lead.phone && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3" /> {lead.phone}
            </p>
          )}
          {lead.email && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
              <Mail className="w-3 h-3" /> {lead.email}
            </p>
          )}
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[190px]"
                >
                  {next && (
                    <button
                      onClick={handleMenuAdvance}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors min-h-[44px]"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      {quickLabel}
                    </button>
                  )}
                  {lead.status === 'INSCRITO' && (
                    <button
                      onClick={() => { onConvert(lead.id); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors min-h-[44px]"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Converter em aluno
                    </button>
                  )}
                  <div className="h-px bg-gray-100 my-1" />
                  <button
                    onClick={() => { onMarkLost(lead.id); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors min-h-[44px]"
                  >
                    <X className="w-3.5 h-3.5" />
                    Marcar como perdido
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {lead.interesse && (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white">
            {lead.interesse}
          </span>
        )}
        {lead.source && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
            <SourceIcon className="w-2.5 h-2.5" />
            {lead.source}
          </span>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">{daysAgo(lead.createdAt)}</span>
      </div>

      {/* Visita date */}
      {lead.visitaDate && (
        <div className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
          Visita: {format(parseISO(lead.visitaDate), "d MMM 'às' HH'h'mm", { locale: pt })}
        </div>
      )}

      {/* Observações */}
      {lead.observacoes && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-snug">{lead.observacoes}</p>
      )}

      {/* Quick advance button */}
      {lead.status === 'VISITA_AGENDADA' ? (
        <button
          onClick={handleQuickAdvance}
          disabled={isAdvancing}
          className="mt-auto w-full h-9 min-h-[36px] text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5"
        >
          {isAdvancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ChevronRight className="w-3.5 h-3.5" /> Registar visita</>}
        </button>
      ) : lead.status === 'CONTACTADO' ? (
        <button
          onClick={handleQuickAdvance}
          disabled={isAdvancing}
          className="mt-auto w-full h-9 min-h-[36px] text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
        >
          {isAdvancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ChevronRight className="w-3.5 h-3.5" /> Agendar visita</>}
        </button>
      ) : next ? (
        <button
          onClick={() => onAdvance(lead.id, next)}
          disabled={isAdvancing}
          className="mt-auto w-full h-9 min-h-[36px] text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-1.5"
        >
          {isAdvancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ArrowRight className="w-3.5 h-3.5" /> Avançar</>}
        </button>
      ) : null}
    </motion.div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────
function KanbanColumn({
  status,
  leads,
  onAdvance,
  onMarkLost,
  onConvert,
  onOpenDialog,
  advancingId,
}: {
  status: LeadStatus
  leads: MockLead[]
  onAdvance: (id: string, status: LeadStatus) => void
  onMarkLost: (id: string) => void
  onConvert: (id: string) => void
  onOpenDialog: (lead: MockLead, mode: DialogMode) => void
  advancingId: string | null
}) {
  const meta = COLUMN_META[status]

  return (
    <div className="flex flex-col gap-3 min-w-[260px] flex-1">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${meta.bg} ring-1 ${meta.ring}`}>
        <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white ${meta.color}`}>{leads.length}</span>
      </div>

      <div className="flex flex-col gap-3 min-h-[120px]">
        <AnimatePresence initial={false}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onAdvance={onAdvance}
              onMarkLost={onMarkLost}
              onConvert={onConvert}
              onOpenDialog={onOpenDialog}
              isAdvancing={advancingId === lead.id}
            />
          ))}
        </AnimatePresence>
        {leads.length === 0 && (
          <div className="flex-1 rounded-xl border-2 border-dashed border-gray-100 flex items-center justify-center min-h-[80px]">
            <p className="text-xs text-gray-300 font-medium">Sem leads</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── New Lead Form ─────────────────────────────────────────────────────────────
type NewLeadForm = {
  name: string; phone: string; email: string
  interesse: string; source: string; observacoes: string
}
const EMPTY_FORM: NewLeadForm = { name: '', phone: '', email: '', interesse: '', source: '', observacoes: '' }

function NewLeadSheet({ onCreated }: { onCreated: (lead: MockLead) => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewLeadForm>(EMPTY_FORM)

  const createMutation = useMutation({
    mutationFn: () => leadApi.create({ name: form.name, phone: form.phone || undefined, email: form.email || undefined, interesse: form.interesse || undefined, source: form.source || undefined, observacoes: form.observacoes || undefined, status: 'NOVO' }),
    onSuccess: (lead) => { onCreated(lead); toast.success(`Lead "${lead.name}" adicionado! 🎉`); setOpen(false); setForm(EMPTY_FORM) },
    onError: () => toast.error('Erro ao criar lead'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone) { toast.error('Nome e telefone são obrigatórios'); return }
    createMutation.mutate()
  }

  function setField<K extends keyof NewLeadForm>(key: K, value: NewLeadForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex items-center gap-2 h-9 px-4 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
        style={{ background: '#111111' }}
      >
        <Plus className="w-4 h-4" /> Novo Lead
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Novo Lead</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input placeholder="André Pereira" value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone *</Label>
            <Input placeholder="+351 916 000 000" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" placeholder="andre@email.com" value={form.email} onChange={(e) => setField('email', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Interesse</Label>
            <Select value={form.interesse} onValueChange={(v) => setField('interesse', v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>{INTERESSE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Origem</Label>
            <Select value={form.source} onValueChange={(v) => setField('source', v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Como nos conheceu?" /></SelectTrigger>
              <SelectContent>{SOURCE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <textarea
              placeholder="Notas sobre o contacto..."
              value={form.observacoes}
              onChange={(e) => setField('observacoes', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setOpen(false); setForm(EMPTY_FORM) }} className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 h-10 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: '#111111' }}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Lead'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const qc = useQueryClient()
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [showLost, setShowLost] = useState(false)
  const [mobileTab, setMobileTab] = useState<LeadStatus>('NOVO')
  const [advanceDialog, setAdvanceDialog] = useState<{ lead: MockLead; mode: DialogMode } | null>(null)

  const { data: allLeads = [], isLoading } = useQuery<MockLead[]>({
    queryKey: ['leads'],
    queryFn: leadApi.list,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, data }: { id: string; status: LeadStatus; data?: Partial<MockLead> }) =>
      leadApi.updateStatus(id, status, data),
    onMutate: ({ id }) => setAdvancingId(id),
    onSuccess: (updated) => {
      qc.setQueryData<MockLead[]>(['leads'], (prev) => prev?.map((l) => (l.id === updated.id ? updated : l)) ?? prev)
      const meta = COLUMN_META[updated.status]
      toast.success(`Lead movido para "${meta.label}" 🎉`)
    },
    onError: () => toast.error('Erro ao mover lead'),
    onSettled: () => setAdvancingId(null),
  })

  function handleAdvance(id: string, status: LeadStatus) {
    updateStatusMutation.mutate({ id, status })
  }

  function handleMarkLost(id: string) {
    updateStatusMutation.mutate({ id, status: 'PERDIDO' })
  }

  function handleConvert(_id: string) {
    toast.info('Funcionalidade em breve')
  }

  function handleCreated(lead: MockLead) {
    qc.setQueryData<MockLead[]>(['leads'], (prev) => prev ? [lead, ...prev] : [lead])
  }

  function handleOpenDialog(lead: MockLead, mode: DialogMode) {
    setAdvanceDialog({ lead, mode })
  }

  function handleDialogConfirm(id: string, status: LeadStatus, data?: Partial<MockLead>) {
    updateStatusMutation.mutate({ id, status, data })
  }

  // Stats
  const activeLeads = allLeads.filter((l) => l.status !== 'PERDIDO')
  const visitasEstaSemana = allLeads.filter((l) => l.visitaDate != null && isThisWeek(parseISO(l.visitaDate))).length
  const inscritoCount = allLeads.filter((l) => l.status === 'INSCRITO').length
  const conversionRate = activeLeads.length > 0 ? Math.round((inscritoCount / activeLeads.length) * 100) : 0

  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, MockLead[]> = { NOVO: [], CONTACTADO: [], VISITA_AGENDADA: [], VISITOU: [], INSCRITO: [], PERDIDO: [] }
    for (const lead of allLeads) map[lead.status].push(lead)
    return map
  }, [allLeads])

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">CRM de Leads</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeLeads.length} lead{activeLeads.length !== 1 ? 's' : ''} activo{activeLeads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <NewLeadSheet onCreated={handleCreated} />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3 flex flex-col gap-0.5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide line-clamp-1">Total activos</p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">{activeLeads.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3 flex flex-col gap-0.5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide line-clamp-1">Visitas semana</p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">{visitasEstaSemana}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3 flex flex-col gap-0.5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide line-clamp-1">Conversão</p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">{conversionRate}%</p>
        </div>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <>
          <div className="lg:hidden flex flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5">
              {PIPELINE.map((s) => <Skeleton key={s} className="flex-shrink-0 h-10 w-24 rounded-lg" />)}
            </div>
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
          <div className="hidden lg:flex gap-4 overflow-x-auto pb-4">
            {PIPELINE.map((s) => (
              <div key={s} className="min-w-[260px] flex-1 flex flex-col gap-3">
                <Skeleton className="h-10 rounded-xl" />
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Mobile: tab por coluna */}
          <div className="lg:hidden">
            <div className="flex overflow-x-auto gap-2 pb-2 -mx-5 px-5 scrollbar-hide">
              {PIPELINE.map((status) => {
                const meta = COLUMN_META[status]
                const count = byStatus[status]?.length ?? 0
                return (
                  <button
                    key={status}
                    onClick={() => setMobileTab(status)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                      mobileTab === status ? `${meta.bg} ${meta.color} ring-1 ${meta.ring}` : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {meta.label}<span className="text-xs font-semibold">{count}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col gap-3 mt-3">
              <AnimatePresence initial={false}>
                {(byStatus[mobileTab] ?? []).map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onAdvance={handleAdvance}
                    onMarkLost={handleMarkLost}
                    onConvert={handleConvert}
                    onOpenDialog={handleOpenDialog}
                    isAdvancing={advancingId === lead.id}
                  />
                ))}
              </AnimatePresence>
              {(byStatus[mobileTab] ?? []).length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-gray-400">Nenhum lead em &ldquo;{COLUMN_META[mobileTab].label}&rdquo;</p>
                </div>
              )}
            </div>
          </div>

          {/* Desktop: kanban horizontal */}
          <div className="hidden lg:block overflow-x-auto pb-4 -mx-7 px-7">
            <div className="flex gap-4 min-w-max">
              {PIPELINE.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  leads={byStatus[status]}
                  onAdvance={handleAdvance}
                  onMarkLost={handleMarkLost}
                  onConvert={handleConvert}
                  onOpenDialog={handleOpenDialog}
                  advancingId={advancingId}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Leads perdidos */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => setShowLost((v) => !v)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium min-h-[44px]"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showLost ? 'rotate-0' : '-rotate-90'}`} />
          Ver leads perdidos ({byStatus.PERDIDO.length})
        </button>
        <AnimatePresence>
          {showLost && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                <KanbanColumn
                  status="PERDIDO"
                  leads={byStatus.PERDIDO}
                  onAdvance={handleAdvance}
                  onMarkLost={handleMarkLost}
                  onConvert={handleConvert}
                  onOpenDialog={handleOpenDialog}
                  advancingId={advancingId}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Advance Dialog */}
      <AnimatePresence>
        {advanceDialog && (
          <AdvanceDialog
            lead={advanceDialog.lead}
            mode={advanceDialog.mode}
            onClose={() => setAdvanceDialog(null)}
            onConfirm={handleDialogConfirm}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
