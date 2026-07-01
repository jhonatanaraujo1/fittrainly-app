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
// PTResponse real usa `hoursThisMonth` (confirmado lendo PTDtos.kt), não
// `sessionsThisMonth` como o mock — mapeado explicitamente abaixo.
export const ptApi = {
  list: async () =>
    apiFetch<Array<Record<string, unknown>>>('/api/v1/personal-trainers')
      .then(list => list.map(pt => ({ sessionsThisMonth: pt.hoursThisMonth ?? 0, ...pt }))),
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

// ── Leads CRM ─────────────────────────────────────────────────────────────────
// Testado ao vivo contra o backend real em 01/jul (curl manual) — contrato
// confirmado, não é só leitura de código. Ver com.fittrainly.lead.*
export const leadApi = {
  list: async () => apiFetch<Array<Record<string, unknown>>>('/api/v1/leads'),
  // Backend não tem filtro por status no GET (lista tudo e filtra no
  // frontend) — mantém paridade de comportamento com o mock.
  byStatus: async (status: string) =>
    leadApi.list().then((all) => all.filter(l => l.status === status)),
  create: async (data: { name: string; email?: string; phone?: string; interesse?: string; source?: string; responsavel?: string; planoInteresse?: string; observacoes?: string }) =>
    apiFetch('/api/v1/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: async (id: string, status: string, data?: object) =>
    apiFetch(`/api/v1/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...data }) }),
  delete: async (id: string) => apiFetch(`/api/v1/leads/${id}`, { method: 'DELETE' }),
  convertToAluno: async (leadId: string, personalTrainerId: string) =>
    apiFetch(`/api/v1/leads/${leadId}/convert-to-aluno`, {
      method: 'POST', body: JSON.stringify({ personalTrainerId }),
    }),
}

// ── Session Packs (créditos) ──────────────────────────────────────────────────
export const packApi = {
  byAluno: async (alunoId: string) => apiFetch(`/api/v1/session-packs?alunoId=${alunoId}`),
  // GET /session-packs sem alunoId (todos os ativos do tenant) não existe no
  // backend ainda — a UI que usa isto (allActive) precisa de endpoint novo
  // antes de ligar esta flag.
  allActive: async (): Promise<unknown[]> => {
    throw new Error('packApi.allActive: endpoint ainda não existe no backend real')
  },
  create: async (data: { alunoId: string; total: number; sessionDuration: 30 | 60; expiresAt?: string }) =>
    apiFetch('/api/v1/session-packs', { method: 'POST', body: JSON.stringify(data) }),
  // Débito acontece automaticamente dentro de POST /bookings no backend real
  // (ver BookingService.create) — nunca é uma chamada isolada do frontend.
  debitSession: async (packId: string): Promise<unknown> => {
    throw new Error('packApi.debitSession: no backend real o débito é efeito colateral da reserva, não um endpoint próprio')
  },
}

// ── Avaliações Físicas ────────────────────────────────────────────────────────
export const avaliacaoApi = {
  byAluno: async (alunoId: string) => apiFetch(`/api/v1/avaliacoes?alunoId=${alunoId}`),
  create: async (data: { alunoId: string; tipo: string; data: string; frequenciaSemanal?: number; peso?: number; altura?: number; percentualGordura?: number; massaMuscular?: number; objetivo?: string; observacoes?: string; proximaAvaliacao?: string }) =>
    apiFetch('/api/v1/avaliacoes', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/avaliacoes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}
