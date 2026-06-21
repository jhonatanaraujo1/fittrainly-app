'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, CreditCard, Receipt,
  Calendar, UserCheck, CalendarPlus, History, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { UserRole } from '@/types'

const NAV: Record<UserRole, { href: string; label: string; icon: React.ElementType }[]> = {
  ADMIN: [
    { href: '/admin', label: 'Início', icon: LayoutDashboard },
    { href: '/admin/schedule', label: 'Agenda', icon: Calendar },
    { href: '/admin/personal-trainers', label: 'PTs', icon: Users },
    { href: '/admin/billing', label: 'Faturação', icon: Receipt },
  ],
  PERSONAL_TRAINER: [
    { href: '/pt', label: 'Início', icon: LayoutDashboard },
    { href: '/pt/availability', label: 'Horários', icon: Calendar },
    { href: '/pt/students', label: 'Alunos', icon: UserCheck },
  ],
  ALUNO: [
    { href: '/aluno', label: 'Início', icon: LayoutDashboard },
    { href: '/aluno/book', label: 'Sessões', icon: CalendarPlus },
    { href: '/aluno/history', label: 'Histórico', icon: History },
  ],
}

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  if (!user) return null
  const links = NAV[user.role] ?? []

  function isActive(href: string) {
    if (href === '/admin' || href === '/pt' || href === '/aluno') return pathname === href
    return pathname.startsWith(href)
  }

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex border-t"
      style={{
        background: '#111111',
        borderColor: 'rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-colors"
            style={{ color: active ? '#C9A84C' : 'rgba(255,255,255,0.35)' }}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full"
                style={{ background: '#C9A84C' }}
              />
            )}
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
      <button
        onClick={handleLogout}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-colors"
        style={{ color: 'rgba(255,255,255,0.25)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.8)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
      >
        <LogOut className="w-5 h-5" />
        <span className="text-[10px] font-medium">Sair</span>
      </button>
    </nav>
  )
}
