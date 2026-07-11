'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alunoApi } from '@/lib/api'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CheckCircle2, FileText, AlertTriangle, Printer } from 'lucide-react'
import { toast } from 'sonner'
import type { MockAluno } from '@/lib/mock-db'

const DOENCAS_LABELS: Record<string, string> = {
  HIPERTENSAO: 'Hipertensão', DIABETES: 'Diabetes', CARDIOPATIA: 'Cardiopatia',
  ARTRITE: 'Artrite', OSTEOPOROSE: 'Osteoporose', ASMA: 'Asma',
  COLUNA: 'Problema de coluna', OBESIDADE: 'Obesidade',
}

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null
  const display = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-40 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-800 font-medium">{display}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl led-gold p-5">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em] mb-3">{title}</p>
      {children}
    </div>
  )
}

export default function AlunoAnamnesePage() {
  const qc = useQueryClient()
  const [checked, setChecked] = useState(false)
  const [nomeConfirmado, setNomeConfirmado] = useState('')
  const [signed, setSigned] = useState(false)

  const { data: aluno, isLoading } = useQuery<MockAluno>({
    queryKey: ['aluno-me'],
    queryFn: () => alunoApi.me(),
  })

  useEffect(() => {
    if (aluno?.anamneseAssinadaEm) setSigned(true)
    if (aluno?.name) setNomeConfirmado(aluno.name)
  }, [aluno])

  const sign = useMutation({
    mutationFn: () => alunoApi.assinarAnamnese(nomeConfirmado),
    onSuccess: () => {
      setSigned(true)
      toast.success('Anamnese assinada com sucesso! ✅')
      qc.invalidateQueries({ queryKey: ['aluno-me'] })
    },
    onError: () => toast.error('Erro ao assinar anamnese'),
  })

  const nivelLabel: Record<string, string> = { SEDENTARIO: 'Sedentário', POUCO_ATIVO: 'Pouco ativo', ATIVO: 'Ativo', MUITO_ATIVO: 'Muito ativo' }
  const alcoolLabel: Record<string, string> = { NUNCA: 'Nunca', OCASIONAL: 'Ocasional', FREQUENTE: 'Frequente' }

  if (isLoading || !aluno) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  const hasAnamnese = (aluno.doencas?.length ?? 0) > 0 || aluno.cirurgias || aluno.medicamentos ||
    aluno.limitacoesFisicas || aluno.nivelAtividade || aluno.observacoesGerais

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Minha Anamnese</h1>
          <p className="text-sm text-gray-400 mt-0.5">Revê os teus dados de saúde e assina para confirmar</p>
        </div>
        {aluno.anamneseAssinadaEm && (
          <a
            href={`/relatorio/aluno/${aluno.id}`}
            target="_blank"
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Printer className="w-3.5 h-3.5" /> Descarregar PDF
          </a>
        )}
      </div>

      {/* Signed badge */}
      {aluno.anamneseAssinadaEm && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Anamnese assinada digitalmente</p>
            <p className="text-xs text-emerald-600">
              Por <strong>{aluno.anamneseAssinadaNome}</strong> em{' '}
              {format(parseISO(aluno.anamneseAssinadaEm), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}
            </p>
          </div>
        </div>
      )}

      {!hasAnamnese && !aluno.anamneseAssinadaEm && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Anamnese ainda não preenchida</p>
            <p className="text-xs text-amber-600">O teu Personal Trainer ainda não preencheu a tua ficha de saúde.</p>
          </div>
        </div>
      )}

      {/* Personal data */}
      <Section title="Dados Pessoais">
        <Row label="Nome completo" value={aluno.name} />
        <Row label="Email" value={aluno.email} />
        <Row label="Género" value={aluno.genero === 'MASCULINO' ? 'Masculino' : aluno.genero === 'FEMININO' ? 'Feminino' : aluno.genero === 'OUTRO' ? 'Outro' : undefined} />
        <Row label="Profissão" value={aluno.profissao} />
        <Row label="Objetivo" value={aluno.objetivo} />
        <Row label="Prazo" value={aluno.prazoObjetivo} />
        <Row label="Disponibilidade" value={aluno.disponibilidadeSemanal ? `${aluno.disponibilidadeSemanal} treinos/semana` : undefined} />
        <Row label="PT Responsável" value={aluno.personalTrainerName} />
      </Section>

      {/* Health */}
      <Section title="Saúde e Historial Médico">
        {(aluno.doencas?.length ?? 0) > 0 && (
          <div className="py-2 border-b border-gray-50">
            <p className="text-xs text-gray-400 mb-2">Doenças / Condições</p>
            <div className="flex flex-wrap gap-1.5">
              {aluno.doencas!.map(d => (
                <span key={d} className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                  {DOENCAS_LABELS[d] ?? d}
                </span>
              ))}
            </div>
            {aluno.doencasOutras && <p className="text-xs text-gray-500 mt-1.5">{aluno.doencasOutras}</p>}
          </div>
        )}
        <Row label="Cirurgias / Lesões" value={aluno.cirurgias} />
        <Row label="Medicamentos" value={aluno.medicamentos} />
        <Row label="Limitações físicas" value={aluno.limitacoesFisicas} />
        <Row label="Fumante" value={aluno.fumante} />
        <Row label="Álcool" value={aluno.alcool ? alcoolLabel[aluno.alcool] : undefined} />
      </Section>

      {/* Activity */}
      <Section title="Historial de Actividade">
        <Row label="Nível de actividade" value={aluno.nivelAtividade ? nivelLabel[aluno.nivelAtividade] : undefined} />
        <Row label="Praticou antes" value={aluno.praticouAtividade} />
        <Row label="Actividade anterior" value={aluno.atividadeAnterior} />
        <Row label="Tempo sem actividade" value={aluno.tempoSemAtividade} />
        <Row label="Horas de sono" value={aluno.horasSono ? `${aluno.horasSono}h/noite` : undefined} />
        <Row label="Nível de stresse" value={aluno.nivelEstresse} />
        <Row label="Observações gerais" value={aluno.observacoesGerais} />
      </Section>

      {/* Signature block */}
      {!aluno.anamneseAssinadaEm && hasAnamnese && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-5 space-y-4">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">Declaração de Consentimento</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ao assinar, confirmo que os dados acima são verídicos e completos. Autorizo o uso destas informações
                para a elaboração do meu programa de treino personalizado e isento o estúdio e o Personal Trainer
                de responsabilidade por omissão de informações relevantes para a minha saúde.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Nome completo para assinatura
            </label>
            <input
              type="text"
              value={nomeConfirmado}
              onChange={e => setNomeConfirmado(e.target.value)}
              placeholder="Escreve o teu nome completo"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 mt-0.5 accent-gray-900"
            />
            <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">
              Li e confirmo que todos os dados acima são verdadeiros e completos. Compreendo e aceito os termos acima.
            </span>
          </label>

          <button
            disabled={!checked || !nomeConfirmado.trim() || sign.isPending}
            onClick={() => sign.mutate()}
            className="w-full h-11 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: checked && nomeConfirmado.trim() ? '#111111' : '#9ca3af',
              color: 'white',
            }}
          >
            {sign.isPending ? 'A assinar...' : 'Assinar Anamnese'}
          </button>
        </div>
      )}

      {/* Post-sign actions */}
      {signed && (
        <div className="flex gap-3">
          <a
            href={`/relatorio/aluno/${aluno.id}`}
            target="_blank"
            className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Descarregar Ficha PDF
          </a>
        </div>
      )}
    </div>
  )
}
