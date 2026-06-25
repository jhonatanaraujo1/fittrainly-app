'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, MoreHorizontal, ChevronDown, ChevronRight,
  Loader2, UserPlus, Phone, Mail, Share2,
  Globe, Users, X, TrendingUp, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format, parseISO, isThisWeek, isSameMonth, isSameYear } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateTimePicker } from '@/components/ui/date-picker'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { leadApi } from '@/lib/api'
import type { MockLead } from '@/lib/mock-db'
import type { LeadStatus } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PIPELINE: LeadStatus[] = ['NOVO', 'CONTACTADO', 'VISITA_AGENDADA', 'VISITOU', 'INSCRITO']

const COLUMN_META: Record<LeadStatus, { label: string; color: string; bg: string; ring: string; dot: string }> = {
  NOVO:             { label: 'Novo Lead',      color: 'text-blue-700',   bg: 'bg-blue-50',   ring: 'ring-blue-200',   dot: 'bg-blue-500' },
  CONTACTADO:       { label: 'Contactado',      color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200',  dot: 'bg-amber-500' },
  VISITA_AGENDADA:  { label: 'Visita Agendada', color: 'text-purple-700', bg: 'bg-purple-50', ring: 'ring-purple-200', dot: 'bg-purple-500' },
  VISITOU:          { label: 'Visitou',          color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200', dot: 'bg-orange-500' },
  INSCRITO:         { label: 'Inscrito',         color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200',  dot: 'bg-green-500' },
  NAO_DEU_FEEDBACK: { label: 'Sem Feedback',     color: 'text-rose-600',   bg: 'bg-rose-50',   ring: 'ring-rose-200',   dot: 'bg-rose-400' },
  PERDIDO:          { label: 'Perdido',          color: 'text-gray-500',   bg: 'bg-gray-50',   ring: 'ring-gray-200',   dot: 'bg-gray-400' },
  ARQUIVADO:        { label: 'Arquivado',        color: 'text-slate-500',  bg: 'bg-slate-50',  ring: 'ring-slate-200',  dot: 'bg-slate-400' },
}

const MOVABLE_PIPELINE: LeadStatus[] = ['NOVO', 'CONTACTADO', 'VISITA_AGENDADA', 'VISITOU', 'INSCRITO']
const MOVABLE_EXTRA: LeadStatus[] = ['NAO_DEU_FEEDBACK', 'PERDIDO', 'ARQUIVADO']

const SOURCE_ICON: Record<string, React.ElementType> = {
  Instagram: Share2, Google: Globe, Referência: Users, Amigo: Users, Outro: Globe,
}

const INTERESSE_OPTIONS = ['Musculação', 'Funcional', 'Yoga/Pilates', 'Emagrecimento', 'Outro']
const SOURCE_OPTIONS = ['Instagram', 'Google', 'Referência', 'Outro']

type DialogMode = 'agendar-visita' | 'registar-visita' | 'sem-feedback'

// ── Utils ─────────────────────────────────────────────────────────────────────

function daysAgo(isoDate: string) {
  return formatDistanceToNow(parseISO(isoDate), { addSuffix: true, locale: pt })
}

function isCurrentMonth(isoDate?: string): boolean {
  if (!isoDate) return false
  const d = parseISO(isoDate)
  const now = new Date()
  return isSameMonth(d, now) && isSameYear(d, now)
}

// ── Obs Dialog — Sem Feedback ─────────────────────────────────────────────────

function ObsDialog({ lead, onClose, onConfirm }: {
  lead: MockLead
  onClose: () => void
  onConfirm: (id: string, status: LeadStatus, data?: Partial<MockLead>) => void
}) {
  const [obs, setObs] = useState(lead.observacoes ?? '')
  const [isPending, setIsPending] = useState(false)

  async function handleConfirm() {
    setIsPending(true)
    try {
      onConfirm(lead.id, 'NAO_DEU_FEEDBACK', { observacoes: obs || undefined })
      onClose()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-1">Sem Feedback</p>
            <h3 className="text-base font-black text-gray-900">{lead.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Este lead foi contactado mas não deu resposta.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 pb-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">
              Observação <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            <textarea
              value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Visitou mas não atendeu chamadas posteriores..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px]">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Advance Dialog — Agendar / Registar Visita ─────────────────────────────────

function AdvanceDialog({ lead, mode, onClose, onConfirm }: {
  lead: MockLead; mode: 'agendar-visita' | 'registar-visita'; onClose: () => void
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
          const isoDate = visitaDate || new Date().toISOString()
          onConfirm(lead.id, 'VISITA_AGENDADA', { visitaDate: isoDate })
        } else {
          toast.info('Ok — lead mantém-se em "Contactado".')
          onClose(); return
        }
      } else {
        if (compareceu === null) return
        if (!compareceu) {
          onConfirm(lead.id, 'VISITOU', {})
        } else if (inscreveu) {
          const obs = planoEscolhido ? `Plano: ${planoEscolhido}` : undefined
          onConfirm(lead.id, 'INSCRITO', { ...(obs ? { observacoes: obs } : {}), inscritoEm: new Date().toISOString() })
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
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              {mode === 'agendar-visita' ? 'Agendar Visita' : 'Registar Visita'}
            </p>
            <h3 className="text-base font-black text-gray-900">{lead.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-4 space-y-5">
          {mode === 'agendar-visita' ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Conseguiu marcar uma visita ao estúdio?</p>
                <div className="flex gap-2">
                  {([true, false] as const).map(v => (
                    <button key={String(v)} type="button" onClick={() => setConseguiuMarcar(v)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                        conseguiuMarcar === v
                          ? v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-200'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >{v ? 'Sim' : 'Não'}</button>
                  ))}
                </div>
              </div>
              {conseguiuMarcar === true && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Data e hora da visita</p>
                  <DateTimePicker
                    value={visitaDate}
                    onChange={v => setVisitaDate(v)}
                    placeholder="Selecionar data e hora"
                  />
                </motion.div>
              )}
              {conseguiuMarcar === false && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
                  Ok. O lead mantém-se em "Contactado" para nova tentativa.
                </motion.div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">A lead compareceu à visita?</p>
                <div className="flex gap-2">
                  {([true, false] as const).map(v => (
                    <button key={String(v)} type="button"
                      onClick={() => { setCompareceu(v); if (!v) setInscreveu(null) }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                        compareceu === v
                          ? v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-200'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >{v ? 'Sim' : 'Não compareceu'}</button>
                  ))}
                </div>
              </div>
              {compareceu === true && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Inscreveu-se?</p>
                    <div className="flex gap-2">
                      {([true, false] as const).map(v => (
                        <button key={String(v)} type="button" onClick={() => setInscreveu(v)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                            inscreveu === v
                              ? v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-200'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                        >{v ? 'Sim' : 'Ainda não'}</button>
                      ))}
                    </div>
                  </div>
                  {inscreveu === true && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">
                        Plano escolhido <span className="text-gray-400 font-normal">(opcional)</span>
                      </p>
                      <Input placeholder="Ex: Pack 10 sessões — Plano Mensal" value={planoEscolhido}
                        onChange={e => setPlanoEscolhido(e.target.value)} className="text-base min-h-[44px]" />
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

        <div className="px-6 pb-6 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px]">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={isPending || !canConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: '#111111' }}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Status Picker Menu ─────────────────────────────────────────────────────────

function StatusPickerMenu({ lead, onMoveTo, onClose }: {
  lead: MockLead
  onMoveTo: (status: LeadStatus) => void
  onClose: () => void
}) {
  function renderBtn(status: LeadStatus) {
    if (status === lead.status) return null
    const meta = COLUMN_META[status]
    return (
      <button key={status} onClick={() => { onMoveTo(status); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors rounded-lg min-h-[40px] text-left"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
      </button>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.12 }}
        className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-2 w-52"
      >
        <p className="px-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mover para...</p>
        <div className="px-1">
          {MOVABLE_PIPELINE.map(renderBtn)}
        </div>
        <div className="h-px bg-gray-100 my-1.5 mx-3" />
        <div className="px-1">
          {MOVABLE_EXTRA.map(renderBtn)}
        </div>
        {lead.status === 'INSCRITO' && (
          <>
            <div className="h-px bg-gray-100 my-1.5 mx-3" />
            <div className="px-1">
              <button onClick={onClose}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-green-700 hover:bg-green-50 transition-colors rounded-lg min-h-[40px]">
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-semibold">Converter em aluno</span>
              </button>
            </div>
          </>
        )}
      </motion.div>
    </>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, onMoveTo, onOpenDialog, isAdvancing }: {
  lead: MockLead
  onMoveTo: (id: string, status: LeadStatus, data?: Partial<MockLead>) => void
  onOpenDialog: (lead: MockLead, mode: DialogMode) => void
  isAdvancing: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const SourceIcon = lead.source ? (SOURCE_ICON[lead.source] ?? Globe) : Globe

  function handleMenuMove(status: LeadStatus) {
    setMenuOpen(false)
    if (status === 'NAO_DEU_FEEDBACK') {
      onOpenDialog(lead, 'sem-feedback')
    } else if (status === 'VISITA_AGENDADA' && (lead.status === 'CONTACTADO' || lead.status === 'NOVO')) {
      onOpenDialog(lead, 'agendar-visita')
    } else if (status === 'INSCRITO') {
      onMoveTo(lead.id, 'INSCRITO', { inscritoEm: new Date().toISOString() })
    } else {
      onMoveTo(lead.id, status)
    }
  }

  function handleQuickAction() {
    if (lead.status === 'CONTACTADO') onOpenDialog(lead, 'agendar-visita')
    else if (lead.status === 'VISITA_AGENDADA') onOpenDialog(lead, 'registar-visita')
    else if (lead.status === 'NOVO') onMoveTo(lead.id, 'CONTACTADO')
    else if (lead.status === 'VISITOU') onMoveTo(lead.id, 'INSCRITO', { inscritoEm: new Date().toISOString() })
  }

  const quickLabel =
    lead.status === 'CONTACTADO' ? 'Agendar visita' :
    lead.status === 'VISITA_AGENDADA' ? 'Registar visita' :
    lead.status === 'NOVO' ? 'Marcar contactado' :
    lead.status === 'VISITOU' ? 'Inscrever' : null

  const quickCls =
    lead.status === 'VISITA_AGENDADA' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
    lead.status === 'CONTACTADO' ? 'bg-amber-500 hover:bg-amber-600 text-white' :
    'border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 relative"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{lead.name}</p>
          {lead.phone && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 flex-shrink-0" />{lead.phone}
            </p>
          )}
          {lead.email && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
              <Mail className="w-3 h-3 flex-shrink-0" />{lead.email}
            </p>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <StatusPickerMenu lead={lead} onMoveTo={handleMenuMove} onClose={() => setMenuOpen(false)} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {lead.interesse && (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white">
            {lead.interesse}
          </span>
        )}
        {lead.source && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
            <SourceIcon className="w-2.5 h-2.5" />{lead.source}
          </span>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">{daysAgo(lead.createdAt)}</span>
      </div>

      {/* Visita badge */}
      {lead.visitaDate && (
        <div className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
          Visita: {format(parseISO(lead.visitaDate), "d MMM 'às' HH'h'mm", { locale: pt })}
        </div>
      )}

      {/* Observações */}
      {lead.observacoes && (
        <p className={`text-xs line-clamp-2 leading-snug ${
          lead.status === 'NAO_DEU_FEEDBACK'
            ? 'text-rose-600 bg-rose-50 rounded-lg px-2 py-1.5'
            : 'text-gray-500'
        }`}>
          {lead.observacoes}
        </p>
      )}

      {/* Quick action */}
      {quickLabel && (
        <button
          onClick={handleQuickAction}
          disabled={isAdvancing}
          className={`mt-auto w-full min-h-[40px] text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${quickCls}`}
        >
          {isAdvancing
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <><ChevronRight className="w-3.5 h-3.5" />{quickLabel}</>
          }
        </button>
      )}
    </motion.div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ status, leads, onMoveTo, onOpenDialog, advancingId, badge }: {
  status: LeadStatus
  leads: MockLead[]
  onMoveTo: (id: string, status: LeadStatus, data?: Partial<MockLead>) => void
  onOpenDialog: (lead: MockLead, mode: DialogMode) => void
  advancingId: string | null
  badge?: string
}) {
  const meta = COLUMN_META[status]

  return (
    <div className="flex flex-col gap-3 min-w-[260px] flex-1">
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${meta.bg} ring-1 ${meta.ring}`}>
        <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white ${meta.color}`}>{leads.length}</span>
          {badge && <span className="text-[10px] text-gray-400">{badge}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-3 min-h-[100px]">
        <AnimatePresence initial={false}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onMoveTo={onMoveTo}
              onOpenDialog={onOpenDialog}
              isAdvancing={advancingId === lead.id}
            />
          ))}
        </AnimatePresence>
        {leads.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-100 flex items-center justify-center min-h-[80px]">
            <p className="text-xs text-gray-300 font-medium">Sem leads</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Collapsible Section ────────────────────────────────────────────────────────

function CollapsibleSection({ title, count, chipCls, children }: {
  title: string; count: number; chipCls: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-gray-100 pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors min-h-[44px] w-full text-left"
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`} />
        <span>{title}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${chipCls}`}>{count}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── New Lead Sheet ─────────────────────────────────────────────────────────────

type NewLeadForm = { name: string; phone: string; email: string; interesse: string; source: string; observacoes: string }
const EMPTY_FORM: NewLeadForm = { name: '', phone: '', email: '', interesse: '', source: '', observacoes: '' }

function NewLeadSheet({ onCreated }: { onCreated: (lead: MockLead) => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewLeadForm>(EMPTY_FORM)

  const createMutation = useMutation({
    mutationFn: () => leadApi.create({
      name: form.name, phone: form.phone || undefined, email: form.email || undefined,
      interesse: form.interesse || undefined, source: form.source || undefined,
      observacoes: form.observacoes || undefined, status: 'NOVO',
    }),
    onSuccess: (lead) => {
      onCreated(lead)
      toast.success(`Lead "${lead.name}" criado!`)
      setOpen(false); setForm(EMPTY_FORM)
    },
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
        className="inline-flex items-center gap-2 px-4 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]"
        style={{ background: '#111111' }}
      >
        <Plus className="w-4 h-4" />Novo Lead
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" />Novo Lead</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Nome *</Label>
            <Input placeholder="André Pereira" value={form.name} onChange={(e) => setField('name', e.target.value)}
              className="text-base min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Telefone *</Label>
            <Input placeholder="+351 916 000 000" value={form.phone} onChange={(e) => setField('phone', e.target.value)}
              className="text-base min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Email</Label>
            <Input type="email" placeholder="andre@email.com" value={form.email} onChange={(e) => setField('email', e.target.value)}
              className="text-base min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Interesse</Label>
            <Select value={form.interesse} onValueChange={(v) => setField('interesse', v ?? '')}>
              <SelectTrigger className="text-base min-h-[44px]">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {INTERESSE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Origem</Label>
            <Select value={form.source} onValueChange={(v) => setField('source', v ?? '')}>
              <SelectTrigger className="text-base min-h-[44px]">
                <SelectValue placeholder="Como nos conheceu?" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Observações</Label>
            <textarea
              placeholder="Notas sobre o contacto..."
              value={form.observacoes}
              onChange={(e) => setField('observacoes', e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setOpen(false); setForm(EMPTY_FORM) }}
              className="flex-1 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px]">
              Cancelar
            </button>
            <button type="submit" disabled={createMutation.isPending}
              className="flex-1 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60 min-h-[44px]"
              style={{ background: '#111111' }}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Lead'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ActiveDialog =
  | { type: 'agendar-visita'; lead: MockLead }
  | { type: 'registar-visita'; lead: MockLead }
  | { type: 'sem-feedback'; lead: MockLead }
  | null

export default function LeadsPage() {
  const qc = useQueryClient()
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<LeadStatus>('NOVO')
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)

  const { data: allLeads = [], isLoading } = useQuery<MockLead[]>({
    queryKey: ['leads'],
    queryFn: leadApi.list,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, data }: { id: string; status: LeadStatus; data?: Partial<MockLead> }) =>
      leadApi.updateStatus(id, status, data),
    onMutate: ({ id }) => setAdvancingId(id),
    onSuccess: (updated) => {
      qc.setQueryData<MockLead[]>(['leads'], (prev) =>
        prev?.map((l) => (l.id === updated.id ? updated : l)) ?? prev
      )
      toast.success(`Lead movido para "${COLUMN_META[updated.status].label}"`)
    },
    onError: () => toast.error('Erro ao mover lead'),
    onSettled: () => setAdvancingId(null),
  })

  function handleMoveTo(id: string, status: LeadStatus, data?: Partial<MockLead>) {
    updateStatusMutation.mutate({ id, status, data })
  }

  function handleOpenDialog(lead: MockLead, mode: DialogMode) {
    if (mode === 'agendar-visita') setActiveDialog({ type: 'agendar-visita', lead })
    else if (mode === 'registar-visita') setActiveDialog({ type: 'registar-visita', lead })
    else if (mode === 'sem-feedback') setActiveDialog({ type: 'sem-feedback', lead })
  }

  function handleDialogConfirm(id: string, status: LeadStatus, data?: Partial<MockLead>) {
    updateStatusMutation.mutate({ id, status, data })
  }

  function handleCreated(lead: MockLead) {
    qc.setQueryData<MockLead[]>(['leads'], (prev) => (prev ? [lead, ...prev] : [lead]))
  }

  // ── Grouping ──────────────────────────────────────────────────────────────

  const byStatus = useMemo(() => {
    const all: LeadStatus[] = ['NOVO', 'CONTACTADO', 'VISITA_AGENDADA', 'VISITOU', 'INSCRITO', 'NAO_DEU_FEEDBACK', 'PERDIDO', 'ARQUIVADO']
    const map = Object.fromEntries(all.map((s) => [s, [] as MockLead[]])) as Record<LeadStatus, MockLead[]>
    for (const lead of allLeads) map[lead.status]?.push(lead)
    return map
  }, [allLeads])

  // INSCRITO: pipeline shows only current month
  const inscritoThisMonth = byStatus.INSCRITO.filter((l) => isCurrentMonth(l.inscritoEm ?? l.updatedAt))
  const inscritoArchived = byStatus.INSCRITO.filter((l) => !isCurrentMonth(l.inscritoEm ?? l.updatedAt))

  // All archived leads (explicit ARQUIVADO + old INSCRITO)
  const allArchived = useMemo(() => [...byStatus.ARQUIVADO, ...inscritoArchived], [byStatus.ARQUIVADO, inscritoArchived])

  const arquivadosByMonth = useMemo(() => {
    const monthMap = new Map<string, { label: string; leads: MockLead[] }>()
    for (const lead of allArchived) {
      const d = parseISO(lead.inscritoEm ?? lead.updatedAt)
      const key = format(d, 'yyyy-MM')
      const label = format(d, 'MMMM yyyy', { locale: pt })
      if (!monthMap.has(key)) monthMap.set(key, { label, leads: [] })
      monthMap.get(key)!.leads.push(lead)
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => v)
  }, [allArchived])

  // Stats
  const pipelineLeads = allLeads.filter((l) => (PIPELINE as string[]).includes(l.status))
  const visitasEstaSemana = allLeads.filter((l) => l.visitaDate != null && isThisWeek(parseISO(l.visitaDate))).length
  const inscritoThisMonthCount = inscritoThisMonth.length

  return (
    <div className="p-4 sm:p-5 lg:p-7 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">CRM de Leads</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {pipelineLeads.length} lead{pipelineLeads.length !== 1 ? 's' : ''} no pipeline
          </p>
        </div>
        <NewLeadSheet onCreated={handleCreated} />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'No pipeline',     value: pipelineLeads.length },
          { label: 'Visitas semana',  value: visitasEstaSemana },
          { label: 'Inscritos mês',   value: inscritoThisMonthCount },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3 flex flex-col gap-0.5">
            <p className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wide leading-tight">{label}</p>
            <p className="text-xl sm:text-2xl font-black text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {isLoading ? (
        <>
          <div className="lg:hidden space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {PIPELINE.map((s) => <Skeleton key={s} className="flex-shrink-0 h-11 w-28 rounded-xl" />)}
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
          {/* Mobile tab bar */}
          <div className="lg:hidden">
            <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:-mx-5 sm:px-5 scrollbar-hide">
              {PIPELINE.map((status) => {
                const meta = COLUMN_META[status]
                const count = status === 'INSCRITO' ? inscritoThisMonth.length : (byStatus[status]?.length ?? 0)
                return (
                  <button
                    key={status}
                    onClick={() => setMobileTab(status)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium min-h-[44px] transition-colors ${
                      mobileTab === status
                        ? `${meta.bg} ${meta.color} ring-1 ${meta.ring}`
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {meta.label}
                    <span className="text-xs font-bold">{count}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col gap-3 mt-3">
              <AnimatePresence initial={false}>
                {(mobileTab === 'INSCRITO' ? inscritoThisMonth : (byStatus[mobileTab] ?? [])).map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onMoveTo={handleMoveTo}
                    onOpenDialog={handleOpenDialog}
                    isAdvancing={advancingId === lead.id}
                  />
                ))}
              </AnimatePresence>
              {(mobileTab === 'INSCRITO' ? inscritoThisMonth : (byStatus[mobileTab] ?? [])).length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-gray-400">Nenhum lead em &ldquo;{COLUMN_META[mobileTab].label}&rdquo;</p>
                </div>
              )}
            </div>
          </div>

          {/* Desktop kanban */}
          <div className="hidden lg:block overflow-x-auto pb-4 -mx-7 px-7">
            <div className="flex gap-4 min-w-max">
              {PIPELINE.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  leads={status === 'INSCRITO' ? inscritoThisMonth : byStatus[status]}
                  onMoveTo={handleMoveTo}
                  onOpenDialog={handleOpenDialog}
                  advancingId={advancingId}
                  badge={
                    status === 'INSCRITO' && byStatus.INSCRITO.length > inscritoThisMonth.length
                      ? 'este mês'
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom sections */}
      {!isLoading && (
        <div className="space-y-0 pb-8">
          {/* Sem Feedback */}
          <CollapsibleSection
            title="Sem Feedback"
            count={byStatus.NAO_DEU_FEEDBACK.length}
            chipCls="bg-rose-50 text-rose-600"
          >
            {byStatus.NAO_DEU_FEEDBACK.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">Nenhum lead sem feedback.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {byStatus.NAO_DEU_FEEDBACK.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onMoveTo={handleMoveTo}
                    onOpenDialog={handleOpenDialog} isAdvancing={advancingId === lead.id} />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Perdidos */}
          <CollapsibleSection
            title="Perdidos"
            count={byStatus.PERDIDO.length}
            chipCls="bg-gray-100 text-gray-500"
          >
            {byStatus.PERDIDO.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">Nenhum lead perdido.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {byStatus.PERDIDO.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onMoveTo={handleMoveTo}
                    onOpenDialog={handleOpenDialog} isAdvancing={advancingId === lead.id} />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Arquivados */}
          <CollapsibleSection
            title="Arquivados"
            count={allArchived.length}
            chipCls="bg-slate-100 text-slate-500"
          >
            {allArchived.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">Sem inscritos arquivados.</p>
            ) : (
              <div className="space-y-6">
                {arquivadosByMonth.map(({ label, leads }) => (
                  <div key={label}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 capitalize">{label}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {leads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead} onMoveTo={handleMoveTo}
                          onOpenDialog={handleOpenDialog} isAdvancing={advancingId === lead.id} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}

      {/* Dialogs */}
      <AnimatePresence>
        {activeDialog?.type === 'agendar-visita' && (
          <AdvanceDialog
            lead={activeDialog.lead} mode="agendar-visita"
            onClose={() => setActiveDialog(null)} onConfirm={handleDialogConfirm}
          />
        )}
        {activeDialog?.type === 'registar-visita' && (
          <AdvanceDialog
            lead={activeDialog.lead} mode="registar-visita"
            onClose={() => setActiveDialog(null)} onConfirm={handleDialogConfirm}
          />
        )}
        {activeDialog?.type === 'sem-feedback' && (
          <ObsDialog
            lead={activeDialog.lead}
            onClose={() => setActiveDialog(null)} onConfirm={handleDialogConfirm}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
