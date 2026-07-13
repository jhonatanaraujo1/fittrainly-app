'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi, workoutApi } from '@/lib/api'
import { gerarProtocolos } from '@/lib/clinical-protocols'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ReportLayout, ReportHeader, ReportSection, ReportFooter } from '@/components/ui/report-layout'
import type { MockAluno, MockWorkoutPlan } from '@/lib/mock-db'

const MUSCLEGROUP_COLOR: Record<string, string> = {
  Peito: '#fee2e2', Costas: '#dbeafe', Pernas: '#d1fae5', Ombros: '#fef3c7',
  Bíceps: '#ede9fe', Tríceps: '#fce7f3', Core: '#f0fdf4', Cardio: '#e0f2fe',
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: pt }) } catch { return iso }
}

// 100% backend real: aluno via adminApi.alunoById, planos de treino via
// workoutApi.plans(alunoId) (/api/v1/workout-plans?studentId=). Sem mock.

export default function RelatorioTreinoPage({ params }: { params: Promise<{ alunoId: string }> }) {
  const { alunoId } = use(params)

  const alunoQ = useQuery({
    queryKey: ['aluno-detail', alunoId],
    queryFn: () => adminApi.alunoById(alunoId) as Promise<{ aluno: MockAluno }>,
  })
  const plansQ = useQuery({
    queryKey: ['workout-plans', alunoId],
    queryFn: () => workoutApi.plans(alunoId) as unknown as Promise<MockWorkoutPlan[]>,
  })

  if (alunoQ.isLoading || plansQ.isLoading) {
    return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">A carregar...</div>
  }

  const aluno = alunoQ.data?.aluno
  const plans = plansQ.data ?? []
  if (!aluno) return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Aluno não encontrado</div>

  if (!plans.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2 text-gray-400">
        <p className="text-sm font-semibold">Sem plano de treino registado</p>
        <p className="text-xs">Cria o plano no módulo de treinos antes de gerar o relatório</p>
      </div>
    )
  }

  const protocolos = gerarProtocolos({
    doencas: aluno.doencas,
    doencasOutras: aluno.doencasOutras,
    cirurgias: aluno.cirurgias,
    limitacoesFisicas: aluno.limitacoesFisicas,
  })

  return (
    <ReportLayout
      title={`Plano de Treino — ${aluno.name}`}
      subtitle={`${plans.length} treino${plans.length > 1 ? 's' : ''} · Actualizado em ${fmtDate(plans[0]?.updatedAt)}`}
    >
      <ReportHeader />

      {/* Report title */}
      <div className="mb-6">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.12em] mb-1">Plano de Treino Personalizado</p>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{aluno.name}</h1>
        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
          <span>PT: <strong className="text-gray-700">{aluno.personalTrainerName}</strong></span>
          {aluno.objetivo && <span>Objetivo: <strong className="text-gray-700">{aluno.objetivo}</strong></span>}
          {aluno.disponibilidadeSemanal && <span>Disponibilidade: <strong className="text-gray-700">{aluno.disponibilidadeSemanal}×/semana</strong></span>}
          {plans[0]?.validUntil && <span>Válido até: <strong className="text-gray-700">{fmtDate(plans[0].validUntil)}</strong></span>}
        </div>
      </div>

      {/* Clinical alert if applicable */}
      {protocolos.length > 0 && (
        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <span className="text-amber-600 text-sm mt-0.5">⚠</span>
          <div>
            <p className="text-xs font-bold text-amber-800 mb-1">Atenção — Condições de Saúde</p>
            <p className="text-[11px] text-amber-700">
              Este aluno tem protocolo clínico activo para: {protocolos.map(p => p.protocolo.condicao).join(', ')}.
              Os exercícios foram adaptados conforme as recomendações clínicas.
            </p>
          </div>
        </div>
      )}

      {/* Workout plans */}
      {plans.map((plan, idx) => (
        <ReportSection key={plan.id} title={`Treino ${plan.label} — ${plan.focus}`}>
          <div className="mb-2 text-[11px] text-gray-400">
            {plan.exercises.length} exercício{plan.exercises.length !== 1 ? 's' : ''}
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['#', 'Exercício', 'Grupo Muscular', 'Séries', 'Reps', 'Descanso', 'Notas'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[10px] font-black text-gray-500 uppercase tracking-wide border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.exercises.map((ex, i) => (
                <tr key={ex.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="py-2 px-2 text-gray-400 font-mono text-[10px]">{String(i + 1).padStart(2, '0')}</td>
                  <td className="py-2 px-2 font-semibold text-gray-900">{ex.name}</td>
                  <td className="py-2 px-2">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: MUSCLEGROUP_COLOR[ex.muscleGroup] ?? '#f3f4f6', color: '#374151' }}
                    >
                      {ex.muscleGroup}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center font-bold text-gray-900">{ex.sets}</td>
                  <td className="py-2 px-2 text-center text-gray-700">{ex.reps}</td>
                  <td className="py-2 px-2 text-center text-gray-500">{ex.rest}</td>
                  <td className="py-2 px-2 text-[11px] text-gray-400 italic">{ex.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {idx < plans.length - 1 && <div className="h-6" />}
        </ReportSection>
      ))}

      {/* Instructions section */}
      <ReportSection title="Instruções Gerais">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '💧', title: 'Hidratação', desc: 'Beber 500ml de água antes do treino. Manter hidratação durante.' },
            { icon: '🔥', title: 'Aquecimento', desc: '5–10 min de cardio leve + mobilidade articular antes de cada sessão.' },
            { icon: '🧊', title: 'Recuperação', desc: 'Alongamento 10 min após treino. Respeitar descanso entre sessões.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-base mb-1">{icon}</p>
              <p className="text-xs font-bold text-gray-800 mb-1">{title}</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </ReportSection>

      {/* Signature */}
      <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-2 gap-16">
        <div>
          <p className="text-[10px] text-gray-400 mb-8">Assinatura do/a Personal Trainer</p>
          <div className="border-b border-gray-400 mb-1" />
          <p className="text-[10px] text-gray-500">{aluno.personalTrainerName}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-8">Data</p>
          <div className="border-b border-gray-400 mb-1" />
          <p className="text-[10px] text-gray-500">
            {new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
      </div>

      <ReportFooter />
    </ReportLayout>
  )
}
