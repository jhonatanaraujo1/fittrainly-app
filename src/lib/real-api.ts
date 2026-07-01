'use client'

// Implementações REAIS — chamam o backend Kotlin/Spring Boot em produção.
// Só existem aqui os domínios que o backend já cobre com contrato confirmado
// na auditoria (auth, planos de aluguel, modalidades, personal trainers,
// faturação). Tudo o resto continua em mock-api.ts.
//
// Nunca importado diretamente pelas páginas — só através de api.ts (facade),
// que decide mock vs real por flag em api-config.ts.

import { API_BASE_URL } from './api-config'
import { useAuthStore } from '@/store/auth'
import type { UserRole } from '@/types'

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Erro ${res.status} ao contactar o servidor`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; role: UserRole } }>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  refresh: async (refreshToken: string) =>
    apiFetch<{ accessToken: string }>('/api/v1/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refreshToken }),
    }),
}

// ── Planos de aluguel ─────────────────────────────────────────────────────────
export const planApi = {
  list: async () =>
    apiFetch<Array<{ id: string; name: string; type: string; priceHourly?: number; priceWeekly?: number; priceMonthly?: number; description?: string }>>('/api/v1/plans'),
  create: async (data: { name: string; type: string; priceHourly?: number; priceWeekly?: number; priceMonthly?: number; description?: string }) =>
    apiFetch('/api/v1/plans', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ── Modalidades ───────────────────────────────────────────────────────────────
export const modalidadeApi = {
  list: async () => apiFetch('/api/v1/modalidades'),
  create: async (data: { name: string; categoria?: string; descricao?: string; cor?: string }) =>
    apiFetch('/api/v1/modalidades', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/modalidades/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) =>
    apiFetch(`/api/v1/modalidades/${id}`, { method: 'DELETE' }),
}

// ── Personal Trainers ─────────────────────────────────────────────────────────
// NOTA: backend não confirma se retorna `sessionsThisMonth` no list — usar
// fallback 0 até validar o DTO exato (PTResponse) contra o Swagger/OpenAPI.
export const ptApi = {
  list: async () =>
    apiFetch<Array<Record<string, unknown>>>('/api/v1/personal-trainers')
      .then(list => list.map(pt => ({ sessionsThisMonth: 0, ...pt }))),
  me: async () => apiFetch('/api/v1/personal-trainers/me'),
  create: async (data: { name: string; email: string; password: string; phone?: string; specialty?: string; bio?: string; planId?: string }) =>
    apiFetch('/api/v1/personal-trainers', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/personal-trainers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ── Faturação ─────────────────────────────────────────────────────────────────
export const billingApi = {
  byMonth: async (month?: string) => {
    const qs = month ? `?month=${encodeURIComponent(month)}` : ''
    return apiFetch<{ entries: unknown[]; total: number; month: string }>(`/api/v1/billing${qs}`)
  },
}
