'use client'

// Real implementations — call the Kotlin/Spring Boot backend in production.
// Only the domains the backend already covers with a confirmed contract
// (auth, rental plans, activity types, personal trainers, billing, leads,
// session packs, physical assessments) exist here. Everything else stays in
// mock-api.ts.
//
// availability / bookings / admin-schedule / workout plans are intentionally
// NOT implemented here yet: the mock models studio-wide shared capacity
// (STUDIO_MAX_SPOTS across all PTs), while the real backend models per-PT
// capacity (Availability.maxStudents, independent per trainer). Wiring those
// domains needs a business decision on which model is correct, not just a
// field rename — see the 01/jul audit notes.
//
// Never imported directly by pages — only through api.ts (facade), which
// decides mock vs real per domain via the flags in api-config.ts.

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

// ── Rental plans ───────────────────────────────────────────────────────────────
export const planApi = {
  list: async () =>
    apiFetch<Array<{ id: string; name: string; type: string; priceHourly?: number; priceWeekly?: number; priceMonthly?: number; description?: string }>>('/api/v1/plans'),
  create: async (data: { name: string; type: string; priceHourly?: number; priceWeekly?: number; priceMonthly?: number; description?: string }) =>
    apiFetch('/api/v1/plans', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ── Activity types ────────────────────────────────────────────────────────────
// Route and fields confirmed live against the backend on 01/jul — renamed
// from /api/v1/modalidades (categoria/descricao/cor) to /api/v1/activity-types
// (category/description/color) as part of the English rename.
export const modalidadeApi = {
  list: async () => apiFetch('/api/v1/activity-types'),
  create: async (data: { name: string; category?: string; description?: string; color?: string }) =>
    apiFetch('/api/v1/activity-types', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/activity-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) =>
    apiFetch(`/api/v1/activity-types/${id}`, { method: 'DELETE' }),
}

// ── Personal Trainers ─────────────────────────────────────────────────────────
// PTResponse real uses `studentCount` (confirmed live 01/jul, after the
// English rename from `alunoCount`) — mapped explicitly below so pages built
// against the mock's `alunoCount` field keep working.
export const ptApi = {
  list: async () =>
    apiFetch<Array<Record<string, unknown>>>('/api/v1/personal-trainers')
      .then(list => list.map(pt => ({ sessionsThisMonth: pt.hoursThisMonth ?? 0, alunoCount: pt.studentCount ?? 0, ...pt }))),
  me: async () => apiFetch('/api/v1/personal-trainers/me'),
  create: async (data: { name: string; email: string; password: string; phone?: string; specialty?: string; bio?: string; planId?: string }) =>
    apiFetch('/api/v1/personal-trainers', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/personal-trainers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  byMonth: async (month?: string) => {
    const qs = month ? `?month=${encodeURIComponent(month)}` : ''
    return apiFetch<{ entries: unknown[]; total: number; month: string }>(`/api/v1/billing${qs}`)
  },
}

// ── Leads CRM ─────────────────────────────────────────────────────────────────
// Route and fields confirmed live against the backend on 01-02/jul — renamed
// from /convert-to-aluno (interesse/responsavel/planoInteresse/observacoes)
// to /convert-to-student (interest/assignedTo/interestedPlan/notes).
export const leadApi = {
  list: async () => apiFetch<Array<Record<string, unknown>>>('/api/v1/leads'),
  // Backend has no status filter on GET (lists everything and filters
  // client-side) — keeps behavior parity with the mock.
  byStatus: async (status: string) =>
    leadApi.list().then((all) => all.filter(l => l.status === status)),
  create: async (data: { name: string; email?: string; phone?: string; interest?: string; source?: string; assignedTo?: string; interestedPlan?: string; notes?: string }) =>
    apiFetch('/api/v1/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: async (id: string, status: string, data?: object) =>
    apiFetch(`/api/v1/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...data }) }),
  delete: async (id: string) => apiFetch(`/api/v1/leads/${id}`, { method: 'DELETE' }),
  convertToAluno: async (leadId: string, personalTrainerId: string) =>
    apiFetch(`/api/v1/leads/${leadId}/convert-to-student`, {
      method: 'POST', body: JSON.stringify({ personalTrainerId }),
    }),
}

// ── Session Packs (credits) ───────────────────────────────────────────────────
export const packApi = {
  byAluno: async (alunoId: string) => apiFetch(`/api/v1/session-packs?studentId=${alunoId}`),
  // GET /session-packs without studentId (all active packs tenant-wide) still
  // doesn't exist on the backend — confirmed live 01/jul (SessionPackController
  // requires @RequestParam studentId). The UI that uses this (allActive) needs
  // a new endpoint before this flag can be turned on.
  allActive: async (): Promise<unknown[]> => {
    throw new Error('packApi.allActive: endpoint ainda não existe no backend real')
  },
  create: async (data: { alunoId: string; total: number; sessionDuration: 30 | 60; expiresAt?: string }) =>
    apiFetch('/api/v1/session-packs', {
      method: 'POST',
      body: JSON.stringify({ studentId: data.alunoId, total: data.total, sessionDuration: data.sessionDuration, expiresAt: data.expiresAt }),
    }),
  // Debit happens automatically inside POST /bookings on the real backend
  // (see BookingService.create) — never a standalone frontend call.
  debitSession: async (packId: string): Promise<unknown> => {
    throw new Error('packApi.debitSession: no backend real o débito é efeito colateral da reserva, não um endpoint próprio')
  },
}

// ── Physical assessments ──────────────────────────────────────────────────────
// Route and fields confirmed live against the backend on 01/jul — renamed
// from /api/v1/avaliacoes (alunoId/tipo/data/frequenciaSemanal/peso/altura/
// percentualGordura/massaMuscular/objetivo/observacoes/proximaAvaliacao) to
// /api/v1/assessments (studentId/type/date/weeklyFrequency/weight/height/
// bodyFatPercentage/muscleMass/goal/notes/nextAssessmentDate). `height`/
// `weight` keep the same unit convention as the mock (cm / kg) — confirmed
// against mock-db.ts seed data (altura: 178, peso: 84.5, imc: 26.7).
export const avaliacaoApi = {
  byAluno: async (alunoId: string) => apiFetch(`/api/v1/assessments?studentId=${alunoId}`),
  create: async (data: { alunoId: string; tipo: string; data: string; frequenciaSemanal?: number; peso?: number; altura?: number; percentualGordura?: number; massaMuscular?: number; objetivo?: string; observacoes?: string; proximaAvaliacao?: string }) =>
    apiFetch('/api/v1/assessments', {
      method: 'POST',
      body: JSON.stringify({
        studentId: data.alunoId,
        type: data.tipo,
        date: data.data,
        weeklyFrequency: data.frequenciaSemanal,
        weight: data.peso,
        height: data.altura,
        bodyFatPercentage: data.percentualGordura,
        muscleMass: data.massaMuscular,
        goal: data.objetivo,
        notes: data.observacoes,
        nextAssessmentDate: data.proximaAvaliacao,
      }),
    }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/assessments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}
