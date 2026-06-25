'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, CreditCard, Receipt,
  Calendar, UserCheck, CalendarPlus, History,
  Dumbbell, LogOut, Layers, ClipboardList,
  Bell, TrendingUp, Users2,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { UserRole } from '@/types'

const NAV: Record<UserRole, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/alunos', label: 'Alunos', icon: Users2 },
    { href: '/admin/schedule', label: 'Agenda do Estúdio', icon: Calendar },
    { href: '/admin/personal-trainers', label: 'Personal Trainers', icon: Users },
    { href: '/admin/modalidades', label: 'Modalidades', icon: Layers },
    { href: '/admin/plans', label: 'Planos de Aluguel', icon: CreditCard },
    { href: '/admin/billing', label: 'Faturação', icon: Receipt },
    { href: '/admin/leads', label: 'Leads', icon: TrendingUp },
    { href: '/admin/notificacoes', label: 'Notificações', icon: Bell },
  ],
  PERSONAL_TRAINER: [
    { href: '/pt', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/pt/availability', label: 'Minha Agenda', icon: Calendar },
    { href: '/pt/students', label: 'Meus Alunos', icon: UserCheck },
    { href: '/pt/treinos', label: 'Treinos', icon: ClipboardList },
  ],
  ALUNO: [
    { href: '/aluno', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/aluno/book', label: 'Minhas Sessões', icon: CalendarPlus },
    { href: '/aluno/treino', label: 'Meu Treino', icon: Dumbbell },
    { href: '/aluno/history', label: 'Histórico', icon: History },
  ],
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  if (!user) return null
  const links = NAV[user.role] ?? []

  function handleLogout() {
    logout()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/admin' || href === '/pt' || href === '/aluno') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="hidden lg:flex flex-col w-[240px] shrink-0 h-screen sticky top-0 overflow-y-auto"
      style={{ background: '#111111' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.07]">
        <div className="logo-icon w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.25)' }}>
          <Dumbbell className="w-4 h-4" style={{ color: '#C9A84C' }} />
        </div>
        <span className="logo-text font-bold text-base tracking-tight">fitTrainly</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
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
                className={cn('w-4 h-4 flex-shrink-0')}
                style={{ color: active ? '#C9A84C' : undefined }}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-white/[0.07]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/[0.05] transition-colors group">
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
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-white/25 hover:text-white/70 hover:bg-white/[0.08] transition-colors opacity-0 group-hover:opacity-100"
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
