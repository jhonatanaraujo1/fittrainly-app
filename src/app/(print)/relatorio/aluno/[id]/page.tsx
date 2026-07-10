'use client'

import { use, useEffect, useState } from 'react'
import { db } from '@/lib/mock-db'
import { gerarProtocolos, SEVERIDADE_CONFIG } from '@/lib/clinical-protocols'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  ReportLayout, ReportHeader, ReportSection, ReportRow, ReportFooter,
} from '@/components/ui/report-layout'
import type { MockAluno, MockBooking, MockPack, MockAvaliacao } from '@/lib/mock-db'

const DOENCAS_LABELS: Record<string, string> = {
  HIPERTENSAO: 'Hipertensão', DIABETES: 'Diabetes', CARDIOPATIA: 'Cardiopatia',
  ARTRITE: 'Artrite', OSTEOPOROSE: 'Osteoporose', ASMA: 'Asma',
  COLUNA: 'Problema de coluna', OBESIDADE: 'Obesidade',
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: pt }) } catch { return iso }
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—'
  try { return format(parseISO(iso), "d MMM yyyy 'às' HH:mm", { locale: pt }) } catch { return iso }
}

interface PageData {
  aluno: MockAluno
  bookings: MockBooking[]
  packs: MockPack[]
  avaliacoes: MockAvaliacao[]
}

