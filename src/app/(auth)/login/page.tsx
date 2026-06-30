'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, Loader2, Shield, Eye, EyeOff, CheckCircle2, Star, HelpCircle, KeyRound, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const DEMO = [
  {
    label: 'Admin — Maicon',
    emoji: '🏢',
    email: 'admin@fittrainly.com',
    password: 'demo123',
    bg: '#111111',
    color: '#ffffff',
    accent: '#C9A84C',
  },
  {
    label: 'PT — João',
    emoji: '💪',
    email: 'joao@fittrainly.com',
    password: 'demo123',
    bg: '#1F3864',
    color: '#ffffff',
    accent: '#2E75B6',
  },
  {
    label: 'Aluno — Carlos',
    emoji: '🎯',
    email: 'carlos@fittrainly.com',
    password: 'demo123',
    bg: '#F9FAFB',
    color: '#111111',
    accent: '#6b7280',
  },
]

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  PERSONAL_TRAINER: '/pt',
  ALUNO: '/aluno',
}

// Trust signals for left panel
const TRUST = [
  { label: 'RGPD & LGPD Compliant' },
  { label: 'Pagamentos seguros via Stripe' },
  { label: 'Parceiro Nike Strength' },
  { label: 'Suporte dedicado 7 dias' },
]

// Stats to make the product look live
const STATS = [
  { value: '3', label: 'Estúdios' },
  { value: '8', label: 'PTs Activos' },
  { value: '47', label: 'Alunos' },
  { value: '312', label: 'Sessões realizadas' },
]

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      toast.error('Introduza um email válido')
      return
    }
    await new Promise(r => setTimeout(r, 800))
    toast.success(
      `📧 Se o email existir na plataforma, receberá as instruções em breve.`,
      { duration: 6000 }
    )
    setResetSent(true)
  }

  async function doLogin(e?: string, p?: string) {
    const finalEmail = e ?? email
    const finalPass = p ?? password
    if (!finalEmail || !finalPass) return
    if (!e) setLoading(true)
    setError('')
    try {
      const data = await authApi.login(finalEmail, finalPass)
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success(`Bem-vindo, ${data.user.name.split(' ')[0]}! 👋`)
      router.push(ROLE_HOME[data.user.role] ?? '/login')
    } catch {
      setError('Email ou password incorrectos. Verifique e tente novamente.')
      if (!e) setLoading(false)
    } finally {
      if (!e) setLoading(false)
    }
  }

  async function quickLogin(demo: typeof DEMO[0]) {
    setLoadingDemo(demo.email)
    setEmail(demo.email)
    setPassword(demo.password)
    await doLogin(demo.email, demo.password)
    setLoadingDemo(null)
  }

  const emailError = touched.email && !email ? 'Email obrigatório' :
    touched.email && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Email inválido' : ''
  const passwordError = touched.password && !password ? 'Password obrigatória' :
    touched.password && password && password.length < 6 ? 'Mínimo 6 caracteres' : ''

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ background: '#0d0d0d' }}
      >
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        {/* Gold radial glow */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 opacity-[0.08] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 65%)' }} />
        <div className="absolute top-1/3 right-0 w-72 h-72 opacity-[0.04] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #2E75B6 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)' }}>
            <Dumbbell className="w-[18px] h-[18px]" style={{ color: '#C9A84C' }} />
          </div>
          <div>
            <span className="font-black text-[17px] tracking-tight text-white">fitTrainly</span>
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }}>PRO</span>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-5">
            <p className="text-white/35 text-[10px] font-bold tracking-[0.25em] uppercase">Gestão de Estúdio Boutique</p>
            <h1 className="text-white font-black leading-[1.05] tracking-tight" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)' }}>
              O sistema que<br />
              o teu estúdio<br />
              <span style={{ color: '#C9A84C' }}>sempre merecia.</span>
            </h1>
            <p className="text-white/40 text-[15px] leading-relaxed max-w-xs">
              Gestão de PTs, agendamento inteligente e faturação automática — numa plataforma só.
            </p>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-2 gap-3">
            {STATS.map(({ value, label }) => (
              <div key={label} className="rounded-xl p-3.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-white font-black text-2xl tracking-tight">{value}</p>
                <p className="text-white/35 text-[11px] mt-0.5 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Trust signals */}
          <div className="space-y-2">
            {TRUST.map(({ label }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#C9A84C' }} />
                <span className="text-white/40 text-[13px] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p className="text-white/20 text-[11px]">Almada, Portugal 🇵🇹 · {new Date().getFullYear()}</p>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(201,168,76,0.5)' }}>
            <Star className="w-3 h-3 fill-current" />
            <span className="font-bold">Nike Strength Partner</span>
          </div>
        </div>
      </motion.div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex-1 flex flex-col min-h-dvh bg-white"
      >
        {/* Mobile logo bar */}
        <div className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#111111' }}>
              <Dumbbell className="w-[15px] h-[15px] text-white" />
            </div>
            <span className="font-black text-base tracking-tight" style={{ color: '#111111' }}>fitTrainly</span>
          </div>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            RGPD Compliant
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20">
          <div className="max-w-[380px] w-full mx-auto space-y-7">

            {/* Header */}
            <div>
              {mode === 'reset' ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setResetSent(false) }}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-3"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                  </button>
                  <h2 className="text-[1.6rem] font-black text-gray-900 tracking-tight leading-tight">
                    Recuperar password
                  </h2>
                  <p className="text-[14px] text-gray-400 mt-1.5">
                    Enviamos instruções para o teu email
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-[1.6rem] font-black text-gray-900 tracking-tight leading-tight">
                    Bem-vindo de volta
                  </h2>
                  <p className="text-[14px] text-gray-400 mt-1.5">
                    Acede à tua plataforma de gestão
                  </p>
                </>
              )}
            </div>

            {/* Security indicator (desktop only shown on right) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <Shield className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <p className="text-[11px] text-emerald-700 font-semibold">
                Ligação segura · TLS 1.3 · Dados encriptados AES-256
              </p>
            </div>

            {/* Reset password mode */}
            {mode === 'reset' && (
              <form onSubmit={handleReset} className="space-y-4" noValidate>
                {resetSent ? (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-base">Instruções enviadas</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Verifique <strong>{resetEmail}</strong> e siga as instruções.
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Não recebeu? Contacte o seu PT.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setResetSent(false) }}
                      className="text-sm font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-900 transition-colors"
                    >
                      Voltar ao login
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email" className="text-sm font-semibold text-gray-700">Email da conta</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        placeholder="o.teu@email.com"
                        className="h-12 text-base rounded-xl border-gray-200 focus:border-gray-900 focus:ring-gray-900/10"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!resetEmail}
                      className="w-full h-12 rounded-xl font-bold text-[15px] tracking-wide transition-all disabled:opacity-40 active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{ background: '#111111', color: '#ffffff' }}
                    >
                      <KeyRound className="w-4 h-4" />
                      Enviar instruções
                    </button>
                    <p className="text-center text-xs text-gray-400">
                      Não tem acesso ao email?{' '}
                      <button
                        type="button"
                        onClick={() => toast.info('Contacte o seu Personal Trainer para obter ajuda com o acesso.', { duration: 5000 })}
                        className="font-semibold text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
                      >
                        Contacte o seu PT
                      </button>
                    </p>
                  </>
                )}
              </form>
            )}

            {/* Login Form */}
            {mode === 'login' && <form
              onSubmit={e => { e.preventDefault(); doLogin() }}
              className="space-y-4"
              noValidate
            >
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="admin@mgstudio.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, email: true }))}
                    className={`h-12 text-sm pl-4 transition-all ${
                      emailError
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50/30'
                        : email && !emailError
                        ? 'border-emerald-300 focus:border-emerald-400'
                        : 'border-gray-200 focus:border-gray-900'
                    }`}
                  />
                  {email && !emailError && (
                    <CheckCircle2 className="absolute right-3 top-3.5 w-4 h-4 text-emerald-500 pointer-events-none" />
                  )}
                </div>
                <AnimatePresence>
                  {emailError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs text-red-500 font-medium">{emailError}</motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, password: true }))}
                    className={`h-12 text-sm pr-10 transition-all ${
                      passwordError
                        ? 'border-red-300 focus:border-red-400 bg-red-50/30'
                        : 'border-gray-200 focus:border-gray-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-700 transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {passwordError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs text-red-500 font-medium">{passwordError}</motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Global error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 bg-red-50 border border-red-100"
                  >
                    <span className="text-red-500 mt-0.5 text-sm">⚠</span>
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !!emailError || !!passwordError || !email || !password}
                className="w-full h-12 rounded-xl font-bold text-[15px] tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                style={{ background: '#111111', color: '#ffffff' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    A entrar...
                  </span>
                ) : (
                  'Entrar na plataforma'
                )}
              </button>

              {/* Forgot password link */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setResetSent(false); setResetEmail('') }}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors underline underline-offset-2"
                >
                  Esqueceu a password?
                </button>
              </div>
            </form>}

            {/* Demo quick access — hidden in reset mode */}
            {mode === 'login' && <>
            <div>
              <div className="relative flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] text-gray-400 font-bold tracking-[0.15em] uppercase whitespace-nowrap">
                  Acesso rápido — Demo
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEMO.map(d => (
                  <button
                    key={d.email}
                    onClick={() => quickLogin(d)}
                    disabled={!!loadingDemo || loading}
                    className="relative flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-xl text-xs font-bold transition-all disabled:opacity-50 hover:opacity-90 active:scale-95 overflow-hidden"
                    style={{ background: d.bg, color: d.color, border: `1.5px solid ${d.accent}22` }}
                  >
                    {loadingDemo === d.email ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span className="text-xl leading-none">{d.emoji}</span>
                        <span className="text-[10px] font-bold leading-tight text-center px-1 opacity-90">
                          {d.label}
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-center text-[10px] text-gray-300 mt-2.5">1 clique → login automático</p>
            </div>

            {/* Conformidade */}
            <div className="pt-2 border-t border-gray-50">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[
                  { label: 'RGPD Compliant', color: '#0369a1' },
                  { label: 'LGPD Compliant', color: '#0369a1' },
                ].map(({ label, color }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border"
                    style={{ color, background: `${color}0c`, borderColor: `${color}22` }}
                  >
                    <Shield className="w-2.5 h-2.5" />
                    {label}
                  </span>
                ))}
              </div>

              {/* Payment logos placeholder */}
              <div className="mt-3 flex items-center justify-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-100 bg-gray-50">
                  <div className="w-7 h-4 rounded flex items-center justify-center text-[9px] font-black text-white" style={{ background: '#1a1f71' }}>VISA</div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-100 bg-gray-50">
                  <div className="w-7 h-4 rounded flex items-center justify-center text-[7px] font-black" style={{ background: 'white' }}>
                    <span style={{ color: '#eb001b' }}>●</span><span style={{ color: '#f79e1b' }}>●</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-100 bg-gray-50">
                  <div className="w-9 h-4 rounded flex items-center justify-center text-[8px] font-black text-white" style={{ background: '#6772e5' }}>STRIPE</div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-100 bg-gray-50">
                  <div className="w-10 h-4 rounded flex items-center justify-center text-[7px] font-black text-white" style={{ background: '#009a44' }}>MB WAY</div>
                </div>
              </div>
              <p className="text-center text-[10px] text-gray-300 mt-2">
                Pagamentos geridos dentro da plataforma · Dados nunca armazenados no servidor
              </p>
            </div>
            </>}

            {/* Help section for alunos */}
            <div className="pt-3 border-t border-gray-50 flex items-center justify-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <p className="text-[11px] text-gray-400 text-center">
                Está com problemas?{' '}
                <button
                  type="button"
                  onClick={() => toast.info('Contacte o seu Personal Trainer para obter ajuda com o acesso à plataforma.', { duration: 5000 })}
                  className="font-semibold text-gray-600 hover:text-gray-900 transition-colors underline underline-offset-2"
                >
                  Contacte o seu PT
                </button>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
