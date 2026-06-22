'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Dumbbell, Loader2, Shield, Globe, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const DEMO = [
  {
    label: '🏢 Admin — Maicon',
    email: 'admin@fittrainly.com',
    password: 'Admin1234!',
    style: { background: '#111111', color: '#ffffff', border: '1px solid #333' },
  },
  {
    label: '💪 PT — João',
    email: 'joao@fittrainly.com',
    password: 'Trainer1234!',
    style: { background: '#C9A84C', color: '#111111', border: '1px solid #C9A84C', fontWeight: 700 },
  },
  {
    label: '🎯 Aluno — Carlos',
    email: 'carlos@fittrainly.com',
    password: 'Aluno1234!',
    style: { background: '#ffffff', color: '#111111', border: '1px solid #E5E5E5' },
  },
]

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  PERSONAL_TRAINER: '/pt',
  ALUNO: '/aluno',
}

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e?: { preventDefault?: () => void }, overrideEmail?: string, overridePass?: string) {
    e?.preventDefault?.()
    const finalEmail = overrideEmail ?? email
    const finalPass = overridePass ?? password
    if (!finalEmail || !finalPass) return
    setLoading(true)
    setError('')
    try {
      const data = await authApi.login(finalEmail, finalPass)
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success(`Bem-vindo, ${data.user.name.split(' ')[0]}!`)
      router.push(ROLE_HOME[data.user.role] ?? '/login')
    } catch {
      setError('Email ou password incorrectos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function quickLogin(e: string, p: string) {
    setEmail(e)
    setPassword(p)
    handleLogin(undefined, e, p)
  }

  return (
    <div className="min-h-dvh flex">
      {/* Left panel — Nike Premium */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-[44%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: '#111111' }}
      >
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        {/* Gold gradient accent — bottom left */}
        <div className="absolute bottom-0 left-0 w-64 h-64 opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="logo-icon w-9 h-9 rounded-md flex items-center justify-center"
            style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <Dumbbell className="w-[18px] h-[18px]" style={{ color: '#C9A84C' }} />
          </div>
          <span className="logo-text font-bold text-lg tracking-tight">fitTrainly</span>
        </div>

        {/* Center */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-4">
            <p className="text-white/40 text-xs font-semibold tracking-[0.2em] uppercase">Parceiro Nike · Portugal</p>
            <h1 className="text-white text-[2.6rem] font-black leading-[1.1] tracking-tight">
              O sistema que<br />
              o teu estúdio<br />
              <span style={{ color: '#C9A84C' }}>merecia.</span>
            </h1>
            <p className="text-white/45 text-sm leading-relaxed max-w-xs">
              Gestão de PTs, agendamento e faturação automática — num só lugar.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['Gestão de PTs', 'Agendamento', 'Faturação Automática', 'Multi-perfil'].map(f => (
              <span key={f}
                className="text-[11px] font-medium rounded-full px-3 py-1.5"
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(201,168,76,0.2)',
                }}>
                {f}
              </span>
            ))}
          </div>

          {/* Credentials */}
          <div className="space-y-3">
            {[
              { icon: Shield, label: 'RGPD Compliant' },
              { icon: Globe, label: 'Made in Portugal 🇵🇹' },
              { icon: Zap, label: 'Nike Strength Partner Ready' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C9A84C' }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Almada, Portugal · {new Date().getFullYear()}
        </p>
      </motion.div>

      {/* Right panel — form */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-white"
      >
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-md flex items-center justify-center"
            style={{ background: '#111111' }}>
            <Dumbbell className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="font-black text-lg tracking-tight" style={{ color: '#111111' }}>fitTrainly</span>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Entrar na plataforma</h2>
            <p className="text-sm text-gray-400">Gerencie o seu estúdio com inteligência</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@fittrainly.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11 text-sm border-gray-200 focus:border-gray-900 focus:ring-gray-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-11 text-sm border-gray-200 focus:border-gray-900 focus:ring-gray-900"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-11 font-semibold text-sm mt-2 tracking-wide"
              style={{ background: '#111111', color: '#ffffff' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
            </Button>
          </form>

          {/* Demo section */}
          <div className="mt-8">
            <div className="relative flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400 whitespace-nowrap font-medium tracking-wide uppercase">Acesso Rápido</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map(d => (
                <button
                  key={d.email}
                  onClick={() => quickLogin(d.email, d.password)}
                  disabled={loading}
                  className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 hover:opacity-90 active:scale-95"
                  style={d.style}
                >
                  <span className="text-base leading-none">{d.label.split(' ')[0]}</span>
                  <span className="text-[10px] opacity-70 font-medium leading-tight text-center px-1">{d.label.split('— ')[1] ?? d.label}</span>
                </button>
              ))}
            </div>
            <p className="text-center text-[10px] text-gray-300 mt-3">Um clique entra automaticamente</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
