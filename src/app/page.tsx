'use client'

import React, { useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import {
  Dumbbell, Calendar, Users, BarChart3, Shield, Zap,
  ArrowRight, Check, TrendingUp, Euro, Clock, ChevronRight,
} from 'lucide-react'

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]

/* ─── dashboard mockup ─────────────────────────────────────────────── */
function DashboardMockup() {
  const bars = [0.85, 0.62, 0.90, 0.45, 0.78, 0.30, 0]
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

  return (
    <div className="relative w-full">
      {/* glow behind */}
      <div className="absolute -inset-8 rounded-3xl opacity-40 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.35) 0%, transparent 65%)' }} />

      {/* browser chrome */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.5, ease }}
        className="relative rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* titlebar */}
        <div className="flex items-center gap-2 px-4 py-3"
          style={{ background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex gap-1.5">
            {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
              <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="flex-1 flex justify-center">
            <div className="h-6 rounded-md flex items-center px-4 text-[10px] font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', width: 180 }}>
              fitstudionow.com/admin
            </div>
          </div>
        </div>

        {/* app */}
        <div className="flex" style={{ background: '#F1F5F9', minHeight: 360 }}>

          {/* sidebar */}
          <div className="w-12 flex flex-col items-center py-4 gap-3 flex-shrink-0"
            style={{ background: '#111111' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1"
              style={{ background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.25)' }}>
              <Dumbbell className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
            </div>
            {[BarChart3, Calendar, Users, Euro, Shield].map((Icon, i) => (
              <div key={i} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: i === 0 ? 'rgba(201,168,76,0.15)' : 'transparent' }}>
                <Icon className="w-4 h-4" style={{ color: i === 0 ? '#C9A84C' : 'rgba(255,255,255,0.2)' }} />
              </div>
            ))}
          </div>

          {/* main */}
          <div className="flex-1 p-4 space-y-3 overflow-hidden">

            {/* topbar */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold" style={{ color: '#94a3b8' }}>QUINTA-FEIRA · 26 JUN 2026</p>
                <p className="text-[13px] font-black tracking-tight" style={{ color: '#0f172a' }}>Bem-vindo, Maicon 👋</p>
              </div>
              <div className="text-[9px] font-black tracking-widest px-2 py-1 rounded-full"
                style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.2)' }}>
                ● 3 LEADS NOVAS
              </div>
            </div>

            {/* stat cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { l: 'Personais', v: '3', icon: Users, c: '#3b82f6' },
                { l: 'Alunos', v: '12', icon: Users, c: '#10b981' },
                { l: 'Leads Novas', v: '3', icon: TrendingUp, c: '#f59e0b' },
                { l: 'Receita', v: '€640', icon: Euro, c: '#8b5cf6' },
              ].map((s, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.08, duration: 0.4 }}
                  className="rounded-xl p-2.5" style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <p className="text-[8px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94a3b8' }}>{s.l}</p>
                  <p className="text-[15px] font-black leading-none mb-1.5" style={{ color: '#0f172a' }}>{s.v}</p>
                  <div className="w-5 h-5 rounded-lg flex items-center justify-center"
                    style={{ background: s.c + '18' }}>
                    <s.icon className="w-2.5 h-2.5" style={{ color: s.c }} />
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2">
              {/* chart */}
              <div className="col-span-3 rounded-xl p-3" style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p className="text-[8px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#94a3b8' }}>Ocupação por Dia</p>
                <div className="flex items-end gap-1" style={{ height: 56 }}>
                  {bars.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.9 + i * 0.07, duration: 0.45, ease }}
                        className="w-full rounded-t-sm origin-bottom"
                        style={{
                          height: `${h * 100}%`,
                          background: h > 0.75 ? '#C9A84C' : h > 0 ? '#1e293b' : '#f1f5f9',
                          minHeight: h > 0 ? 3 : 0,
                        }} />
                      <span className="text-[7px]" style={{ color: '#cbd5e1' }}>{days[i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* insight */}
              <div className="col-span-2 rounded-xl p-3 flex flex-col justify-between"
                style={{ background: '#111111' }}>
                <p className="text-[8px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Insight</p>
                <p className="text-[10px] font-bold leading-snug" style={{ color: '#fff' }}>
                  Ocupação da semana em <span style={{ color: '#C9A84C' }}>85%</span> da capacidade do estúdio
                </p>
                <p className="text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>⚠️ 1 personal com pagamento atrasado</p>
              </div>
            </div>

            {/* PT rows */}
            <div className="rounded-xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {[
                { name: 'João Silva', spec: 'Musculação e Força', plan: 'Mensal', n: 4, s: 18 },
                { name: 'Ana Costa', spec: 'Funcional e Mobilidade', plan: 'Por Hora', n: 2, s: 9 },
                { name: 'Pedro Santos', spec: 'Emagrecimento', plan: 'Semanal', n: 2, s: 6 },
              ].map((pt, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.0 + i * 0.08, duration: 0.4 }}
                  className="flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0"
                  style={{ borderColor: '#f8fafc' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 text-white"
                    style={{ background: ['#111111', '#3b82f6', '#10b981'][i] }}>
                    {pt.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold truncate" style={{ color: '#0f172a' }}>{pt.name}</p>
                    <p className="text-[8px] truncate" style={{ color: '#94a3b8' }}>{pt.spec}</p>
                  </div>
                  <div className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: '#f0fdf4', color: '#16a34a' }}>
                    {pt.s} sess
                  </div>
                  <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: '#cbd5e1' }} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ─── ticker ─────────────────────────────────────────────────────────── */
function Ticker() {
  const items = [
    '⚡ GESTÃO DE PERSONAIS', '✦ AGENDA SEM CONFLITO', '⚡ FATURAMENTO AUTOMÁTICO',
    '✦ CRM DE LEADS', '⚡ CONTROLE DE INADIMPLÊNCIA', '✦ AVALIAÇÕES FÍSICAS',
    '⚡ PACOTES DE SESSÕES', '✦ LGPD & RGPD', '⚡ FEITO EM PORTUGAL',
  ]
  return (
    <div className="overflow-hidden" style={{ background: '#C9A84C', borderTop: '1px solid rgba(0,0,0,0.08)', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
      <motion.div className="flex whitespace-nowrap py-3"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} className="text-[11px] font-black tracking-[0.2em] uppercase px-6 text-black flex-shrink-0">{t}</span>
        ))}
      </motion.div>
    </div>
  )
}

/* ─── feature card ────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, tag, title, desc, delay }: {
  icon: React.ElementType; tag: string; title: string; desc: string; delay: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease }}
      className="group relative p-7 cursor-default overflow-hidden transition-colors duration-300"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#161616')}
      onMouseLeave={e => (e.currentTarget.style.background = '#111111')}>
      <div className="absolute left-0 top-6 bottom-6 w-0.5 rounded-full scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-300"
        style={{ background: '#C9A84C' }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 20% 10%, rgba(201,168,76,0.06) 0%, transparent 60%)' }} />
      <p className="text-[10px] font-black tracking-[0.22em] uppercase mb-4 relative z-10" style={{ color: '#C9A84C' }}>{tag}</p>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 relative z-10"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Icon className="w-4.5 h-4.5" style={{ color: '#fff' }} />
      </div>
      <h3 className="font-black text-base mb-2 tracking-tight relative z-10" style={{ color: '#fff' }}>{title}</h3>
      <p className="text-[13px] leading-relaxed relative z-10" style={{ color: 'rgba(255,255,255,0.35)' }}>{desc}</p>
    </motion.div>
  )
}

/* ─── page ───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const features = [
    { icon: Euro, tag: 'FINANCEIRO', title: 'Controle de inadimplência',
      desc: 'Cada personal tem plano e dia de vencimento definidos. O painel mostra quem está em dia e quem está atrasado, com o valor exato e há quantos dias.' },
    { icon: TrendingUp, tag: 'CAPTAÇÃO', title: 'Página de leads com CRM',
      desc: 'Uma página pública com a marca do estúdio recebe os contatos. Cada lead entra no funil com as respostas que deu e avança por etapas até virar aluno.' },
    { icon: BarChart3, tag: 'ALUGUEL', title: 'Faturamento por uso real',
      desc: 'Por hora, por semana ou por mês. O sistema soma as horas efetivamente utilizadas e calcula o valor devido por cada personal no fechamento.' },
    { icon: Calendar, tag: 'AGENDA', title: 'Grade sem conflitos',
      desc: 'O estúdio define os horários disponíveis e cada personal libera os seus dentro dessa grade. O limite de alunos por sessão é aplicado pelo próprio sistema.' },
    { icon: Clock, tag: 'ALUNOS', title: 'Ficha completa e evolução',
      desc: 'Avaliação física com IMC e percentual de gordura, histórico de progresso, pacotes de sessões e o plano de treino que o aluno acessa pelo celular.' },
    { icon: Shield, tag: 'CONFORMIDADE', title: 'Documentos e validades',
      desc: 'Registro profissional e seguro de cada personal com data de vencimento e aviso antecipado, para o estúdio nunca operar com documentação vencida.' },
  ]

  return (
    <div className="min-h-screen w-full" style={{ fontFamily: 'var(--font-geist-sans)', background: '#0d0d0d', color: '#fff' }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50"
        style={{ background: 'rgba(13,13,13,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.25)' }}>
              <Dumbbell className="w-4 h-4" style={{ color: '#C9A84C' }} />
            </div>
            <span className="font-black text-[15px] tracking-tight text-white">Fit Studio Now</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {[['#features', 'O que resolve'], ['#how', 'Como funciona'], ['#demo', 'Começar']].map(([href, label]) => (
              <a key={href} href={href}
                className="text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors duration-200"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                {label}
              </a>
            ))}
          </nav>

          <Link href="/login"
            className="flex items-center gap-2 h-9 px-5 rounded-lg font-black text-[11px] tracking-[0.12em] uppercase transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#C9A84C', color: '#111111' }}>
            Entrar <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative w-full pt-16 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d0d0d 0%, #111111 50%, #0d0d0d 100%)', minHeight: '100svh' }}>

        {/* grid texture */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)',
          backgroundSize: '72px 72px',
        }} />

        {/* gold radial */}
        <div className="absolute pointer-events-none"
          style={{ top: '10%', right: '-10%', width: 700, height: 700, background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%)', borderRadius: '50%' }} />
        <div className="absolute pointer-events-none"
          style={{ bottom: '0%', left: '-5%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 65%)', borderRadius: '50%' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* LEFT — copy */}
            <div>
              {/* badge */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.07)' }}>
                <motion.span
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: '#C9A84C' }} />
                <span className="text-[11px] font-black tracking-[0.18em] uppercase" style={{ color: '#C9A84C' }}>
                  Plataforma de gestão para estúdios boutique
                </span>
              </motion.div>

              {/* headline */}
              <motion.h1
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.2, ease }}
                className="font-black leading-[0.9] tracking-tighter mb-6"
                style={{ fontSize: 'clamp(2.8rem, 6vw, 5.5rem)', color: '#fff' }}>
                A gestão<br />
                completa do<br />
                <span style={{ color: '#C9A84C', textShadow: '0 0 60px rgba(201,168,76,0.2)' }}>
                  seu estúdio.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4, ease }}
                className="text-lg leading-relaxed mb-8 max-w-md"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Leads, agenda, fichas de aluno, avaliações físicas e o aluguel de cada personal
                em um único sistema. Feito para estúdios que alugam espaço a profissionais
                autônomos — não para academias com funcionários.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55, ease }}
                className="flex flex-wrap gap-3 mb-10">
                <Link href="/login"
                  className="group flex items-center gap-2.5 px-7 font-black text-[12px] tracking-[0.15em] uppercase rounded-xl transition-all hover:scale-105 active:scale-95 hover:shadow-[0_0_40px_rgba(201,168,76,0.3)]"
                  style={{ height: 52, background: '#C9A84C', color: '#111111' }}>
                  Entrar na plataforma
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a href="#how"
                  className="flex items-center gap-2 px-7 font-semibold text-sm rounded-xl transition-all hover:bg-white/[0.06]"
                  style={{ height: 52, color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Como funciona
                </a>
              </motion.div>

              {/* mini proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="flex flex-wrap items-center gap-6">
                {[
                  { icon: Check, text: 'Feito para o modelo de aluguel' },
                  { icon: Check, text: 'LGPD & RGPD Compliant' },
                  { icon: Check, text: 'Suporte em português' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(201,168,76,0.15)' }}>
                      <Icon className="w-2.5 h-2.5" style={{ color: '#C9A84C' }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>{text}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* RIGHT — dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.85, delay: 0.35, ease }}
              className="hidden lg:block">
              <DashboardMockup />
            </motion.div>

            {/* mobile: mini mockup preview */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6, ease }}
              className="lg:hidden rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="p-4 space-y-3" style={{ background: '#161616' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black" style={{ color: '#fff' }}>Bem-vindo, Maicon 👋</p>
                  <div className="text-[9px] px-2 py-1 rounded-full font-black"
                    style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>● 3 LEADS</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: 'Personais', v: '3', c: '#3b82f6' },
                    { l: 'Alunos', v: '12', c: '#10b981' },
                    { l: 'Leads Novas', v: '3', c: '#f59e0b' },
                    { l: 'Receita', v: '€640', c: '#8b5cf6' },
                  ].map(s => (
                    <div key={s.l} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.l}</p>
                      <p className="text-base font-black" style={{ color: s.c }}>{s.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TICKER ─────────────────────────────────────────────────────── */}
      <Ticker />

      {/* ── SOCIAL PROOF ───────────────────────────────────────────────── */}
      <section className="w-full py-12" style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-[11px] font-semibold tracking-[0.15em] uppercase mb-8"
            style={{ color: 'rgba(255,255,255,0.2)' }}>
            O que o painel responde no momento em que você abre
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {[
              { q: 'Quem está em atraso', a: 'Valor devido e há quantos dias, por personal' },
              { q: 'Quem procurou o estúdio', a: 'Cada lead com data, origem e o que respondeu' },
              { q: 'O que vence em breve', a: 'Registros e seguros com aviso antes do prazo' },
            ].map(m => (
              <div key={m.q} className="py-8 px-6 text-center" style={{ background: '#111111' }}>
                <p className="font-black mb-2 tracking-tighter" style={{ fontSize: 'clamp(1.4rem, 3vw, 2.1rem)', color: '#C9A84C' }}>
                  {m.q}
                </p>
                <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {m.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <section id="features" className="w-full py-24" style={{ background: '#0d0d0d' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-14">
            <p className="text-[11px] font-black tracking-[0.22em] uppercase mb-4" style={{ color: '#C9A84C' }}>
              Funcionalidades
            </p>
            <h2 className="font-black tracking-tighter" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', color: '#fff' }}>
              Seis áreas do estúdio.<br />
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>Um único sistema.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <section id="how" className="w-full py-24" style={{ background: '#111111', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-black tracking-[0.22em] uppercase mb-4" style={{ color: '#C9A84C' }}>
            Como funciona
          </p>
          <h2 className="font-black tracking-tighter mb-16" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', color: '#fff' }}>
            Do primeiro contato<br /><span style={{ color: 'rgba(255,255,255,0.2)' }}>ao fechamento do mês.</span>
          </h2>

          <div className="space-y-px" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {[
              { n: '01', title: 'O contato chega e entra no funil', desc: 'A página de captação fica no link da bio e nos anúncios. Quem preenche vira uma lead com nome, contato e as respostas que deu — e o estúdio recebe o aviso.' },
              { n: '02', title: 'A lead vira aluno com ficha aberta', desc: 'A conversão define o personal responsável e já abre a ficha: avaliação física, pacote de sessões e plano de treino, sem redigitar nenhum dado.' },
              { n: '03', title: 'O fechamento do mês sai calculado', desc: 'As horas efetivamente utilizadas por cada personal viram o valor do aluguel. Quem está em atraso aparece na lista de inadimplência automaticamente.' },
            ].map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: i * 0.1, ease }}
                className="flex items-start gap-8 p-8 group cursor-default transition-colors duration-200"
                style={{ background: '#111111' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#141414')}
                onMouseLeave={e => (e.currentTarget.style.background = '#111111')}>
                <span className="font-black text-5xl leading-none flex-shrink-0 select-none"
                  style={{ color: 'rgba(255,255,255,0.06)' }}>
                  {s.n}
                </span>
                <div className="flex-1 pt-1">
                  <h3 className="font-black text-xl mb-2 tracking-tight" style={{ color: '#fff' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.desc}</p>
                </div>
                <div className="w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1"
                  style={{ borderColor: '#C9A84C' }}>
                  <Check className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ────────────────────────────────────────────────── */}
      <section className="w-full py-24" style={{ background: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease }}>
            <p className="text-[11px] font-black tracking-[0.22em] uppercase mb-5" style={{ color: '#C9A84C' }}>
              Como foi construído
            </p>
            <h2 className="font-black leading-tight tracking-tighter mb-6"
              style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.4rem)', color: '#fff' }}>
              Desenvolvido dentro de um estúdio<br />
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>em operação.</span>
            </h2>
            <p className="text-base leading-relaxed mb-10 max-w-2xl" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Cada tela partiu de uma necessidade concreta de quem administra um estúdio que aluga
              espaço a personal trainers: o acompanhamento dos pagamentos, o controle da
              documentação profissional e o registro dos contatos que chegam todos os dias.
            </p>
            <div className="grid sm:grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {[
                { t: 'Feito para Portugal', d: 'Cédula TEEF, NIF, IVA e endereço fiscal tratados como campos nativos.' },
                { t: 'Modelo de aluguel', d: 'Personais autônomos que pagam pelo uso do espaço — por hora, semana ou mês.' },
                { t: 'Em operação real', d: 'Rodando com um estúdio ativo, com alunos e cobranças reais, diariamente.' },
              ].map(b => (
                <div key={b.t} className="p-5" style={{ background: '#0d0d0d' }}>
                  <p className="font-bold text-sm mb-1.5" style={{ color: '#fff' }}>{b.t}</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>{b.d}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <section id="demo" className="w-full relative overflow-hidden py-32"
        style={{ background: '#111111', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(201,168,76,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.025) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ width: 800, height: 400, background: 'radial-gradient(ellipse, rgba(201,168,76,0.1) 0%, transparent 65%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.85, ease }}
            className="font-black leading-[0.88] tracking-tighter mb-6"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 6.5rem)', color: '#fff' }}>
            Um sistema.<br />
            <span style={{ color: '#C9A84C' }}>O estúdio inteiro.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-base mb-12" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Leads, agenda, alunos, avaliações e aluguel dos personais — organizados no mesmo lugar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6, ease }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login"
              className="group flex items-center gap-3 px-10 font-black text-[12px] tracking-[0.15em] uppercase rounded-xl transition-all hover:scale-105 active:scale-95"
              style={{ height: 56, background: '#C9A84C', color: '#111111' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 50px rgba(201,168,76,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              Entrar na plataforma
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {/* Segundo botão aponta para as funcionalidades, não para /login:
                ambos os CTA irem ao mesmo sítio não dava escolha nenhuma a
                quem ainda não tem conta. */}
            <a href="#features"
              className="flex items-center gap-2.5 px-10 font-bold text-sm rounded-xl transition-all"
              style={{ height: 56, color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              }}>
              Ver o que resolve
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-10 flex items-center justify-center gap-8 flex-wrap">
            {['✓ Dados hospedados na UE', '✓ LGPD & RGPD', '✓ Feito em Portugal 🇵🇹'].map(b => (
              <span key={b} className="text-[11px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.18)' }}>
                {b}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="w-full py-8 px-6" style={{ background: '#080808', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.15)' }}>
              <Dumbbell className="w-3 h-3" style={{ color: '#C9A84C' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>Fit Studio Now</span>
          </div>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.12)' }}>
            © 2026 Fit Studio Now · Almada, Portugal · LGPD & RGPD
          </p>
          <div className="flex gap-6">
            {['Privacidade', 'Termos', 'RGPD'].map(l => (
              <a key={l} href="#" className="text-[11px] transition-colors"
                style={{ color: 'rgba(255,255,255,0.15)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.15)')}>
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
