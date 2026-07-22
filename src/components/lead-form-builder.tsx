'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, GripVertical, Upload, X, Loader2, ChevronUp, ChevronDown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { leadFormApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { LeadFormConfig, LeadFormField, LeadFieldType } from '@/lib/mock-api'

const TIPOS: Array<{ value: LeadFieldType; label: string; hint: string }> = [
  { value: 'TEXT',     label: 'Texto curto',      hint: 'Uma linha. Ex.: “Como nos conheceste?”' },
  { value: 'TEXTAREA', label: 'Texto longo',      hint: 'Várias linhas, para respostas abertas.' },
  { value: 'RADIO',    label: 'Escolha única',    hint: 'Opções à vista, escolhe uma. Ex.: “Motivo do contacto”.' },
  { value: 'CHECKBOX', label: 'Escolha múltipla', hint: 'Opções à vista, pode escolher várias.' },
  { value: 'SELECT',   label: 'Lista pendente',   hint: 'Como a escolha única, mas ocupa menos espaço. Bom acima de 6 opções.' },
]

// Campos que o formulário pede sempre e que não são configuráveis: são as
// colunas com que o CRM deduplica e contacta a lead. Se fossem removíveis, um
// estúdio podia ficar com leads sem forma nenhuma de contacto.
const FIXOS = [
  { label: 'Nome', opcional: false, porque: 'Identifica a lead no CRM.' },
  { label: 'Telemóvel', opcional: false, porque: 'Principal via de contacto e chave de deduplicação.' },
  { label: 'Email', opcional: true, porque: 'Alternativa ao telemóvel — pelo menos um dos dois é exigido.' },
]

const precisaOpcoes = (t: LeadFieldType) => t === 'RADIO' || t === 'CHECKBOX' || t === 'SELECT'
const novoId = () => 'novo-' + Math.random().toString(36).slice(2, 9)

const rotulo = 'text-[11px] font-medium text-gray-500 mb-1.5 block'
const dica = 'text-[11px] text-gray-400 mt-1.5 leading-snug'
const input = 'w-full rounded-lg border border-gray-200 px-3 min-h-[44px] text-sm outline-none focus:border-gray-900 bg-white'

