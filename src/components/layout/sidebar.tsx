'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, CreditCard, Receipt,
  Calendar, UserCheck, CalendarPlus, History,
  Dumbbell, LogOut, Layers, ClipboardList,
  Bell, TrendingUp, Users2, X, ClipboardCheck, BarChart3,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { UserRole } from '@/types'

const NAV: Record<UserRole, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/admin',                   label: 'Dashboard',         icon: LayoutDashboard },
    { href: '/admin/alunos',            label: 'Alunos',            icon: Users2 },
    { href: '/admin/schedule',          label: 'Agenda do Estúdio', icon: Calendar },
    { href: '/admin/personal-trainers', label: 'Personal Trainers', icon: Users },
    { href: '/admin/modalidades',       label: 'Modalidades',       icon: Layers },
    { href: '/admin/plans',             label: 'Planos de Aluguel', icon: CreditCard },
    { href: '/admin/billing',           label: 'Faturação',         icon: Receipt },
    { href: '/admin/relatorios',        label: 'Relatórios',        icon: BarChart3 },
    { href: '/admin/leads',             label: 'Leads',             icon: TrendingUp },
    { href: '/admin/notificacoes',      label: 'Notificações',      icon: Bell },
  ],
  PERSONAL_TRAINER: [
    { href: '/pt',              label: 'Dashboard',   icon: LayoutDashboard },
    { href: '/pt/availability', label: 'Minha Agenda', icon: Calendar },
    { href: '/pt/students',     label: 'Meus Alunos', icon: UserCheck },
    { href: '/pt/treinos',      label: 'Treinos',     icon: ClipboardList },
  ],
  ALUNO: [
    { href: '/aluno',           label: 'Dashboard',      icon: LayoutDashboard },
    { href: '/aluno/book',      label: 'Minhas Sessões', icon: CalendarPlus },
    { href: '/aluno/treino',    label: 'Meu Treino',     icon: Dumbbell },
    { href: '/aluno/history',   label: 'Histórico',      icon: History },
    { href: '/aluno/anamnese',  label: 'Minha Anamnese', icon: ClipboardCheck },
  ],
}

interface SidebarProps {
  open?: boolean       // mobile overlay open state
  onClose?: () => void // close callback for mobile
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  if (!user) return null
  const links = NAV[user.role] ?? []

  function handleLogout() {
    logout()
    onClose?.()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/admin' || href === '/pt' || href === '/aluno') return pathname === href
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#111111' }}>
      {/* Logo row */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.07] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.25)' }}
          >
            <Dumbbell className="w-4 h-4" style={{ color: '#C9A84C' }} />
          </div>
          <span className="font-bold text-base tracking-tight text-white">fitTrainly</span>
        </div>
        {/* Close button — only visible on mobile overlay */}
        <button
          onClick={onClose}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Fechar menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all relative',
                active
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/[0.05]'
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                  style={{ background: '#C9A84C' }}
                />
              )}
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: active ? '#C9A84C' : undefined }}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/[0.07] space-y-1 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(201,168,76,0.2)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}
          >
            {getInitials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user.name}</p>
            <p className="text-white/35 text-[11px] truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-white/40 hover:text-white hover:bg-white/[0.07] transition-all text-xs font-medium"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop: always-visible fixed sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[240px] shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* ── Mobile/Tablet: overlay drawer ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
              onClick={onClose}
            />
            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col overflow-hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
