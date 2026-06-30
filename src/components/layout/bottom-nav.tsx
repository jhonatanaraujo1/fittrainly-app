'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Users2,
  Calendar, UserCheck, CalendarPlus, History, LogOut, Dumbbell,
  TrendingUp, ClipboardList, CreditCard, Receipt, Layers,
  Bell, MoreHorizontal, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { UserRole } from '@/types'

type NavItem = { href: string; label: string; icon: React.ElementType }

// Primary items — always visible in bottom bar
const PRIMARY: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { href: '/admin',          label: 'Início',  icon: LayoutDashboard },
    { href: '/admin/alunos',   label: 'Alunos',  icon: Users2 },
    { href: '/admin/schedule', label: 'Agenda',  icon: Calendar },
    { href: '/admin/leads',    label: 'Leads',   icon: TrendingUp },
  ],
  PERSONAL_TRAINER: [
    { href: '/pt',              label: 'Início',  icon: LayoutDashboard },
    { href: '/pt/availability', label: 'Agenda',  icon: Calendar },
    { href: '/pt/students',     label: 'Alunos',  icon: UserCheck },
    { href: '/pt/treinos',      label: 'Treinos', icon: ClipboardList },
  ],
  ALUNO: [
    { href: '/aluno',          label: 'Início',    icon: LayoutDashboard },
    { href: '/aluno/book',     label: 'Sessões',   icon: CalendarPlus },
    { href: '/aluno/treino',   label: 'Treino',    icon: Dumbbell },
    { href: '/aluno/history',  label: 'Histórico', icon: History },
  ],
}

// Extra items — only in the "Mais" drawer
const EXTRA: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { href: '/admin/personal-trainers', label: 'Personal Trainers', icon: Users },
    { href: '/admin/modalidades',       label: 'Modalidades',       icon: Layers },
    { href: '/admin/plans',             label: 'Planos de Aluguel', icon: CreditCard },
    { href: '/admin/billing',           label: 'Faturação',         icon: Receipt },
    { href: '/admin/notificacoes',      label: 'Notificações',      icon: Bell },
  ],
  PERSONAL_TRAINER: [],
  ALUNO: [],
}

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!user) return null

  const primary = PRIMARY[user.role] ?? []
  const extra   = EXTRA[user.role] ?? []
  const hasExtra = extra.length > 0

  function isActive(href: string) {
    if (href === '/admin' || href === '/pt' || href === '/aluno') return pathname === href
    return pathname.startsWith(href)
  }

  function handleLogout() {
    logout()
    router.push('/login')
  }

  // Check if current page is in extra (highlight the "Mais" button)
  const extraActive = extra.some(e => isActive(e.href))

  return (
    <>
      {/* Bottom bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex border-t"
        style={{
          background: '#111111',
          borderColor: 'rgba(255,255,255,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-colors"
              style={{ color: active ? '#C9A84C' : 'rgba(255,255,255,0.35)' }}
              onClick={() => setDrawerOpen(false)}
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

        {/* "Mais" button — only when there are extra items */}
        {hasExtra ? (
          <button
            onClick={() => setDrawerOpen(v => !v)}
            className="relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-colors"
            style={{ color: drawerOpen || extraActive ? '#C9A84C' : 'rgba(255,255,255,0.35)' }}
          >
            {(drawerOpen || extraActive) && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full"
                style={{ background: '#C9A84C' }}
              />
            )}
            {drawerOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        ) : (
          /* No extra: show Sair directly */
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[60px] transition-colors"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        )}
      </nav>

      {/* "Mais" drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="lg:hidden fixed bottom-[60px] inset-x-0 z-40 rounded-t-2xl overflow-hidden"
              style={{
                background: '#161616',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-8 h-1 rounded-full bg-white/20" />
              </div>

              <p className="px-5 pt-2 pb-3 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                Mais opções
              </p>

              {/* Extra nav items — 2-column grid */}
              <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                {extra.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all min-h-[56px]',
                        active
                          ? 'bg-white/10 text-white'
                          : 'bg-white/[0.04] text-white/50 active:bg-white/10'
                      )}
                    >
                      <Icon
                        className="w-5 h-5 flex-shrink-0"
                        style={{ color: active ? '#C9A84C' : undefined }}
                      />
                      <span className="text-sm font-medium leading-tight">{label}</span>
                    </Link>
                  )
                })}
              </div>

              {/* Divider + Sair */}
              <div className="mx-4 mb-4 border-t border-white/[0.06] pt-3">
                <button
                  onClick={() => { setDrawerOpen(false); handleLogout() }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] text-white/40 active:bg-white/10 transition-all min-h-[56px]"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">Sair</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
