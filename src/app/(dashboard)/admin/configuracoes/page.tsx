'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Copy, Check, Calendar, CreditCard, Loader2, ExternalLink, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { LeadFormBuilder } from '@/components/lead-form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { WeeklyHoursEditor } from '@/components/weekly-hours-editor'
import { ClosedDaysManager } from '@/components/closed-days-manager'
import { cn } from '@/lib/utils'
import { studioConfigApi } from '@/lib/api'

interface StudioConfig {
  slotDurationMinutes: number
  classDurationMinutes: number
  name: string
  slug: string
  privacyPolicyUrl: string | null
  leadCaptureEnabled: boolean
  ptPaymentDueWeekday: number
}

const WEEKDAYS = [
  { v: 1, label: 'Segunda-feira' }, { v: 2, label: 'Terça-feira' },
  { v: 3, label: 'Quarta-feira' }, { v: 4, label: 'Quinta-feira' },
  { v: 5, label: 'Sexta-feira' }, { v: 6, label: 'Sábado' }, { v: 7, label: 'Domingo' },
]

const TABS = [
  { id: 'identidade', label: 'Identidade' },
  { id: 'leads', label: 'Leads' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'faturacao', label: 'Faturação' },
] as const
type TabId = typeof TABS[number]['id']

const field = 'text-[11px] font-medium text-gray-500 mb-1.5 block'
const hint = 'text-[11px] text-gray-400 mt-1.5 leading-snug'

