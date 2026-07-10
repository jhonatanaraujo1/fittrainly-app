'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { Dumbbell } from 'lucide-react'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuthStore } from '@/store/auth'

// Guarda de sessão anti-tela-branca: existem dois mecanismos de sessão
// independentes (cookies lidos pelo proxy.ts no servidor, Zustand/localStorage
// lido aqui no cliente). Se ficarem dessincronizados — ex: storage parcialmente
// limpo — o app não pode travar num `return null` para sempre: sempre mostra
// feedback visível, e força o redirect via location.href (não router.replace,
// que o middleware server-side pode reverter) depois de um timeout curto.
function AuthLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F8F9FA]">
      <div className="flex flex-col items-center gap-3">
        <Dumbbell className="w-8 h-8 text-[#1F3864] animate-pulse" />
        <p className="text-sm text-gray-400">A carregar…</p>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [hydrated, setHydrated] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))
      return unsub
    }
  }, [])

  useEffect(() => {
    if (!hydrated || isAuthenticated) return
    // Se os cookies (fonte de verdade do middleware server-side) ainda
    // afirmam sessão válida enquanto o Zustand/localStorage local diz que
    // não, router.replace('/login') entra em loop: o middleware manda de
    // volta pra cá. Limpar os cookies primeiro garante que o próximo
    // redirect não seja revertido — sempre um caminho de saída determinístico.
    Cookies.remove('fittrainly-refresh')
    Cookies.remove('fittrainly-role')
    router.replace('/login')
    // Timeout de segurança: se em 2.5s ainda não navegamos, força um
    // redirect real de página inteira, que reavalia tudo do zero.
    const t = setTimeout(() => {
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }, 2500)
    return () => clearTimeout(t)
  }, [hydrated, isAuthenticated, router])

  if (!hydrated || !isAuthenticated) return <AuthLoadingScreen />

  return (
    <div className="flex min-h-dvh bg-[#F8F9FA]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile/tablet top bar */}
        <header
          className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-30"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Abrir menu"
          >
            <span className="flex flex-col gap-[5px] w-5">
              <span className="h-[1.5px] bg-gray-700 rounded-full block" />
              <span className="h-[1.5px] bg-gray-700 rounded-full block w-3/4" />
              <span className="h-[1.5px] bg-gray-700 rounded-full block" />
            </span>
          </button>
          <span className="font-bold text-sm tracking-tight text-gray-900">Fit Studio Now</span>
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