export function LeadFormBuilder() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const { data, isLoading } = useQuery<LeadFormConfig>({ queryKey: ['lead-form'], queryFn: leadFormApi.get })

  const [headline, setHeadline] = useState('')
  const [subheadline, setSubheadline] = useState('')
  const [fields, setFields] = useState<LeadFormField[]>([])
  const [sujo, setSujo] = useState(false)

  // Só semeia enquanto não houver edições por gravar — senão um refetch em
  // segundo plano apagava o que o admin estava a escrever.
  useEffect(() => {
    if (data && !sujo) {
      setHeadline(data.headline ?? '')
      setSubheadline(data.subheadline ?? '')
      setFields(data.fields)
    }
  }, [data, sujo])

  const maxCampos = data?.maxFields ?? 6
  const atingiuLimite = fields.length >= maxCampos

  const guardar = useMutation({
    mutationFn: () => leadFormApi.update({ headline, subheadline, fields }),
    onSuccess: (fresh) => {
      qc.setQueryData(['lead-form'], fresh)
      setFields(fresh.fields)   // ids definitivos vêm do servidor
      setSujo(false)
      toast.success('Formulário guardado')
    },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível guardar'),
  })

  const enviarLogo = useMutation({
    mutationFn: (f: File) => leadFormApi.uploadLogo(f),
    onSuccess: (fresh) => { qc.setQueryData(['lead-form'], fresh); toast.success('Logo atualizado') },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível enviar o logo'),
  })

  const removerLogo = useMutation({
    mutationFn: () => leadFormApi.removeLogo(),
    onSuccess: (fresh) => { qc.setQueryData(['lead-form'], fresh); toast.success('Logo removido') },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível remover'),
  })

  function mexer(fn: (f: LeadFormField[]) => LeadFormField[]) {
    setSujo(true)
    setFields(fn)
  }
  const alterar = (i: number, patch: Partial<LeadFormField>) =>
    mexer(fs => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))

  const mover = (i: number, delta: number) => mexer(fs => {
    const j = i + delta
    if (j < 0 || j >= fs.length) return fs
    const copia = [...fs]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    return copia
  })

  if (isLoading || !data) {
    return <p className="text-sm text-gray-400 py-4">A carregar o formulário…</p>
  }

  return (
    <div className="space-y-6">
      {/* ── Logo ───────────────────────────────────────────────────────── */}
      <div>
        <label className={rotulo}>LOGO</label>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {data.logoUrl
              // eslint-disable-next-line @next/next/no-img-element -- origem dinâmica (S3 via proxy), sem loader do next/image
              ? <img src={data.logoUrl} alt="Logo do estúdio" className="w-full h-full object-contain" />
              : <span className="text-[10px] text-gray-400 text-center px-1">sem logo</span>}
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef} type="file" className="hidden"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) enviarLogo.mutate(f)
                e.target.value = ''   // permite reenviar o mesmo ficheiro
              }}
            />
            <Button variant="outline" className="min-h-[44px] gap-1.5" disabled={enviarLogo.isPending}
              onClick={() => fileRef.current?.click()}>
              {enviarLogo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {data.logoUrl ? 'Trocar' : 'Enviar'}
            </Button>
            {data.logoUrl && (
              <Button variant="outline" className="min-h-[44px]" disabled={removerLogo.isPending}
                onClick={() => removerLogo.mutate()}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <p className={dica}>PNG, JPG, WEBP ou SVG até 976KB. Aparece no topo da página pública.</p>
      </div>

      {/* ── Mensagem ───────────────────────────────────────────────────── */}
      <div className="border-t border-gray-50 pt-5 space-y-4">
        <div>
          <label className={rotulo}>TÍTULO</label>
          <input className={input} value={headline} maxLength={120}
            onChange={e => { setSujo(true); setHeadline(e.target.value) }}
            placeholder="Agenda a tua visita." />
        </div>
        <div>
          <label className={rotulo}>MENSAGEM</label>
          <textarea className={cn(input, 'py-2.5 min-h-[88px] resize-y')} value={subheadline} maxLength={400}
            onChange={e => { setSujo(true); setSubheadline(e.target.value) }}
            placeholder="Para solicitar o contacto da nossa equipa, preenche as informações abaixo." />
          <p className={dica}>{subheadline.length}/400</p>
        </div>
      </div>

      {/* ── Campos ─────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-50 pt-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <label className={cn(rotulo, 'mb-0')}>CAMPOS DO FORMULÁRIO</label>
          <span className="text-[11px] text-gray-400 tabular-nums">{fields.length}/{maxCampos}</span>
        </div>
        <p className={cn(dica, '!mt-0 mb-3')}>
          Esta é a ordem exata em que a lead vê o formulário.
        </p>

        {/* Os três campos fixos aparecem aqui, bloqueados. Antes só existia uma
            frase a dizer que existiam — e a primeira pergunta de quem abriu o
            ecrã foi "porque é que o nome/telefone/email não estão aqui?".
            Mostrá-los responde a isso sem ninguém ter de perguntar, e deixa
            claro que a lista abaixo continua o mesmo formulário. */}
        <div className="space-y-2 mb-3">
          {FIXOS.map(f => (
            <div key={f.label} className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3">
              <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {f.label}
                  {f.opcional && <span className="font-normal text-gray-400"> (opcional)</span>}
                </p>
                <p className="text-[11px] text-gray-400 leading-snug">{f.porque}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-gray-300 mt-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <input
                    className={input}
                    value={f.label} maxLength={120}
                    onChange={e => alterar(i, { label: e.target.value })}
                    placeholder="Pergunta. Ex.: Prefere ser contactado por"
                  />
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}
                    className="min-h-[44px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-30">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" aria-label="Descer" disabled={i === fields.length - 1} onClick={() => mover(i, 1)}
                    className="min-h-[44px] min-w-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-30">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button type="button" aria-label="Remover campo"
                    onClick={() => mexer(fs => fs.filter((_, j) => j !== i))}
                    className="min-h-[44px] min-w-[36px] flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pl-6">
                <CustomSelect<LeadFieldType>
                  size="lg"
                  className="w-full sm:w-56"
                  value={f.type}
                  onChange={t => alterar(i, {
                    type: t,
                    // Trocar para um tipo de escolha sem opções deixaria o campo
                    // inválido em silêncio; semeia-se logo com duas vazias.
                    options: precisaOpcoes(t) ? (f.options.length ? f.options : ['', '']) : [],
                  })}
                  options={TIPOS.map(t => ({ value: t.value, label: t.label }))}
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 min-h-[44px] cursor-pointer">
                  <input type="checkbox" checked={f.required}
                    onChange={e => alterar(i, { required: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300" />
                  Obrigatório
                </label>
              </div>
              <p className={cn(dica, 'pl-6 !mt-0')}>{TIPOS.find(t => t.value === f.type)?.hint}</p>

              {precisaOpcoes(f.type) && (
                <div className="pl-6 space-y-2">
                  <label className={rotulo}>OPÇÕES</label>
                  {f.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        className={input} value={o} maxLength={100}
                        onChange={e => alterar(i, { options: f.options.map((v, k) => (k === oi ? e.target.value : v)) })}
                        placeholder={`Opção ${oi + 1}`}
                      />
                      <button type="button" aria-label="Remover opção"
                        disabled={f.options.length <= 2}
                        onClick={() => alterar(i, { options: f.options.filter((_, k) => k !== oi) })}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 disabled:opacity-30">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {f.options.length < 12 && (
                    <button type="button"
                      onClick={() => alterar(i, { options: [...f.options, ''] })}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900 min-h-[44px] flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Adicionar opção
                    </button>
                  )}
                  <p className={dica}>Mínimo 2, máximo 12.</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          className="w-full min-h-[44px] mt-3 gap-1.5"
          disabled={atingiuLimite}
          onClick={() => mexer(fs => [...fs, {
            id: novoId(), label: '', type: 'TEXT', required: false, options: [], placeholder: null,
          }])}
        >
          <Plus className="w-4 h-4" />
          {atingiuLimite ? `Limite de ${maxCampos} campos atingido` : 'Adicionar campo'}
        </Button>
      </div>

      <div className="border-t border-gray-50 pt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-400">
          {sujo ? 'Tens alterações por guardar.' : 'Tudo guardado.'}
        </p>
        <Button className="min-h-[44px]" disabled={!sujo || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar formulário'}
        </Button>
      </div>
    </div>
  )
}
