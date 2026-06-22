'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { useAuthStore } from '@/store/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Zustand persist rehydrates from localStorage asynchronously on mount.
    // Without this guard, isAuthenticated starts as false and triggers a
    // premature redirect to /login before the persisted state is loaded.
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
      return unsub
    }
  }, [])

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace('/login')
  }, [hydrated, isAuthenticated, router])

  if (!hydrated || !isAuthenticated) return null

  return (
    <div className="flex min-h-dvh bg-[#F8F9FA]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto pb-20 lg:pb-6">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
