'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  Dumbbell, Calendar, Users, BarChart3, Shield, Zap,
  ArrowRight, Check, ChevronDown, Layers,
} from 'lucide-react'

/* ─── animation presets ─────────────────────────────────────────────── */
const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
}
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
}

/* ─── counter card ───────────────────────────────────────────────────── */
function MetricCard({ target, suffix, label }: { target: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 1800
    const inc = target / (duration / 16)
    let curr = 0
    const id = setInterval(() => {
      curr += inc
      if (curr >= target) { setCount(target); clearInterval(id) }
      else setCount(Math.floor(curr))
    }, 16)
    return () => clearInterval(id)
  }, [inView, target])

  return (
    <div ref={ref} className="py-14 px-8 text-center" style={{ background: '#C9A84C' }}>
      <p className="font-black leading-none mb-2 tabular-nums"
        style={{ fontSize: 'clamp(2.8rem, 7vw, 5rem)', color: '#111111' }}>
        {count.toLocaleString('pt-PT')}{suffix}
      </p>
      <p className="text-[11px] font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(17,17,17,0.5)' }}>
        {label}
      </p>
    </div>
  )
}

/* ─── ticker ─────────────────────────────────────────────────────────── */
function Ticker() {
  const items = [
    '⚡ GESTÃO DE PTs', '✦ AGENDA INTELIGENTE', '⚡ FATURAÇÃO AUTOMÁTICA',
    '✦ CONTROLO DE ALUNOS', '⚡ RELATÓRIOS EM TEMPO REAL', '✦ PARCEIRO NIKE',
    '⚡ MADE IN PORTUGAL', '✦ RGPD COMPLIANT', '⚡ MULTI-PERFIL',
  ]
  return (
    <div className="overflow-hidden border-y" style={{ borderColor: '#C9A84C', background: '#C9A84C' }}>
      <motion.div
        className="flex whitespace-nowrap py-3"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} className="text-[11px] font-black tracking-[0.2em] uppercase px-6 text-black flex-shrink-0">{t}</span>
        ))}
      </motion.div>
    </div>
  )
}

/* ─── scroll-triggered wrapper ───────────────────────────────────────── */
function FadeSection({ children, id, style }: { children: React.ReactNode; id?: string; style?: React.CSSProperties }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.section id={id} ref={ref}
      initial="hidden" animate={inView ? 'visible' : 'hidden'}
      variants={stagger} style={style}>
      {children}
    </motion.section>
  )
}

