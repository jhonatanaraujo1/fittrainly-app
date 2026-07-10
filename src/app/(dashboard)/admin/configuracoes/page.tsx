'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Building2, Link2, Copy, Check, Clock, CreditCard, Calendar, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { studioConfigApi } from '@/lib/api'

interface StudioConfig {
  slotDurationMinutes: number
  classDurationMinutes: number
  name: string
  slug: string
  privacyPolicyUrl: string | null
  leadCaptureEnabled: boolean
}

function Section({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function ConfiguracoesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<StudioConfig>({ queryKey: ['studio-config'], queryFn: studioConfigApi.get })

  const [name, setName] = useState('')
  const [privacyUrl, setPrivacyUrl] = useState('')
  const [classDuration, setClassDuration] = useState<number>(30)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (data) {
      setName(data.name)
      setPrivacyUrl(data.privacyPolicyUrl ?? '')
      setClassDuration(data.classDurationMinutes)
    }
  }, [data])

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof studioConfigApi.updateSettings>[0]) => studioConfigApi.updateSettings(patch),
    onSuccess: (fresh) => {
      qc.setQueryData(['studio-config'], fresh)
      qc.invalidateQueries({ queryKey: ['studio-config'] })
      toast.success('Configurações guardadas')
    },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível guardar'),
  })

  const shareUrl = data ? `${typeof window !== 'undefined' ? window.location.origin : ''}/l/${data.slug}` : ''

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Não foi possível copiar') }
  }

  if (isLoading || !data) {
    return (
      <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-4">
        <h1 className="text-xl font-black text-gray-900">Configurações</h1>
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    )
  }

  const identityDirty = name.trim() !== data.name || (privacyUrl.trim() || null) !== (data.privacyPolicyUrl ?? null)

  return (
    <div className="p-5 lg:p-7 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-400 mt-0.5">Tudo que se aplica ao estúdio inteiro, num só lugar.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Identidade */}
        <Section icon={Building2} title="Identidade do estúdio" desc="Nome e política de privacidade — aparecem na página pública de captura de leads.">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Nome do estúdio</label>
              <Input value={name} onChange={e => setName(e.target.value)} maxLength={150} placeholder="MG Estúdio Boutique" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">URL da política de privacidade <span className="text-gray-400">(opcional)</span></label>
              <Input value={privacyUrl} onChange={e => setPrivacyUrl(e.target.value)} maxLength={300} placeholder="https://..." />
              <p className="text-[11px] text-gray-400 mt-1">Ligada ao consentimento RGPD do formulário de leads. Sem ela, o texto aparece sem link.</p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => save.mutate({ name: name.trim(), privacyPolicyUrl: privacyUrl.trim() || null })}
                disabled={!identityDirty || save.isPending}
                className="h-9 text-sm"
              >
                {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
          </div>
        </Section>

        {/* Captura de leads */}
        <Section icon={Link2} title="Captura de leads" desc="O link que vai na landing / bio / anúncios do estúdio. Cada lead cai direto no CRM.">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-100 px-3.5 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Captura ativa</p>
                <p className="text-xs text-gray-400">Desligada, a página mostra &quot;marcações indisponíveis&quot; — sem apagar leads.</p>
              </div>
              <Switch
                checked={data.leadCaptureEnabled}
                onCheckedChange={(v) => save.mutate({ leadCaptureEnabled: v })}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Link partilhável</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 font-mono truncate">
                  {shareUrl}
                </div>
                <Button variant="outline" onClick={copyLink} className="h-10 gap-1.5 flex-shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </Button>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="h-10 w-10 p-0 flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></Button>
                </a>
              </div>
            </div>
          </div>
        </Section>

        {/* Agenda */}
        <Section icon={Clock} title="Agenda" desc="Duração da aula dentro de cada slot. O resto do slot é a folga do PT.">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Duração da aula (min) — slot de {data.slotDurationMinutes} min</label>
              <Input type="number" min={1} max={data.slotDurationMinutes} value={classDuration} onChange={e => setClassDuration(Number(e.target.value))} />
            </div>
            <Button
              onClick={() => save.mutate({ classDurationMinutes: classDuration })}
              disabled={classDuration === data.classDurationMinutes || save.isPending}
              className="h-10 text-sm"
            >
              Guardar
            </Button>
          </div>
          <Link href="/admin/schedule" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 mt-3">
            <Calendar className="w-3.5 h-3.5" /> Horário de funcionamento e bloqueios → na Agenda do Estúdio
          </Link>
        </Section>

        {/* Faturação */}
        <Section icon={CreditCard} title="Faturação e planos" desc="A configuração de cobrança (planos, faixas por hora) vive nos Planos de Aluguel.">
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/plans"><Button variant="outline" className="h-9 text-sm gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Planos de Aluguel</Button></Link>
            <Link href="/admin/billing"><Button variant="outline" className="h-9 text-sm gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Faturação</Button></Link>
          </div>
        </Section>
      </motion.div>
    </div>
  )
}