export default function RelatorioAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<PageData | null>(null)

  useEffect(() => {
    const aluno = db.alunos.find(a => a.id === id)
    if (!aluno) return
    const bookings = db.bookings.filter(b => b.alunoId === id).sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    ).slice(0, 12)
    const packs = db.packs.filter(p => p.alunoId === id)
    const avaliacoes = db.avaliacoes?.filter(av => av.alunoId === id) ?? []
    setData({ aluno, bookings, packs, avaliacoes })
  }, [id])

  if (!data) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">A carregar...</div>

  const { aluno, bookings, packs } = data
  const activePack = packs.find(p => p.status === 'ACTIVE')
  const protocolos = gerarProtocolos({
    doencas: aluno.doencas,
    doencasOutras: aluno.doencasOutras,
    cirurgias: aluno.cirurgias,
    limitacoesFisicas: aluno.limitacoesFisicas,
  })

  const generoLabel = aluno.genero === 'MASCULINO' ? 'Masculino' : aluno.genero === 'FEMININO' ? 'Feminino' : aluno.genero === 'OUTRO' ? 'Outro' : undefined
  const nivelLabel: Record<string, string> = { SEDENTARIO: 'Sedentário', POUCO_ATIVO: 'Pouco ativo', ATIVO: 'Ativo', MUITO_ATIVO: 'Muito ativo' }
  const alcoolLabel: Record<string, string> = { NUNCA: 'Nunca', OCASIONAL: 'Ocasional', FREQUENTE: 'Frequente' }
  const statusLabel: Record<string, string> = { CONFIRMED: 'Confirmada', COMPLETED: 'Realizada', CANCELLED: 'Cancelada' }

  return (
    <ReportLayout title={`Ficha Completa — ${aluno.name}`} subtitle="Relatório gerado pelo Fit Studio Now">
      <ReportHeader />

      {/* Report title */}
      <div className="mb-6">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-1">Ficha Completa do Aluno</p>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{aluno.name}</h1>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            aluno.status === 'ATIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            aluno.status === 'SUSPENSO' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-gray-100 text-gray-500 border-gray-200'
          }`}>{aluno.status}</span>
          <span className="text-xs text-gray-400">PT: <strong className="text-gray-700">{aluno.personalTrainerName}</strong></span>
          <span className="text-xs text-gray-400">Inscrito em {fmtDate(aluno.inscricaoDate)}</span>
          {aluno.anamneseAssinadaEm && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              ✓ Anamnese assinada
            </span>
          )}
        </div>
      </div>

      {/* 1. Dados Pessoais */}
      <ReportSection title="1. Dados Pessoais">
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <ReportRow label="Nome completo" value={aluno.name} />
            <ReportRow label="Email" value={aluno.email} />
            <ReportRow label="Telefone" value={aluno.phone} />
            <ReportRow label="Data de nascimento" value={aluno.dataNascimento ? fmtDate(aluno.dataNascimento) : undefined} />
            <ReportRow label="Género" value={generoLabel} />
          </div>
          <div>
            <ReportRow label="Profissão" value={aluno.profissao} />
            <ReportRow label="Objetivo" value={aluno.objetivo} />
            <ReportRow label="Prazo do objetivo" value={aluno.prazoObjetivo} />
            <ReportRow label="Disponibilidade" value={aluno.disponibilidadeSemanal ? `${aluno.disponibilidadeSemanal} treinos/semana` : undefined} />
            <ReportRow label="PT Responsável" value={aluno.personalTrainerName} />
          </div>
        </div>
      </ReportSection>

      {/* 2. Anamnese de Saúde */}
      <ReportSection title="2. Anamnese de Saúde">
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <ReportRow label="Fumante" value={aluno.fumante === true ? 'Sim' : aluno.fumante === false ? 'Não' : undefined} />
            <ReportRow label="Consumo de álcool" value={aluno.alcool ? alcoolLabel[aluno.alcool] : undefined} />
            <ReportRow label="Horas de sono" value={aluno.horasSono ? `${aluno.horasSono}h/noite` : undefined} />
            <ReportRow label="Nível de stresse" value={aluno.nivelEstresse} />
            <ReportRow label="Nível de actividade" value={aluno.nivelAtividade ? nivelLabel[aluno.nivelAtividade] : undefined} />
            <ReportRow label="Praticou antes" value={aluno.praticouAtividade === true ? 'Sim' : aluno.praticouAtividade === false ? 'Não' : undefined} />
            <ReportRow label="Actividade anterior" value={aluno.atividadeAnterior} />
            <ReportRow label="Tempo sem actividade" value={aluno.tempoSemAtividade} />
          </div>
          <div>
            {(aluno.doencas?.length ?? 0) > 0 && (
              <div className="py-1.5 border-b border-gray-50">
                <p className="text-xs text-gray-400 mb-1.5">Doenças / Condições</p>
                <div className="flex flex-wrap gap-1">
                  {aluno.doencas!.map(d => (
                    <span key={d} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                      {DOENCAS_LABELS[d] ?? d}
                    </span>
                  ))}
                </div>
                {aluno.doencasOutras && <p className="text-[11px] text-gray-500 mt-1">{aluno.doencasOutras}</p>}
              </div>
            )}
            <ReportRow label="Cirurgias / Lesões" value={aluno.cirurgias} />
            <ReportRow label="Medicamentos" value={aluno.medicamentos} />
            <ReportRow label="Limitações físicas" value={aluno.limitacoesFisicas} />
            <ReportRow label="Observações gerais" value={aluno.observacoesGerais} />
          </div>
        </div>
      </ReportSection>

      {/* 3. Protocolo Clínico */}
      {protocolos.length > 0 && (
        <ReportSection title="3. Protocolo Clínico">
          <div className="space-y-3">
            {protocolos.map(({ protocolo }) => {
              const cfg = SEVERIDADE_CONFIG[protocolo.severidade]
              return (
                <div key={protocolo.id} className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-900">{protocolo.condicao}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">✓ Recomendados</p>
                      {protocolo.recomendados.slice(0, 4).map((ex, i) => (
                        <p key={i} className="text-[11px] text-gray-700">· {ex.nome}{ex.parametros ? ` (${ex.parametros})` : ''}</p>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-red-700 uppercase mb-1">✗ Evitar</p>
                      {protocolo.evitar.slice(0, 4).map((ev, i) => (
                        <p key={i} className="text-[11px] text-gray-700">· {ev}</p>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 italic">⚠ {protocolo.observacoes}</p>
                </div>
              )
            })}
          </div>
        </ReportSection>
      )}

      {/* 4. Pack Actual */}
      {activePack && (
        <ReportSection title="4. Pack Actual">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Sessões restantes', value: `${activePack.total - activePack.used}` },
              { label: 'Total do pack', value: `${activePack.total} sessões` },
              { label: 'Duração por sessão', value: `${activePack.sessionDuration} min` },
              { label: 'Validade', value: activePack.expiresAt ? fmtDate(activePack.expiresAt) : 'Sem prazo' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                <p className="text-xl font-black text-gray-900">{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      {/* 5. Historial de Sessões */}
      {bookings.length > 0 && (
        <ReportSection title={`5. Historial de Sessões (últimas ${bookings.length})`}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                {['Data', 'Hora', 'PT', 'Estado'].map(h => (
                  <th key={h} className="text-left py-1.5 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 text-gray-700">{format(parseISO(b.startTime), 'd MMM yyyy', { locale: pt })}</td>
                  <td className="py-1.5 px-2 text-gray-700">{format(parseISO(b.startTime), 'HH:mm')}</td>
                  <td className="py-1.5 px-2 text-gray-500">{b.personalTrainerName}</td>
                  <td className="py-1.5 px-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      b.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                      b.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{statusLabel[b.status] ?? b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      )}

      {/* 6. Declaração e Assinatura */}
      <ReportSection title="6. Declaração e Consentimento">
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <p className="text-xs text-gray-600 leading-relaxed mb-4">
            O/A aluno(a) <strong>{aluno.anamneseAssinadaNome ?? aluno.name}</strong> declara que os dados fornecidos na presente anamnese são verídicos e completos,
            autoriza o uso das informações para a elaboração do programa de treino personalizado e isenta o estúdio e o Personal Trainer
            de responsabilidade por omissão de informações relevantes para a saúde.
          </p>

          {aluno.anamneseAssinadaEm ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 text-sm font-black">✓</span>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-800">Anamnese assinada digitalmente</p>
                <p className="text-[11px] text-emerald-700">
                  Por <strong>{aluno.anamneseAssinadaNome}</strong> em {fmtDateTime(aluno.anamneseAssinadaEm)}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-8 mt-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-6">Assinatura do/a Aluno(a)</p>
                <div className="border-b border-gray-400 mb-1" />
                <p className="text-[10px] text-gray-400">{aluno.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-6">Data</p>
                <div className="border-b border-gray-400 mb-1" />
                <p className="text-[10px] text-gray-400">___/___/______</p>
              </div>
            </div>
          )}
        </div>
      </ReportSection>

      <ReportFooter />
    </ReportLayout>
  )
}
