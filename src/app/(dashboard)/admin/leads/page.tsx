'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, MoreHorizontal, ChevronDown, Loader2, UserPlus,
  Phone, Mail, Share2, Globe, Users, X, TrendingUp, Check,
  Search, MessageCircle, Calendar, AlertCircle, Clock, ChevronRight, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  formatDistanceToNow, format, parseISO, isThisWeek,
  isSameMonth, isSameYear, differenceInDays, isPast, isToday,
} from 'date-fns'
import { pt } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker, DateTimePicker } from '@/components/ui/date-picker'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { leadApi, ptApi, leadFormApi } from '@/lib/api'
import type { LeadFormConfig } from '@/lib/real-api'
import { CustomSelect } from '@/components/ui/custom-select'
import type { MockLead } from '@/lib/mock-db'
import type { LeadStatus } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PIPELINE: LeadStatus[] = ['NOVO', 'CONTACTADO', 'VISITA_AGENDADA', 'VISITOU', 'INSCRITO']

const COLUMN_META: Record<LeadStatus, { label: string; color: string; bg: string; ring: string; dot: string; confirmCls: string }> = {
  NOVO:             { label: 'Novo Lead',      color: 'text-blue-700',   bg: 'bg-blue-50',   ring: 'ring-blue-200',   dot: 'bg-blue-500',   confirmCls: 'bg-[#111111] hover:bg-gray-800' },
  CONTACTADO:       { label: 'Contactado',      color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200',  dot: 'bg-amber-500',  confirmCls: 'bg-amber-500 hover:bg-amber-600' },
  VISITA_AGENDADA:  { label: 'Visita Agendada', color: 'text-purple-700', bg: 'bg-purple-50', ring: 'ring-purple-200', dot: 'bg-purple-500', confirmCls: 'bg-purple-600 hover:bg-purple-700' },
  VISITOU:          { label: 'Visitou',          color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200', dot: 'bg-orange-500', confirmCls: 'bg-orange-500 hover:bg-orange-600' },
  INSCRITO:         { label: 'Inscrito',         color: 'text-green-700',  bg: 'bg-green-50',  ring: 'ring-green-200',  dot: 'bg-green-500',  confirmCls: 'bg-green-600 hover:bg-green-700' },
  NAO_DEU_FEEDBACK: { label: 'Sem Feedback',     color: 'text-rose-600',   bg: 'bg-rose-50',   ring: 'ring-rose-200',   dot: 'bg-rose-400',   confirmCls: 'bg-rose-500 hover:bg-rose-600' },
  PERDIDO:          { label: 'Perdido',          color: 'text-gray-500',   bg: 'bg-gray-50',   ring: 'ring-gray-200',   dot: 'bg-gray-400',   confirmCls: 'bg-gray-700 hover:bg-gray-800' },
  ARQUIVADO:        { label: 'Arquivado',        color: 'text-slate-500',  bg: 'bg-slate-50',  ring: 'ring-slate-200',  dot: 'bg-slate-400',  confirmCls: 'bg-slate-600 hover:bg-slate-700' },
}

const MOVABLE_PIPELINE: LeadStatus[] = ['NOVO', 'CONTACTADO', 'VISITA_AGENDADA', 'VISITOU', 'INSCRITO']
const MOVABLE_EXTRA: LeadStatus[] = ['NAO_DEU_FEEDBACK', 'PERDIDO', 'ARQUIVADO']

const SOURCE_ICON: Record<string, React.ElementType> = {
  Instagram: Share2, Google: Globe, Referência: Users, Amigo: Users, Outro: Globe,
}

const INTERESSE_OPTIONS = ['Musculação', 'Funcional', 'Yoga/Pilates', 'Emagrecimento', 'Outro']
const SOURCE_OPTIONS    = ['Instagram', 'Google', 'Referência', 'Outro']
// O "responsável" pelo lead é alguém da equipa DESTE estúdio — a lista vem dos
// PTs do tenant (ptApi.list, já filtrado por tenant no backend). Antes eram
// nomes fixos de demo ('Úrsula', 'João', …) que apareciam iguais para todos.

const TAGS = [
  { id: 'alta-intencao', label: 'Alta intenção',  cls: 'bg-green-100 text-green-700 ring-1 ring-green-200' },
  { id: 'segue-preco',   label: 'Preço sensível', cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  { id: 'follow-up',     label: 'Follow-up',      cls: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
  { id: 'referencia',    label: 'Referência',     cls: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
  { id: 'urgente',       label: 'Urgente',        cls: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
  { id: 'grupo',         label: 'Quer grupo',     cls: 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200' },
] as const

type TagId = typeof TAGS[number]['id']

// Dias sem movimento que disparam alerta por status
const STALENESS_THRESHOLDS: Partial<Record<LeadStatus, { warn: number; crit: number }>> = {
  NOVO:            { warn: 2,  crit: 5  },
  CONTACTADO:      { warn: 3,  crit: 7  },
  VISITA_AGENDADA: { warn: 2,  crit: 4  },
  VISITOU:         { warn: 2,  crit: 4  },
  NAO_DEU_FEEDBACK:{ warn: 7,  crit: 14 },
}

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

function getStaleness(lead: MockLead): { level: 'critical' | 'warning' | null; days: number } {
  const days = differenceInDays(new Date(), parseISO(lead.updatedAt))
  const t = STALENESS_THRESHOLDS[lead.status as LeadStatus]
  if (!t) return { level: null, days }
  if (days >= t.crit) return { level: 'critical', days }
  if (days >= t.warn) return { level: 'warning', days }
  return { level: null, days }
}

function whatsappUrl(phone?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return null
  return `https://wa.me/${digits}`
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function matchesSearch(lead: MockLead, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  return (
    lead.name.toLowerCase().includes(lower) ||
    (lead.phone ?? '').includes(lower) ||
    (lead.email ?? '').toLowerCase().includes(lower) ||
    (lead.responsavel ?? '').toLowerCase().includes(lower)
  )
}

function matchesPeriod(lead: MockLead, period: string, month: string): boolean {
  const d = parseISO(lead.createdAt)
  const now = new Date()
  if (period === 'all') {
    if (month === 'all') return true
    // Mês específico sem ano escolhido: assume o ano corrente
    return format(d, 'yyyy-MM') === `${now.getFullYear()}-${month}`
  }
  if (period === '30d')  return differenceInDays(now, d) <= 30
  if (period === '90d')  return differenceInDays(now, d) <= 90
  if (period === '6m')   return differenceInDays(now, d) <= 180
  if (period === '1y')   return differenceInDays(now, d) <= 365
  // period é um ano específico (ex: "2026")
  if (month === 'all') return format(d, 'yyyy') === period
  return format(d, 'yyyy-MM') === `${period}-${month}`
}

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

// ── Universal Move Dialog ─────────────────────────────────────────────────────

function MoveDialog({ lead, targetStatus, onClose, onConfirm }: {
  lead: MockLead
  targetStatus: LeadStatus
  onClose: () => void
  onConfirm: (id: string, status: LeadStatus, data?: Partial<MockLead>) => void
}) {
  const [obs, setObs]                   = useState(lead.observacoes ?? '')
  const [selectedTags, setTags]         = useState<TagId[]>((lead.tags ?? []) as TagId[])
  const [visitaDate, setVisitaDate]     = useState('')
  const [planoInteresse, setPlano]      = useState(lead.planoInteresse ?? '')
  const [followUpDate, setFollowUpDate] = useState(lead.followUpDate ?? '')
  const [isPending, setIsPending]       = useState(false)

  const needsDate  = targetStatus === 'VISITA_AGENDADA'
  const canConfirm = !needsDate || !!visitaDate
  const targetMeta = COLUMN_META[targetStatus]
  const fromMeta   = COLUMN_META[lead.status]

  function toggleTag(id: TagId) {
    setTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  async function handleConfirm() {
    if (!canConfirm) return
    setIsPending(true)
    try {
      const data: Partial<MockLead> = {}
      if (obs.trim())           data.observacoes   = obs.trim()
      if (selectedTags.length)  data.tags          = selectedTags
      if (planoInteresse.trim()) data.planoInteresse = planoInteresse.trim()
      if (followUpDate)         data.followUpDate  = followUpDate
      if (targetStatus === 'VISITA_AGENDADA') data.visitaDate = visitaDate
      if (targetStatus === 'INSCRITO')        data.inscritoEm = new Date().toISOString()
      onConfirm(lead.id, targetStatus, data)
      onClose()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.22 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fromMeta.bg} ${fromMeta.color}`}>
                {fromMeta.label}
              </span>
              <span className="text-gray-300 text-xs">→</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${targetMeta.bg} ${targetMeta.color}`}>
                {targetMeta.label}
              </span>
            </div>
            <h3 className="text-base font-black text-gray-900 truncate">{lead.name}</h3>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 space-y-4 pb-4 overflow-y-auto flex-1">
          {/* DateTimePicker — only VISITA_AGENDADA */}
          {needsDate && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                Data e hora da visita <span className="text-rose-500">*</span>
              </Label>
              <DateTimePicker value={visitaDate} onChange={setVisitaDate} placeholder="Selecionar data e hora" />
            </div>
          )}

          {/* Plano de interesse */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">
              Plano de interesse <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            <Input
              value={planoInteresse}
              onChange={e => setPlano(e.target.value)}
              placeholder="Ex: Pack Mensal, 10 sessões, Trimestral..."
              className="text-base min-h-[44px]"
            />
          </div>

          {/* Próximo follow-up */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">
              Próximo contacto <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            <DatePicker
              value={followUpDate}
              onChange={setFollowUpDate}
              placeholder="Quando voltar a contactar?"
              minDate={new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">
              Observação <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Notas, contexto, próximos passos..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">
              Tags <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map(tag => {
                const active = selectedTags.includes(tag.id)
                return (
                  <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all min-h-[32px] ${
                      active ? tag.cls : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {tag.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-2 flex-shrink-0 border-t border-gray-50">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !canConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-40 ${targetMeta.confirmCls}`}
          >
            {isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : `Mover → ${targetMeta.label}`
            }
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Convert to Aluno Dialog ───────────────────────────────────────────────────

function ConvertDialog({ lead, onClose, onConverted }: {
  lead: MockLead
  onClose: () => void
  onConverted: () => void
}) {
  const [selectedPT, setSelectedPT] = useState('')
  const [isPending, setIsPending] = useState(false)
  const { data: pts = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['pts-list'],
    queryFn: () => ptApi.list().then((list: { id: string; name: string }[]) => list),
  })

  async function handleConvert() {
    if (!selectedPT) { toast.error('Seleciona um Personal Trainer'); return }
    setIsPending(true)
    try {
      await leadApi.convertToAluno(lead.id, selectedPT)
      toast.success(`${lead.name} convertido em aluno com sucesso!`)
      onConverted()
      onClose()
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Erro ao converter')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.22 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Inscrito → Aluno</span>
            </div>
            <h3 className="text-base font-black text-gray-900">{lead.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Vai criar acesso na plataforma com senha <strong>aluno123</strong></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">Atribuir ao Personal Trainer</label>
            <Select value={selectedPT} onValueChange={v => setSelectedPT(v ?? '')} items={pts.map((pt: { id: string; name: string }) => ({ value: pt.id, label: pt.name }))}>
              <SelectTrigger className="min-h-[44px] text-sm">
                <SelectValue placeholder="Selecionar PT..." />
              </SelectTrigger>
              <SelectContent>
                {pts.map((pt: { id: string; name: string }) => (
                  <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px]">
              Cancelar
            </button>
            <button onClick={handleConvert} disabled={isPending || !selectedPT}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-40">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Converter em Aluno'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Status Picker Menu ─────────────────────────────────────────────────────────

function StatusPickerMenu({ lead, onMoveTo, onClose, onConvert, onDelete }: {
  lead: MockLead
  onMoveTo: (status: LeadStatus) => void
  onClose: () => void
  onConvert: () => void
  onDelete: () => void
}) {
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
          {MOVABLE_PIPELINE.filter(s => s !== lead.status).map(status => {
            const meta = COLUMN_META[status]
            return (
              <button key={status} onClick={() => { onMoveTo(status); onClose() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors rounded-lg min-h-[40px] text-left"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
              </button>
            )
          })}
        </div>
        <div className="h-px bg-gray-100 my-1.5 mx-3" />
        <div className="px-1">
          {MOVABLE_EXTRA.filter(s => s !== lead.status).map(status => {
            const meta = COLUMN_META[status]
            return (
              <button key={status} onClick={() => { onMoveTo(status); onClose() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors rounded-lg min-h-[40px] text-left"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
              </button>
            )
          })}
        </div>
        {lead.status === 'INSCRITO' && (
          <>
            <div className="h-px bg-gray-100 my-1.5 mx-3" />
            <div className="px-1">
              <button onClick={() => { onClose(); onConvert() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-green-700 hover:bg-green-50 transition-colors rounded-lg min-h-[40px]">
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-semibold">Converter em aluno</span>
              </button>
            </div>
          </>
        )}
        <div className="h-px bg-gray-100 my-1.5 mx-3" />
        <div className="px-1">
          <button onClick={() => { onClose(); onDelete() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors rounded-lg min-h-[40px]">
            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-semibold">Excluir lead</span>
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, onOpenDialog, isAdvancing, onConvert, onDelete }: {
  lead: MockLead
  onOpenDialog: (lead: MockLead, targetStatus: LeadStatus) => void
  isAdvancing: boolean
  onConvert: (lead: MockLead) => void
  onDelete: (lead: MockLead) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const SourceIcon = lead.source ? (SOURCE_ICON[lead.source] ?? Globe) : Globe
  const staleness  = getStaleness(lead)
  const waUrl      = whatsappUrl(lead.phone)
  const leadTags   = (lead.tags ?? []).map(id => TAGS.find(t => t.id === id)).filter(Boolean)

  // Follow-up date status
  const fuDate = lead.followUpDate ? parseISO(lead.followUpDate) : null
  const fuOverdue = fuDate && isPast(fuDate) && !isToday(fuDate)
  const fuToday   = fuDate && isToday(fuDate)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
      className="bg-white rounded-xl led-gold p-4 flex flex-col gap-3 relative"
    >
      {/* Staleness stripe */}
      {staleness.level && (
        <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-xl ${
          staleness.level === 'critical' ? 'bg-red-400' : 'bg-amber-300'
        }`} />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{lead.name}</p>
            {staleness.level && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                staleness.level === 'critical'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-amber-100 text-amber-600'
              }`}>
                {staleness.days}d parado
              </span>
            )}
          </div>

          {/* Phone + WhatsApp */}
          {lead.phone && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-gray-300 flex-shrink-0" />
              <span className="text-xs text-gray-400">{lead.phone}</span>
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="text-green-500 hover:text-green-600 transition-colors flex-shrink-0"
                  onClick={e => e.stopPropagation()}
                  title="Abrir WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Email */}
          {lead.email && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
              <Mail className="w-3 h-3 flex-shrink-0" />{lead.email}
            </p>
          )}
        </div>

        {/* Responsável initial + menu */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {lead.responsavel && (
            <span
              className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-[9px] font-black flex items-center justify-center flex-shrink-0"
              title={lead.responsavel}
            >
              {getInitials(lead.responsavel)}
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <StatusPickerMenu
                  lead={lead}
                  onMoveTo={status => { setMenuOpen(false); onOpenDialog(lead, status) }}
                  onClose={() => setMenuOpen(false)}
                  onConvert={() => { setMenuOpen(false); onConvert(lead) }}
                  onDelete={() => { setMenuOpen(false); onDelete(lead) }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {lead.interesse && (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white">
            {lead.interesse}
          </span>
        )}
        {lead.planoInteresse && (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
            {lead.planoInteresse}
          </span>
        )}
        {lead.source && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
            <SourceIcon className="w-2.5 h-2.5" />{lead.source}
          </span>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">{daysAgo(lead.createdAt)}</span>
      </div>

      {/* Tags */}
      {leadTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {leadTags.map(tag => tag && (
            <span key={tag.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tag.cls}`}>
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Visita badge */}
      {lead.visitaDate && (
        <div className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          Visita: {format(parseISO(lead.visitaDate), "d MMM 'às' HH'h'mm", { locale: pt })}
        </div>
      )}

      {/* Follow-up date */}
      {fuDate && (
        <div className={`text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
          fuOverdue
            ? 'bg-red-50 text-red-600'
            : fuToday
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-50 text-gray-500'
        }`}>
          <Clock className="w-3 h-3 flex-shrink-0" />
          {fuOverdue
            ? `Contacto em atraso — ${format(fuDate, "d MMM", { locale: pt })}`
            : fuToday
              ? 'Contactar hoje'
              : `Contactar em ${format(fuDate, "d MMM", { locale: pt })}`
          }
        </div>
      )}

      {/* Respostas aos campos próprios do formulário. Sem isto, o estúdio
          configura perguntas e as respostas ficam invisíveis no CRM. */}
      {lead.customAnswers?.length ? (
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2 space-y-1">
          {lead.customAnswers.map(a => (
            <div key={a.fieldId} className="text-[11px] leading-snug">
              <span className="text-gray-400">{a.label}: </span>
              <span className="text-gray-700 font-medium">{a.value}</span>
            </div>
          ))}
        </div>
      ) : null}

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

      {/* Quick actions */}
      {isAdvancing ? (
        <div className="mt-auto flex items-center justify-center min-h-[40px]">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {lead.status === 'NOVO' && (
            <button onClick={() => onOpenDialog(lead, 'CONTACTADO')}
              className="mt-auto w-full min-h-[40px] text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5" /> Marcar contactado
            </button>
          )}
          {lead.status === 'CONTACTADO' && (
            <div className="mt-auto flex gap-2">
              <button onClick={() => onOpenDialog(lead, 'VISITA_AGENDADA')}
                className="flex-1 min-h-[40px] text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center justify-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5" /> Agendar visita
              </button>
              <button onClick={() => onOpenDialog(lead, 'NAO_DEU_FEEDBACK')}
                className="min-h-[40px] px-3 text-xs font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors whitespace-nowrap">
                Sem feedback
              </button>
            </div>
          )}
          {lead.status === 'VISITA_AGENDADA' && (
            <div className="mt-auto flex gap-2">
              <button onClick={() => onOpenDialog(lead, 'VISITOU')}
                className="flex-1 min-h-[40px] text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Compareceu
              </button>
              <button onClick={() => onOpenDialog(lead, 'NAO_DEU_FEEDBACK')}
                className="flex-1 min-h-[40px] text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center">
                Não veio
              </button>
            </div>
          )}
          {lead.status === 'VISITOU' && (
            <div className="mt-auto flex gap-2">
              <button onClick={() => onOpenDialog(lead, 'INSCRITO')}
                className="flex-1 min-h-[40px] text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Inscrever
              </button>
              <button onClick={() => onOpenDialog(lead, 'VISITA_AGENDADA')}
                className="flex-1 min-h-[40px] text-xs font-semibold rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors flex items-center justify-center">
                Reagendar
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({ status, leads, onOpenDialog, advancingId, badge, onConvert, onDelete }: {
  status: LeadStatus
  leads: MockLead[]
  onOpenDialog: (lead: MockLead, targetStatus: LeadStatus) => void
  advancingId: string | null
  badge?: string
  onConvert: (lead: MockLead) => void
  onDelete: (lead: MockLead) => void
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
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onOpenDialog={onOpenDialog} isAdvancing={advancingId === lead.id} onConvert={onConvert} onDelete={onDelete} />
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
      <button onClick={() => setOpen(v => !v)}
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

type NewLeadForm = {
  name: string; phone: string; email: string
  interesse: string; source: string; responsavel: string
  planoInteresse: string; observacoes: string
}
const EMPTY_FORM: NewLeadForm = {
  name: '', phone: '', email: '', interesse: '', source: '',
  responsavel: '', planoInteresse: '', observacoes: '',
}

function NewLeadSheet({ onCreated }: { onCreated: (lead: MockLead) => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewLeadForm>(EMPTY_FORM)
  // Respostas aos campos que o estúdio configurou no formulário público — a
  // lead criada à mão responde às MESMAS perguntas, senão metade das leads no
  // CRM tem a informação e a outra metade não.
  const [answers, setAnswers] = useState<Record<string, string[]>>({})

  // Só busca a config quando o painel abre (não no load da página).
  const { data: cfg } = useQuery<LeadFormConfig>({
    queryKey: ['lead-form-config'],
    queryFn: leadFormApi.get,
    enabled: open,
    staleTime: 60_000,
  })
  const customFields = cfg?.fields ?? []

  // Equipa do estúdio para o campo "Responsável" — mesma query da conversão
  // (['pts-list']), por isso normalmente já está em cache.
  const { data: equipa = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['pts-list'],
    queryFn: () => ptApi.list().then((list: { id: string; name: string }[]) => list),
    enabled: open,
    staleTime: 60_000,
  })
  const responsaveis = equipa.map(p => p.name)

  function setAnswerSingle(fieldId: string, value: string) {
    setAnswers(a => ({ ...a, [fieldId]: value ? [value] : [] }))
  }
  function toggleAnswerMulti(fieldId: string, option: string) {
    setAnswers(a => {
      const cur = a[fieldId] ?? []
      return { ...a, [fieldId]: cur.includes(option) ? cur.filter(o => o !== option) : [...cur, option] }
    })
  }

  const createMutation = useMutation({
    mutationFn: () => leadApi.create({
      name: form.name, phone: form.phone || undefined, email: form.email || undefined,
      interesse: form.interesse || undefined, source: form.source || undefined,
      responsavel: form.responsavel || undefined,
      planoInteresse: form.planoInteresse || undefined,
      observacoes: form.observacoes || undefined,
      status: 'NOVO',
      // Só envia campos com resposta — o backend valida obrigatórios/opções.
      answers: Object.fromEntries(Object.entries(answers).filter(([, v]) => v.length > 0)),
    }),
    onSuccess: lead => {
      onCreated(lead)
      toast.success(`Lead "${lead.name}" criado!`)
      setOpen(false); setForm(EMPTY_FORM); setAnswers({})
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao criar lead'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone) { toast.error('Nome e telefone são obrigatórios'); return }
    // Valida os obrigatórios configurados antes de enviar (o backend também
    // valida — isto é só para dar erro imediato e apontar o campo).
    const faltando = customFields.find(f => f.required && !(answers[f.id]?.length))
    if (faltando) { toast.error(`Preenche: ${faltando.label}`); return }
    createMutation.mutate()
  }

  function setField<K extends keyof NewLeadForm>(key: K, value: NewLeadForm[K]) {
    setForm(f => ({ ...f, [key]: value }))
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
            <Input placeholder="André Pereira" value={form.name} onChange={e => setField('name', e.target.value)} className="text-base min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Telefone *</Label>
            <Input placeholder="+351 916 000 000" value={form.phone} onChange={e => setField('phone', e.target.value)} className="text-base min-h-[44px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Email</Label>
            <Input type="email" placeholder="andre@email.com" value={form.email} onChange={e => setField('email', e.target.value)} className="text-base min-h-[44px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Interesse</Label>
              <Select value={form.interesse} onValueChange={v => setField('interesse', v ?? '')}>
                <SelectTrigger className="text-base min-h-[44px]"><SelectValue placeholder="Modalidade..." /></SelectTrigger>
                <SelectContent>{INTERESSE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Origem</Label>
              <Select value={form.source} onValueChange={v => setField('source', v ?? '')}>
                <SelectTrigger className="text-base min-h-[44px]"><SelectValue placeholder="Canal..." /></SelectTrigger>
                <SelectContent>{SOURCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Responsável</Label>
              <Select value={form.responsavel} onValueChange={v => setField('responsavel', v ?? '')}>
                <SelectTrigger className="text-base min-h-[44px]"><SelectValue placeholder="Quem trata?" /></SelectTrigger>
                <SelectContent>
                  {responsaveis.length === 0
                    ? <div className="px-3 py-2 text-sm text-gray-400">Sem PTs cadastrados</div>
                    : responsaveis.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Plano interesse</Label>
              <Input placeholder="Ex: Mensal, 10 sess." value={form.planoInteresse} onChange={e => setField('planoInteresse', e.target.value)} className="text-base min-h-[44px]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Observações</Label>
            <textarea placeholder="Notas sobre o contacto..." value={form.observacoes} onChange={e => setField('observacoes', e.target.value)} rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
          </div>

          {/* Campos que o estúdio configurou no formulário público — a lead
              manual responde às mesmas perguntas. */}
          {customFields.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pt-2">Perguntas do estúdio</p>
              {customFields.map(f => {
                const val = answers[f.id] ?? []
                return (
                  <div key={f.id} className="space-y-1.5">
                    <Label className="text-sm font-semibold">{f.label}{f.required && ' *'}</Label>
                    {f.type === 'TEXT' && (
                      <Input value={val[0] ?? ''} placeholder={f.placeholder ?? ''}
                        onChange={e => setAnswerSingle(f.id, e.target.value)} className="text-base min-h-[44px]" />
                    )}
                    {f.type === 'TEXTAREA' && (
                      <textarea value={val[0] ?? ''} placeholder={f.placeholder ?? ''} rows={3}
                        onChange={e => setAnswerSingle(f.id, e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
                    )}
                    {f.type === 'SELECT' && (
                      <Select value={val[0] ?? ''} onValueChange={v => setAnswerSingle(f.id, v ?? '')}>
                        <SelectTrigger className="text-base min-h-[44px]"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>{f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    {f.type === 'RADIO' && (
                      <div className="space-y-1.5">
                        {f.options.map(o => (
                          <label key={o} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="radio" name={`f_${f.id}`} checked={val[0] === o}
                              onChange={() => setAnswerSingle(f.id, o)} className="w-4 h-4 accent-[#111111]" />
                            {o}
                          </label>
                        ))}
                      </div>
                    )}
                    {f.type === 'CHECKBOX' && (
                      <div className="space-y-1.5">
                        {f.options.map(o => (
                          <label key={o} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={val.includes(o)}
                              onChange={() => toggleAnswerMulti(f.id, o)} className="w-4 h-4 accent-[#111111]" />
                            {o}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

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

type ActiveDialog = { lead: MockLead; targetStatus: LeadStatus } | null

export default function LeadsPage() {
  const qc = useQueryClient()
  const [advancingId, setAdvancingId]     = useState<string | null>(null)
  const [mobileTab, setMobileTab]         = useState<LeadStatus>('NOVO')
  const [activeDialog, setActiveDialog]   = useState<ActiveDialog>(null)
  const [convertLead, setConvertLead]     = useState<MockLead | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<MockLead | null>(null)
  const [search, setSearch]               = useState('')
  const [periodFilter, setPeriodFilter]   = useState('all')
  const [monthFilter, setMonthFilter]     = useState('all')

  const { data: allLeads = [], isLoading } = useQuery<MockLead[]>({
    queryKey: ['leads'],
    queryFn: leadApi.list,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, data }: { id: string; status: LeadStatus; data?: Partial<MockLead> }) =>
      leadApi.updateStatus(id, status, data),
    onMutate: ({ id }) => setAdvancingId(id),
    onSuccess: updated => {
      qc.setQueryData<MockLead[]>(['leads'], prev => prev?.map(l => l.id === updated.id ? updated : l) ?? prev)
      toast.success(`Lead movido para "${COLUMN_META[updated.status].label}"`)
    },
    onError: () => toast.error('Erro ao mover lead'),
    onSettled: () => setAdvancingId(null),
  })

  function handleOpenDialog(lead: MockLead, targetStatus: LeadStatus) {
    setActiveDialog({ lead, targetStatus })
  }

  function handleDialogConfirm(id: string, status: LeadStatus, data?: Partial<MockLead>) {
    updateStatusMutation.mutate({ id, status, data })
  }

  function handleCreated(lead: MockLead) {
    qc.setQueryData<MockLead[]>(['leads'], prev => prev ? [lead, ...prev] : [lead])
  }

  function handleConvertLead(lead: MockLead) {
    setConvertLead(lead)
  }

  function handleConverted() {
    qc.invalidateQueries({ queryKey: ['leads'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadApi.delete(id),
    onSuccess: (_res, id) => {
      qc.setQueryData<MockLead[]>(['leads'], prev => prev?.filter(l => l.id !== id) ?? prev)
      toast.success('Lead excluído')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Não foi possível excluir o lead'),
  })

  function handleDeleteLead(lead: MockLead) {
    setDeleteTarget(lead)
  }

  // ── Filter + group ────────────────────────────────────────────────────────

  const filteredLeads = useMemo(
    () => allLeads.filter(l => matchesSearch(l, search) && matchesPeriod(l, periodFilter, monthFilter)),
    [allLeads, search, periodFilter, monthFilter],
  )

  const byStatus = useMemo(() => {
    const all: LeadStatus[] = ['NOVO', 'CONTACTADO', 'VISITA_AGENDADA', 'VISITOU', 'INSCRITO', 'NAO_DEU_FEEDBACK', 'PERDIDO', 'ARQUIVADO']
    const map = Object.fromEntries(all.map(s => [s, [] as MockLead[]])) as Record<LeadStatus, MockLead[]>
    for (const lead of filteredLeads) map[lead.status]?.push(lead)
    return map
  }, [filteredLeads])

  const inscritoThisMonth = byStatus.INSCRITO.filter(l => isCurrentMonth(l.inscritoEm ?? l.updatedAt))
  const inscritoArchived  = byStatus.INSCRITO.filter(l => !isCurrentMonth(l.inscritoEm ?? l.updatedAt))
  const allArchived       = useMemo(() => [...byStatus.ARQUIVADO, ...inscritoArchived], [byStatus.ARQUIVADO, inscritoArchived])

  const arquivadosByMonth = useMemo(() => {
    const monthMap = new Map<string, { label: string; leads: MockLead[] }>()
    for (const lead of allArchived) {
      const d = parseISO(lead.inscritoEm ?? lead.updatedAt)
      const key = format(d, 'yyyy-MM')
      const label = format(d, 'MMMM yyyy', { locale: pt })
      if (!monthMap.has(key)) monthMap.set(key, { label, leads: [] })
      monthMap.get(key)!.leads.push(lead)
    }
    return Array.from(monthMap.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([, v]) => v)
  }, [allArchived])

  // Stats
  const pipelineLeads     = allLeads.filter(l => (PIPELINE as string[]).includes(l.status))
  const visitasEstaSemana = allLeads.filter(l => l.visitaDate != null && isThisWeek(parseISO(l.visitaDate))).length
  const followUpsHoje     = allLeads.filter(l => l.followUpDate && (isToday(parseISO(l.followUpDate)) || (isPast(parseISO(l.followUpDate)) && !isToday(parseISO(l.followUpDate))))).length
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

      {/* Search + Period filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, telefone, email ou responsável..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 min-h-[44px]"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
        {/* O separador "──────" do <select> nativo desapareceu: os anos passam
            a vir prefixados ("Ano 2026"), que distingue melhor do que uma linha
            decorativa não-selecionável. */}
        <CustomSelect
          size="lg"
          className="flex-1 sm:flex-none sm:w-48"
          value={periodFilter}
          onChange={setPeriodFilter}
          options={[
            { value: 'all', label: 'Todos os períodos' },
            { value: '30d', label: 'Últimos 30 dias' },
            { value: '90d', label: 'Últimos 3 meses' },
            { value: '6m', label: 'Últimos 6 meses' },
            { value: '1y', label: 'Último ano' },
            ...[0, 1, 2].map(i => {
              const y = new Date().getFullYear() - i
              return { value: String(y), label: `Ano ${y}` }
            }),
          ]}
        />
        <CustomSelect
          size="lg"
          className="flex-1 sm:flex-none sm:w-44"
          value={monthFilter}
          onChange={setMonthFilter}
          options={[{ value: 'all', label: 'Todos os meses' }, ...MONTH_OPTIONS]}
        />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'No pipeline',     value: pipelineLeads.length,      icon: null },
          { label: 'Visitas semana',  value: visitasEstaSemana,          icon: null },
          { label: 'Inscritos mês',   value: inscritoThisMonthCount,     icon: null },
          { label: 'Follow-ups',      value: followUpsHoje,              icon: AlertCircle, urgent: followUpsHoje > 0 },
        ].map(({ label, value, urgent }) => (
          <div key={label} className={`bg-white rounded-xl px-3 py-3 flex flex-col gap-0.5 ${
            urgent && value > 0 ? 'border border-amber-200 bg-amber-50 shadow-sm' : 'led-gold'
          }`}>
            <p className={`text-[10px] sm:text-xs font-medium uppercase tracking-wide leading-tight ${
              urgent && value > 0 ? 'text-amber-600' : 'text-gray-400'
            }`}>{label}</p>
            <p className={`text-xl sm:text-2xl font-black ${
              urgent && value > 0 ? 'text-amber-700' : 'text-gray-900'
            }`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search/filter empty state */}
      {(search || periodFilter !== 'all' || monthFilter !== 'all') && filteredLeads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Search className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-400">Nenhum lead encontrado com os filtros aplicados</p>
          <button onClick={() => { setSearch(''); setPeriodFilter('all'); setMonthFilter('all') }} className="text-sm text-gray-600 underline">Limpar filtros</button>
        </div>
      )}

      {/* Kanban */}
      {isLoading ? (
        <>
          <div className="lg:hidden space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {PIPELINE.map(s => <Skeleton key={s} className="flex-shrink-0 h-11 w-28 rounded-xl" />)}
            </div>
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
          <div className="hidden lg:flex gap-4 overflow-x-auto pb-4">
            {PIPELINE.map(s => (
              <div key={s} className="min-w-[260px] flex-1 flex flex-col gap-3">
                <Skeleton className="h-10 rounded-xl" />
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
              </div>
            ))}
          </div>
        </>
      ) : (!search && periodFilter === 'all') || filteredLeads.length > 0 ? (
        <>
          {/* Mobile tab bar */}
          <div className="lg:hidden">
            <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:-mx-5 sm:px-5 scrollbar-hide">
              {PIPELINE.map(status => {
                const meta  = COLUMN_META[status]
                const count = status === 'INSCRITO' ? inscritoThisMonth.length : (byStatus[status]?.length ?? 0)
                return (
                  <button key={status} onClick={() => setMobileTab(status)}
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
                {(mobileTab === 'INSCRITO' ? inscritoThisMonth : (byStatus[mobileTab] ?? [])).map(lead => (
                  <LeadCard key={lead.id} lead={lead} onOpenDialog={handleOpenDialog} isAdvancing={advancingId === lead.id} onConvert={handleConvertLead} onDelete={handleDeleteLead} />
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
              {PIPELINE.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  leads={status === 'INSCRITO' ? inscritoThisMonth : byStatus[status]}
                  onOpenDialog={handleOpenDialog}
                  advancingId={advancingId}
                  badge={status === 'INSCRITO' && byStatus.INSCRITO.length > inscritoThisMonth.length ? 'este mês' : undefined}
                  onConvert={handleConvertLead}
                  onDelete={handleDeleteLead}
                />
              ))}
            </div>
          </div>

          {/* Bottom sections */}
          <div className="space-y-0 pb-8">
            <CollapsibleSection title="Sem Feedback" count={byStatus.NAO_DEU_FEEDBACK.length} chipCls="bg-rose-50 text-rose-600">
              {byStatus.NAO_DEU_FEEDBACK.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">Nenhum lead sem feedback.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {byStatus.NAO_DEU_FEEDBACK.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onOpenDialog={handleOpenDialog} isAdvancing={advancingId === lead.id} onConvert={handleConvertLead} onDelete={handleDeleteLead} />
                  ))}
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="Perdidos" count={byStatus.PERDIDO.length} chipCls="bg-gray-100 text-gray-500">
              {byStatus.PERDIDO.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">Nenhum lead perdido.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {byStatus.PERDIDO.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onOpenDialog={handleOpenDialog} isAdvancing={advancingId === lead.id} onConvert={handleConvertLead} onDelete={handleDeleteLead} />
                  ))}
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="Arquivados" count={allArchived.length} chipCls="bg-slate-100 text-slate-500">
              {allArchived.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">Sem inscritos arquivados.</p>
              ) : (
                <div className="space-y-6">
                  {arquivadosByMonth.map(({ label, leads }) => (
                    <div key={label}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 capitalize">{label}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {leads.map(lead => (
                          <LeadCard key={lead.id} lead={lead} onOpenDialog={handleOpenDialog} isAdvancing={advancingId === lead.id} onConvert={handleConvertLead} onDelete={handleDeleteLead} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>
        </>
      ) : null}

      {/* Universal Move Dialog */}
      <AnimatePresence>
        {activeDialog && (
          <MoveDialog
            lead={activeDialog.lead}
            targetStatus={activeDialog.targetStatus}
            onClose={() => setActiveDialog(null)}
            onConfirm={handleDialogConfirm}
          />
        )}
      </AnimatePresence>

      {/* Convert to Aluno Dialog */}
      <AnimatePresence>
        {convertLead && (
          <ConvertDialog
            lead={convertLead}
            onClose={() => setConvertLead(null)}
            onConverted={handleConverted}
          />
        )}
      </AnimatePresence>

      {/* Excluir lead — confirmação. Sem AnimatePresence de propósito: no
          React 19/Next 16 o exit de AnimatePresence prende o modal aberto
          (mesmo gotcha já visto nas tabs). Render condicional simples fecha na hora. */}
      {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="px-6 pt-6 pb-2">
                <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-base font-black text-gray-900">Excluir lead?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <strong className="text-gray-700">{deleteTarget.name}</strong> será removido do CRM. Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="px-6 py-4 flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteMutation.isPending}
                  className="min-h-[40px] px-4 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                  className="min-h-[40px] px-4 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
      )}
    </div>
  )
}
