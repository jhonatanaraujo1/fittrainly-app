'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Cookies from 'js-cookie'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        // O backend emite o papel do aluno como STUDENT; o frontend inteiro
        // (proxy, sidebar, bottom-nav, ROLE_HOME, tipos) usa ALUNO. Normaliza
        // aqui, no único ponto de ingestão, para não espalhar o alias — assim
        // cookie e store ficam sempre em ALUNO e tudo a jusante funciona.
        const normalizedRole = (user.role as string) === 'STUDENT' ? 'ALUNO' : user.role
        const normalizedUser = { ...user, role: normalizedRole } as AuthUser
        Cookies.set('fittrainly-refresh', refreshToken, {
          expires: 90,
          sameSite: 'Strict',
        })
        Cookies.set('fittrainly-role', normalizedRole, {
          expires: 90,
          sameSite: 'Strict',
        })
        set({ user: normalizedUser, accessToken, isAuthenticated: true })
      },

      setAccessToken: (token) => set({ accessToken: token }),

      logout: () => {
        Cookies.remove('fittrainly-refresh')
        Cookies.remove('fittrainly-role')
        set({ user: null, accessToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'fittrainly-auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
)