/* ─── page ───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '28%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])

  const headline = ['O sistema', 'que o teu', 'estúdio', 'merecia.']

  const features = [
    { icon: Calendar, tag: 'AGENDA', title: 'Horários sem conflito', desc: 'Admin aloca slots por PT. Cada personal vê apenas o seu tempo. Chega de double-booking.' },
    { icon: Users, tag: 'CONTROLO', title: 'PTs e Alunos', desc: 'Perfis completos, planos de aluguel, inadimplência e performance — num único painel.' },
    { icon: BarChart3, tag: 'RECEITA', title: 'Faturação automática', desc: 'O sistema calcula o que cada PT deve com base nas horas reais. Zero planilhas.' },
    { icon: Zap, tag: 'CONEXÃO', title: 'Presenças em tempo real', desc: 'Aluno confirma ou marca falta com 1 clique. PT é notificado na hora. Sem surpresas.' },
    { icon: Layers, tag: 'IDENTIDADE', title: 'Modalidades do estúdio', desc: 'Musculação, Luta, Dança, Yoga — cataloga tudo com cor própria e gere cada atividade.' },
    { icon: Shield, tag: 'SEGURANÇA', title: 'Multi-perfil seguro', desc: 'Admin, PT e Aluno em roles separados. Cada um vê apenas o que precisa.' },
  ]

  const steps = [
    { n: '01', title: 'Admin cria os slots', desc: 'O estúdio define os horários disponíveis e aloca tempo para cada Personal Trainer.' },
    { n: '02', title: 'PT gere os alunos', desc: 'Cada PT vê os seus horários, alunos confirmados e histórico de sessões em detalhe.' },
    { n: '03', title: 'Aluno confirma presença', desc: 'O aluno confirma ou marca falta com 1 clique. O PT fica a saber instantaneamente.' },
  ]

  return (
    <div style={{ fontFamily: 'var(--font-geist-sans)', background: '#111111', overflowX: 'hidden' }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b"
        style={{ background: 'rgba(17,17,17,0.94)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="logo-icon w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.25)' }}>
              <Dumbbell className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
            </div>
            <span className="logo-text text-sm font-bold tracking-tight">fitTrainly</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {[['#features', 'Funcionalidades'], ['#how', 'Como funciona'], ['#demo', 'Demo']].map(([href, label]) => (
              <a key={href} href={href}
                className="text-[11px] font-semibold tracking-[0.12em] uppercase transition-colors"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                {label}
              </a>
            ))}
          </nav>
          <Link href="/login"
            className="h-9 px-5 text-[11px] font-black tracking-[0.15em] uppercase rounded-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            style={{ background: '#C9A84C', color: '#111111' }}>
            Entrar <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative flex flex-col items-center justify-center overflow-hidden pt-16"
        style={{ minHeight: '100svh', background: '#111111' }}>

        {/* grid texture */}
        <div className="absolute inset-0 pointer-events-none select-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
        }} />

        {/* gold radial glow */}
        <motion.div style={{ y: heroY }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div style={{
            width: 900, height: 900, borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(201,168,76,0.09) 0%,transparent 65%)',
          }} />
        </motion.div>

        {/* floating orbs */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 pointer-events-none">
          {[
            { top: '25%', left: '10%', size: 8, delay: 0, duration: 6 },
            { top: '35%', right: '12%', size: 6, delay: 1, duration: 8 },
            { bottom: '30%', left: '22%', size: 5, delay: 2, duration: 7 },
          ].map((o, i) => (
            <motion.div key={i}
              animate={{ y: [0, -(o.size * 2.5), 0] }}
              transition={{ duration: o.duration, repeat: Infinity, ease: 'easeInOut', delay: o.delay }}
              className="absolute rounded-full"
              style={{ ...o, width: o.size, height: o.size, background: i < 2 ? '#C9A84C' : '#fff', opacity: i === 0 ? 0.55 : i === 1 ? 0.3 : 0.18 }} />
          ))}
        </motion.div>

        {/* live badge */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease }}
          className="relative z-10 mb-10 flex items-center gap-2 px-4 py-2 rounded-full border"
          style={{ borderColor: 'rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.07)' }}>
          <motion.span animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: '#C9A84C' }} />
          <span className="text-[11px] font-black tracking-[0.2em] uppercase" style={{ color: '#C9A84C' }}>
            Parceiro Nike · Portugal · 2026
          </span>
        </motion.div>

        {/* headline */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 text-center px-6 max-w-6xl">
          <h1 className="font-black leading-[0.88] tracking-tighter mb-8"
            style={{ fontSize: 'clamp(3.2rem, 11vw, 8.5rem)', color: '#fff', perspective: '1000px' }}>
            {headline.map((word, wi) => (
              <motion.span key={wi}
                initial={{ opacity: 0, y: 56, rotateX: -20 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8, delay: 0.4 + wi * 0.13, ease }}
                className="inline-block mr-[0.22em] last:mr-0"
                style={wi === headline.length - 1 ? {
                  color: '#C9A84C',
                  textShadow: '0 0 80px rgba(201,168,76,0.25)',
                } : {}}>
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.0, ease }}
            className="text-lg max-w-xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.38)' }}>
            Gestão completa para estúdios boutique de personal training.
            Agenda, PTs, alunos e faturação — num só lugar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.15, ease }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login"
              className="group flex items-center gap-2.5 px-8 font-black text-[11px] tracking-[0.18em] uppercase rounded-md transition-all hover:scale-105 active:scale-95"
              style={{ height: 52, background: '#C9A84C', color: '#111111' }}>
              Ver Demo Grátis
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#features"
              className="flex items-center gap-2 px-8 font-semibold text-sm rounded-md transition-all hover:bg-white/[0.05]"
              style={{ height: 52, color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Como funciona
            </a>
          </motion.div>
        </motion.div>

        {/* scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.3 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-[10px] tracking-[0.22em] uppercase" style={{ color: 'rgba(255,255,255,0.13)' }}>scroll</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
            <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.13)' }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── TICKER ─────────────────────────────────────────────────────── */}
      <Ticker />

      {/* ── PROBLEM ────────────────────────────────────────────────────── */}
      <FadeSection id="problem" style={{ background: '#fff', padding: '7rem 1.5rem' }}>
        <div className="max-w-5xl mx-auto">
          <motion.p variants={fadeUp} className="text-[11px] font-black tracking-[0.22em] uppercase mb-5" style={{ color: '#C9A84C' }}>
            O problema
          </motion.p>
          <motion.h2 variants={fadeUp}
            className="font-black leading-[0.92] tracking-tighter mb-16"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.8rem)', color: '#111111' }}>
            Ainda a gerir o teu estúdio<br className="hidden md:block" />
            com WhatsApp e planilha?
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-px" style={{ background: '#e5e7eb' }}>
            {[
              { emoji: '😩', title: 'Conflitos de horário', desc: 'Dois PTs reservam o mesmo slot. Só descobres quando o segundo aparece no estúdio.' },
              { emoji: '💸', title: 'Faturação às cegas', desc: 'Não sabes quanto cada PT te deve este mês sem fazer contas à mão.' },
              { emoji: '👻', title: 'Faltas sem aviso', desc: 'Aluno some. PT fica à espera. Espaço vazio. Dinheiro na rua.' },
            ].map((p, i) => (
              <motion.div key={i} variants={fadeUp}
                className="p-8 transition-colors duration-200"
                style={{ background: '#fff' }}
                whileHover={{ background: '#fafafa' }}>
                <span className="text-4xl mb-5 block">{p.emoji}</span>
                <h3 className="font-black text-lg mb-2 tracking-tight" style={{ color: '#111111' }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeSection>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <FadeSection id="features" style={{ background: '#111111', padding: '7rem 1.5rem' }}>
        <div className="max-w-6xl mx-auto">
          <motion.p variants={fadeUp} className="text-[11px] font-black tracking-[0.22em] uppercase mb-5" style={{ color: '#C9A84C' }}>
            Funcionalidades
          </motion.p>
          <motion.h2 variants={fadeUp}
            className="font-black tracking-tighter mb-16"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: '#fff' }}>
            Tudo o que o teu estúdio precisa.<br />
            <span style={{ color: 'rgba(255,255,255,0.22)' }}>Nada que não precise.</span>
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.07)' }}>
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeUp}
                className="p-7 relative overflow-hidden cursor-default group transition-colors duration-300"
                style={{ background: '#111111' }}
                whileHover={{ background: 'rgba(20,20,20,0.98)' }}>
                {/* hover gradient */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at 25% 15%,rgba(201,168,76,0.07) 0%,transparent 55%)' }} />
                {/* left gold bar */}
                <div className="absolute left-0 top-5 bottom-5 w-[2px] scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-300 rounded-full"
                  style={{ background: '#C9A84C' }} />
                <span className="text-[10px] font-black tracking-[0.22em] uppercase mb-5 block" style={{ color: '#C9A84C' }}>{f.tag}</span>
                <f.icon className="w-5 h-5 mb-4 transition-transform duration-300 group-hover:-translate-y-0.5" style={{ color: '#fff' }} />
                <h3 className="font-black text-[15px] mb-2 tracking-tight" style={{ color: '#fff' }}>{f.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.37)' }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeSection>

      {/* ── METRICS ────────────────────────────────────────────────────── */}
      <div className="border-y" style={{ borderColor: 'rgba(201,168,76,0.25)' }}>
        <div className="grid grid-cols-3 gap-px" style={{ background: 'rgba(201,168,76,0.15)' }}>
          <MetricCard target={120} suffix="+" label="Estúdios geridos" />
          <MetricCard target={4800} suffix="+" label="Sessões agendadas" />
          <MetricCard target={98} suffix="%" label="Satisfação" />
        </div>
      </div>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <FadeSection id="how" style={{ background: '#fff', padding: '7rem 1.5rem' }}>
        <div className="max-w-4xl mx-auto">
          <motion.p variants={fadeUp} className="text-[11px] font-black tracking-[0.22em] uppercase mb-5" style={{ color: '#C9A84C' }}>
            Como funciona
          </motion.p>
          <motion.h2 variants={fadeUp}
            className="font-black tracking-tighter mb-16"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: '#111111' }}>
            3 passos.<br />Estúdio organizado.
          </motion.h2>
          <div className="space-y-px" style={{ background: '#e5e7eb' }}>
            {steps.map((s, i) => (
              <motion.div key={i} variants={fadeUp}
                className="flex items-center gap-8 p-8 group cursor-default transition-all duration-200"
                style={{ background: '#fff' }}
                whileHover={{ background: '#fafafa', paddingLeft: 44 }}>
                <span className="font-black text-5xl leading-none flex-shrink-0 select-none transition-colors duration-200"
                  style={{ color: '#ebebeb' }}>
                  {s.n}
                </span>
                <div className="flex-1">
                  <h3 className="font-black text-xl mb-1.5 tracking-tight" style={{ color: '#111111' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{s.desc}</p>
                </div>
                <div className="w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
                  style={{ borderColor: '#C9A84C' }}>
                  <Check className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeSection>

      {/* ── TESTIMONIAL ────────────────────────────────────────────────── */}
      <section style={{ background: '#111111', padding: '7rem 1.5rem' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease }}>
            <p className="font-black mb-4 select-none"
              style={{ fontSize: 90, color: 'rgba(201,168,76,0.18)', lineHeight: 0.65 }}>"</p>
            <p className="font-black leading-tight tracking-tighter mb-10"
              style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', color: '#fff' }}>
              Antes perdia 2 horas por semana a controlar horários e pagamentos dos meus PTs.
              Agora o sistema faz tudo. O estúdio nunca funcionou tão bem.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-sm"
                style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}>
                MG
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: '#fff' }}>Maicon Godoi</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>MG Estúdio Boutique · Almada, Portugal</p>
              </div>
              <div className="ml-auto hidden sm:flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.07 }}>
                    <svg className="w-4 h-4" fill="#C9A84C" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <section id="demo" className="relative overflow-hidden" style={{ background: '#111111', padding: '9rem 1.5rem' }}>
        {/* grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(201,168,76,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.03) 1px,transparent 1px)',
          backgroundSize: '44px 44px',
        }} />
        {/* bottom glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ width: 700, height: 400, background: 'radial-gradient(ellipse,rgba(201,168,76,0.12) 0%,transparent 70%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease }}
            className="font-black leading-[0.88] tracking-tighter mb-6"
            style={{ fontSize: 'clamp(3rem, 9vw, 7rem)', color: '#fff' }}>
            O teu estúdio<br />
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.35, ease }}
              style={{ color: '#C9A84C', display: 'inline-block' }}>
              merecia isto.
            </motion.span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-base mb-12"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            Experimenta grátis. Sem cartão. Sem compromisso.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.6, ease }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login"
              className="group flex items-center gap-3 px-10 font-black text-[11px] tracking-[0.18em] uppercase rounded-md transition-all hover:scale-105 active:scale-95"
              style={{ height: 56, background: '#C9A84C', color: '#111111' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 50px rgba(201,168,76,0.35)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              🏢 Ver Demo Admin
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/login"
              className="flex items-center gap-2.5 px-10 font-bold text-sm rounded-md transition-all"
              style={{ height: 56, color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}>
              💪 Ver como PT
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="mt-10 flex items-center justify-center gap-6 flex-wrap">
            {['✓ Nike Strength Partner', '✓ RGPD Compliant', '✓ Made in Portugal 🇵🇹'].map(b => (
              <span key={b} className="text-[11px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.18)' }}>
                {b}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-6" style={{ background: '#0d0d0d', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.15)' }}>
              <Dumbbell className="w-3 h-3" style={{ color: '#C9A84C' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.22)' }}>fitTrainly</span>
          </div>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.14)' }}>
            © 2026 fitTrainly · Almada, Portugal · Nike Strength Partner
          </p>
          <div className="flex gap-6">
            {['Privacidade', 'Termos', 'RGPD'].map(l => (
              <a key={l} href="#" className="text-[11px] transition-colors" style={{ color: 'rgba(255,255,255,0.16)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.16)')}>
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}
