import Link from 'next/link'
import { Dumbbell, CalendarCheck, Users, Receipt, ChevronRight, CheckCircle2, BarChart3, Clock } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#111111' }}>
            <Dumbbell className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-gray-900">fitTrainly</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5">
            Entrar
          </Link>
          <Link href="/login"
            className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors"
            style={{ background: '#111111' }}>
            Começar grátis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-12 pt-20 pb-16 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border mb-6"
          style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Novo — Gestão completa para estúdios boutique
        </div>

        <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-tight mb-6">
          O sistema que o seu<br />
          <span style={{ color: '#C9A84C' }}>estúdio merecia.</span>
        </h1>

        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Gestão de personal trainers, agendamento de alunos e faturação automática — tudo numa plataforma pensada para estúdios boutique de personal training.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/login"
            className="flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all hover:opacity-90"
            style={{ background: '#111111' }}>
            Ver demonstração <ChevronRight className="w-4 h-4" />
          </Link>
          <Link href="/login"
            className="text-sm font-medium text-gray-600 px-6 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            Entrar na plataforma
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-4">Sem cartão de crédito · Acesso imediato</p>
      </section>

      {/* Stats strip */}
      <section className="border-y border-gray-100 bg-gray-50 py-10">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '+40h', label: 'poupadas por mês em gestão' },
            { value: '100%', label: 'de visibilidade nos PTs e alunos' },
            { value: '0€', label: 'para começar — sem mensalidade inicial' },
          ].map(s => (
            <div key={s.value}>
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-12 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Funcionalidades</p>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Tudo o que o seu estúdio precisa</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon: Users,
              title: 'Gestão de Personal Trainers',
              desc: 'Registe os seus PTs, atribua planos de aluguer por hora, semana ou mês e acompanhe a atividade de cada um em tempo real.',
              color: '#2563eb',
              bg: '#eff6ff',
            },
            {
              icon: CalendarCheck,
              title: 'Agendamento inteligente',
              desc: 'O PT define a disponibilidade, o aluno confirma a presença. Sem chamadas, sem confusão — tudo numa vista semanal clara.',
              color: '#059669',
              bg: '#f0fdf4',
            },
            {
              icon: Receipt,
              title: 'Faturação automática',
              desc: 'O sistema calcula automaticamente o valor a cobrar a cada PT com base no plano e nas horas registadas. Zero cálculos manuais.',
              color: '#d97706',
              bg: '#fffbeb',
            },
            {
              icon: BarChart3,
              title: 'Dashboard de negócio',
              desc: 'Veja a ocupação do estúdio, receita estimada do mês e performance de cada PT — tudo no ecrã principal ao abrir a app.',
              color: '#7c3aed',
              bg: '#f5f3ff',
            },
            {
              icon: Dumbbell,
              title: 'Planos de treino',
              desc: 'O PT monta o plano de treino do aluno diretamente na plataforma. O aluno acede, vê os exercícios e marca o progresso.',
              color: '#dc2626',
              bg: '#fef2f2',
            },
            {
              icon: Clock,
              title: 'Histórico e presença',
              desc: 'Registo completo de sessões realizadas, faltas e cancelamentos. O aluno confirma a presença, o PT tem controlo total.',
              color: '#0891b2',
              bg: '#ecfeff',
            },
          ].map(f => (
            <div key={f.title} className="flex gap-4 p-5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: f.bg }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{f.title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* For who */}
      <section className="px-6 lg:px-12 py-16 max-w-5xl mx-auto">
        <div className="rounded-2xl p-8 lg:p-12" style={{ background: '#111111' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#C9A84C' }}>Para quem é</p>
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-8 max-w-lg">
            Feito para donos de estúdio boutique que querem crescer com controlo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Tens PTs independentes a trabalhar no teu espaço',
              'Cobras por hora, semana ou mensalidade',
              'Perdes tempo a gerir horários por WhatsApp',
              'Não tens visibilidade de quem fez o quê',
              'Queres crescer sem contratar administrativos',
              'Precisas de faturação organizada no fim do mês',
            ].map(item => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#C9A84C' }} />
                <p className="text-sm text-white/75">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 lg:px-12 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-4">
          Pronto para experimentar?
        </h2>
        <p className="text-gray-500 mb-8 max-w-md mx-auto text-sm leading-relaxed">
          Veja a plataforma a funcionar com dados reais de um estúdio boutique. Sem formulários, acesso imediato.
        </p>
        <Link href="/login"
          className="inline-flex items-center gap-2 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-all hover:opacity-90"
          style={{ background: '#111111' }}>
          Ver a demonstração <ChevronRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 lg:px-12 py-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#111111' }}>
            <Dumbbell className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-700">fitTrainly</span>
        </div>
        <p className="text-xs text-gray-400">Almada, Portugal · 2026</p>
        <Link href="/login" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          Entrar na plataforma →
        </Link>
      </footer>

    </main>
  )
}
