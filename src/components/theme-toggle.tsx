'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'
const KEY = 'fittrainly-theme'

function apply(t: Theme) {
  const el = document.documentElement
  if (t === 'dark') el.classList.add('dark')
  else el.classList.remove('dark')
}

export function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem(KEY) as Theme) || 'dark'
}

// Botão de alternância claro/escuro — vive no rodapé da sidebar, ao lado do
// "Alterar password". Default escuro (o cliente pediu preto+dourado como
// padrão). Persistido por cliente em localStorage; o script anti-flash no
// root layout aplica antes do primeiro paint.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const t = readTheme()
    setTheme(t)
    apply(t)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    apply(next)
    try { localStorage.setItem(KEY, next) } catch {}
  }

  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.07] transition-all text-xs font-medium min-h-[44px]"
      aria-label={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
    >
      {isDark ? <Sun className="w-3.5 h-3.5 flex-shrink-0" /> : <Moon className="w-3.5 h-3.5 flex-shrink-0" />}
      {isDark ? 'Modo claro' : 'Modo escuro'}
    </button>
  )
}