export default function ConfiguracoesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<StudioConfig>({ queryKey: ['studio-config'], queryFn: studioConfigApi.get })

  const [tab, setTab] = useState<TabId>('identidade')
  const [name, setName] = useState('')
  const [privacyUrl, setPrivacyUrl] = useState('')
  const [classDuration, setClassDuration] = useState(30)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (data) { setName(data.name); setPrivacyUrl(data.privacyPolicyUrl ?? ''); setClassDuration(data.classDurationMinutes) }
  }, [data])

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof studioConfigApi.updateSettings>[0]) => studioConfigApi.updateSettings(patch),
    onSuccess: (fresh) => { qc.setQueryData(['studio-config'], fresh); toast.success('Guardado') },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível guardar'),
  })

  const shareUrl = data ? `${typeof window !== 'undefined' ? window.location.origin : ''}/l/${data.slug}` : ''
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { toast.error('Não foi possível copiar') }
  }

  if (isLoading || !data) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const identityDirty = name.trim() !== data.name || (privacyUrl.trim() || null) !== (data.privacyPolicyUrl ?? null)

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <header className="mb-4">
        <h1 className="text-base font-semibold text-gray-900 tracking-tight">Configurações</h1>
        <p className="text-xs text-gray-400 mt-0.5">Tudo do estúdio, num só lugar.</p>
      </header>

      {/* Tab bar — sublinhado desliza via CSS (transform), sem JS de animação */}
      <div className="relative flex gap-0.5 border-b border-gray-100 overflow-x-auto no-scrollbar">
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn('relative px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors min-h-[40px] flex-1',
                active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600')}
            >
              {t.label}
            </button>
          )
        })}
        <span
          className="absolute bottom-0 h-0.5 rounded-full bg-gray-900 transition-transform duration-300"
          style={{ width: `${100 / TABS.length}%`, transform: `translateX(${TABS.findIndex(t => t.id === tab) * 100}%)` }}
        />
      </div>

      <div className="pt-5">
        <div key={tab} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            {tab === 'identidade' && (
              <div className="space-y-4">
                <div>
                  <label className={field}>NOME DO ESTÚDIO</label>
                  <Input value={name} onChange={e => setName(e.target.value)} maxLength={150} placeholder="MG Estúdio Boutique" className="h-9 text-sm" />
                </div>
                <div>
                  <label className={field}>POLÍTICA DE PRIVACIDADE <span className="text-gray-300 font-normal">· opcional</span></label>
                  <Input value={privacyUrl} onChange={e => setPrivacyUrl(e.target.value)} maxLength={300} placeholder="https://…" className="h-9 text-sm" />
                  <p className={hint}>Ligada ao consentimento RGPD do formulário. Sem ela, o texto aparece sem link.</p>
                </div>
                <div className="flex justify-end pt-1">
                  <Button onClick={() => save.mutate({ name: name.trim(), privacyPolicyUrl: privacyUrl.trim() || null })} disabled={!identityDirty || save.isPending} className="h-8 text-xs px-4">
                    {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
                  </Button>
                </div>
              </div>
            )}

            {tab === 'leads' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 py-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">Captura ativa</p>
                    <p className={hint + ' !mt-0.5'}>Desligada, a página mostra “marcações indisponíveis” — sem apagar leads.</p>
                  </div>
                  <Switch checked={data.leadCaptureEnabled} onCheckedChange={(v) => save.mutate({ leadCaptureEnabled: v })} />
                </div>
                <div className="border-t border-gray-50 pt-4">
                  <label className={field}>LINK PARTILHÁVEL</label>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 h-9 flex items-center text-[13px] text-gray-600 font-mono truncate">{shareUrl}</div>
                    <Button variant="outline" onClick={copyLink} className="h-9 px-3 gap-1.5 text-xs flex-shrink-0">
                      {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                    </Button>
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir link">
                      <Button variant="outline" className="h-9 w-9 p-0 flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></Button>
                    </a>
                  </div>
                  <p className={hint}>Cola na landing, bio ou anúncios. Cada lead cai direto no CRM.</p>
                </div>

                {/* Construtor do formulário público: logo, mensagem e até 6
                    campos próprios. */}
                <div className="border-t border-gray-50 pt-5">
                  <LeadFormBuilder />
                </div>
              </div>
            )}

            {tab === 'agenda' && (
              <div className="space-y-5">
                <div>
                  <label className={field}>HORÁRIO DE FUNCIONAMENTO</label>
                  <WeeklyHoursEditor />
                  <p className={hint}>Define quando o estúdio abre e fecha em cada dia. A agenda só oferece horários dentro desta janela.</p>
                </div>

                <div className="border-t border-gray-50 pt-4">
                  <label className={field}>DURAÇÃO DA AULA <span className="text-gray-300 font-normal">· slot de {data.slotDurationMinutes} min</span></label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min={1} max={data.slotDurationMinutes} value={classDuration} onChange={e => setClassDuration(Number(e.target.value))} className="h-9 text-sm w-28" />
                    <span className="text-xs text-gray-400">min</span>
                    <div className="flex-1" />
                    <Button onClick={() => save.mutate({ classDurationMinutes: classDuration })} disabled={classDuration === data.classDurationMinutes || save.isPending} className="h-8 text-xs px-4">Guardar</Button>
                  </div>
                  <p className={hint}>O resto do slot ({data.slotDurationMinutes - classDuration} min) é a folga do PT entre alunos.</p>
                </div>

                <div className="border-t border-gray-50 pt-4">
                  <label className={field}>DIAS FECHADOS & FERIADOS</label>
                  <ClosedDaysManager />
                  <p className={hint}>Fecha o estúdio o dia inteiro numa data específica. A agenda mostra o dia como fechado e não aceita reservas.</p>
                </div>

                <Link href="/admin/schedule" className="flex items-center justify-between rounded-lg border border-gray-100 px-3 h-11 hover:bg-gray-50 transition-colors group">
                  <span className="flex items-center gap-2 text-[13px] text-gray-700"><Calendar className="w-4 h-4 text-gray-400" /> Bloquear horários pontuais na agenda</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </Link>
              </div>
            )}

            {tab === 'faturacao' && (
              <div className="space-y-4">
                {/* Dia de vencimento da renda semanal do PT — a inadimplência
                    passa a marcar em atraso a partir deste dia. Grava logo na
                    mudança; semanas já registadas ficam com o dia congelado. */}
                <div className="rounded-lg border border-gray-100 p-3.5">
                  <label className={field}>Dia de vencimento da renda semanal</label>
                  <select
                    value={data.ptPaymentDueWeekday}
                    disabled={save.isPending}
                    onChange={e => save.mutate({ ptPaymentDueWeekday: Number(e.target.value) })}
                    className="w-full h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:border-gray-900 disabled:opacity-60"
                  >
                    {WEEKDAYS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                  </select>
                  <p className={hint}>
                    Dia em que a renda de cada PT vence. A Inadimplência marca “em atraso” a partir deste dia.
                    Só afeta semanas ainda não registadas como recebidas.
                  </p>
                </div>
                <div className="space-y-1.5">
                {[
                  { href: '/admin/plans', label: 'Planos de Aluguel', sub: 'Tipos de plano e faixas por hora' },
                  { href: '/admin/billing', label: 'Faturação', sub: 'Valores e ciclo semanal por PT' },
                ].map(({ href, label, sub }) => (
                  <Link key={href} href={href} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 h-12 hover:bg-gray-50 transition-colors group">
                    <span className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-gray-800">{label}</span>
                        <span className="block text-[11px] text-gray-400">{sub}</span>
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </Link>
                ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
