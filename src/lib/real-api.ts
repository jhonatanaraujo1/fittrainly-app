'use client'

// Real implementations — call the Kotlin/Spring Boot backend in production.
// Domains covered here (confirmed live against the backend on 07-08/jul):
// auth, rental plans, activity types, personal trainers, billing, leads,
// session packs, physical assessments, availability, bookings, admin
// schedule, studio schedule, dashboards, alunos/students, plan tiers, PT
// weekly payment cycle, workout plans.
//
// IMPORTANT — data model mismatch with the mock (read this before touching
// availability/booking/adminSchedule code):
// The mock models a slot as a shared "slotKey" (date+time) that ANY PT can
// release into and that has one shared studio-wide occupancy counter
// (STUDIO_MAX_SPOTS = 4 across all PTs). The real backend models Availability
// as a per-PT entity with its own UUID (Availability.maxStudents = 1, always
// 1-on-1 — see Availability.kt). The studio-wide shared cap (Tenant
// .studioCapacity, confirmed = 4 in the seed) is enforced server-side only
// inside BookingService.create (counts confirmed bookings across ALL PTs at
// the exact same startTime) — there is no client-visible "studio slot
// grid cell" the way the mock materializes one. The adapters below preserve
// the mock's return SHAPE (so existing pages keep compiling/working) but
// synthesize the grid/slotKey fields from the flat list of per-PT
// Availability rows the backend actually returns. `studioCount` per cell is
// derived by grouping the flat list by exact startTime, which is exactly
// what the backend itself does for the shared cap — same semantics, just
// computed client-side for display instead of served pre-grouped.
//
// Never imported directly by pages — only through api.ts (facade), which
// decides mock vs real per domain via the flags in api-config.ts.

import Cookies from 'js-cookie'
import { API_BASE_URL } from './api-config'
import { useAuthStore } from '@/store/auth'
import { generateTempPassword, sendCredentialsEmail } from './notify'
import type { UserRole } from '@/types'

// Single-flight refresh: many queries fire in parallel, and when the access
// token has expired they'd all 401 at once. We only want ONE /auth/refresh
// call for that burst — everyone awaits the same promise, then retries with
// the new token.
let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = Cookies.get('fittrainly-refresh')
  if (!refreshToken) return null
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { accessToken: string }
    useAuthStore.getState().setAccessToken(data.accessToken)
    return data.accessToken
  } catch {
    return null
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = useAuthStore.getState().accessToken
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      // FormData tem de definir o próprio Content-Type: o browser gera um
      // boundary único que vai no header. Forçar application/json aqui fazia o
      // servidor receber um multipart sem boundary e rejeitar o upload.
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  // Access token expired → refresh once and replay the request. Auth
  // endpoints are excluded so a wrong-password 401 (or the refresh call
  // itself) never triggers a refresh loop.
  if (res.status === 401 && retry && !path.includes('/auth/')) {
    if (!refreshInFlight) {
      refreshInFlight = refreshAccessToken().finally(() => { refreshInFlight = null })
    }
    const newToken = await refreshInFlight
    if (newToken) return apiFetch<T>(path, options, false)

    // Refresh failed — the session is truly over. Clear it and bounce to
    // login instead of leaving pages silently broken (blank agenda, empty
    // billing) with a stale token.
    useAuthStore.getState().logout()
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new Error('Sessão expirada. Faz login novamente.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Erro ${res.status} ao contactar o servidor`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Shared helpers for availability/booking adapters ──────────────────────
interface RealAvailability {
  id: string
  personalTrainerId: string
  personalTrainerName: string
  startTime: string
  endTime: string
  maxStudents: number
  confirmedCount: number
  availableSlots: number
  // Preenchido pelo GET /admin/schedule (listAllByRange carrega as reservas do
  // intervalo em bloco). Vazio nos endpoints PT/aluno.
  studentNames?: string[]
}

const STUDIO_MAX_SPOTS_FALLBACK = 4 // matches Tenant.studioCapacity seed default; real cap is enforced server-side

// V14: slot cadence (grid step) is locked at 60min; the class length is
// configurable per studio via GET /api/v1/studio-config. A slot occupies
// [start, start+classDuration), with slotStep as the row spacing. This
// fallback matches the backend defaults so the grid still renders if the
// config call fails.
const DEFAULT_STUDIO_CONFIG = { slotDurationMinutes: 30, classDurationMinutes: 30 }

// Studio open-hours fallback — mirrors backend StudioScheduleService.DEFAULT_HOURS
// and mock-db `studioSchedule`. Used to draw the empty grid so a fresh studio
// (zero availabilities) still shows clickable cells. The admin grid overlays
// the tenant's real weekly-hours on top of this; the PT grid uses it directly
// because the weekly-hours endpoint is ADMIN-only.
const DEFAULT_STUDIO_HOURS: Record<number, [string, string] | null> = {
  0: null, // Sunday — closed
  1: ['07:00', '20:20'], 2: ['07:00', '20:20'], 3: ['07:00', '20:20'],
  4: ['07:00', '20:20'], 5: ['07:00', '20:20'],
  6: ['09:00', '13:00'],
}

// ── Grid-synthesis helpers (port of mock-db slot maths) ────────────────────
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
function addMinutesToTime(time: string, mins: number): string {
  return minutesToTime(timeToMinutes(time) + mins)
}
// Slot start times within [open, close): step by the studio cadence
// (slotStep, locked at 60), including a start only if a full class fits
// before close. Matches mock-db.getSlotTimesForDay so cell keys line up.
function slotTimesForHours(open: string | null, close: string | null, slotStep: number, classDuration: number, lunchStart: string | null = null, lunchEnd: string | null = null): string[] {
  if (!open || !close) return []
  const ls = lunchStart ? timeToMinutes(lunchStart) : null
  const le = lunchEnd ? timeToMinutes(lunchEnd) : null
  const out: string[] = []
  for (let t = timeToMinutes(open); t + classDuration <= timeToMinutes(close); t += slotStep) {
    if (ls !== null && le !== null && t < le && ls < t + classDuration) continue // cai na pausa de almoço
    out.push(minutesToTime(t))
  }
  return out
}
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Every "YYYY-MM-DD" in [startDate, endDate] inclusive, built from the local
// calendar (avoids +24h DST drift).
function eachDateStr(startDate: string, endDate: string): string[] {
  const out: string[] = []
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const cur = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  while (cur <= end) {
    out.push(localDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}
function dowOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() // 0=Sun .. 6=Sat — same convention as backend
}
// A class at `time` on `date` occupies [start, start+classDuration); it's
// blocked if that interval overlaps any block.
function slotBlock(
  blocks: Array<{ id: string; date: string; startTime: string; endTime: string; reason: string }>,
  date: string, time: string, classDuration: number,
): { id: string; reason: string } | null {
  const s = timeToMinutes(time)
  const e = s + classDuration
  for (const b of blocks) {
    if (b.date !== date) continue
    if (s < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < e) return { id: b.id, reason: b.reason }
  }
  return null
}

// Studio slot config (V14): cadence + class length. GET is any-authenticated,
// PATCH is admin-only. Fallback keeps the grid working if the call fails.
async function fetchStudioConfig(): Promise<{ slotDurationMinutes: number; classDurationMinutes: number }> {
  return studioConfigApi.get().catch(() => DEFAULT_STUDIO_CONFIG)
}

// End instant of a class starting at slotTime, from the studio's class length.
async function classEndISO(date: string, slotTime: string): Promise<string> {
  const { classDurationMinutes } = await fetchStudioConfig()
  return `${date}T${addMinutesToTime(slotTime, classDurationMinutes)}:00Z`
}

interface StudioConfig {
  slotDurationMinutes: number
  classDurationMinutes: number
  studioCapacity: number
  maxStudentsPerTrainer: number
  name: string
  slug: string
  privacyPolicyUrl: string | null
  leadCaptureEnabled: boolean
}
interface StudioSettingsPatch {
  slotDurationMinutes?: number
  classDurationMinutes?: number
  // Lotação da agenda: quantas pessoas cabem na sala, e quantos alunos cada
  // PT atende ao mesmo tempo.
  studioCapacity?: number
  maxStudentsPerTrainer?: number
  name?: string
  privacyPolicyUrl?: string | null
  leadCaptureEnabled?: boolean
}

export const studioConfigApi = {
  get: async () => apiFetch<StudioConfig>('/api/v1/studio-config'),
  // Duração de aula — assinatura antiga mantida (usada na Agenda).
  update: async (classDurationMinutes: number) =>
    apiFetch<StudioConfig>('/api/v1/studio-config', {
      method: 'PATCH', body: JSON.stringify({ classDurationMinutes }),
    }),
  // PATCH parcial das configs do estúdio (identidade + captura de leads).
  updateSettings: async (patch: StudioSettingsPatch) =>
    apiFetch<StudioConfig>('/api/v1/studio-config', {
      method: 'PATCH', body: JSON.stringify(patch),
    }),
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
  // Público — nunca revela se o email existe (ForgotPasswordResponse é
  // sempre a mesma mensagem genérica, confirmado no AuthDtos.kt do backend:
  // "CRÍTICO: nunca adicionar tempPassword aqui"). Diferente do mock, que
  // devolve a tempPassword diretamente quando o envio de email falha — no
  // backend real isso nunca acontece, o fluxo de recuperação depende 100% do
  // envio de email funcionar.
  forgotPassword: async (email: string) =>
    apiFetch<{ message: string }>('/api/v1/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email }),
    }),
  // Passo 2a: confirma o código (não consome). Passo 2b: código + nova senha.
  verifyResetCode: async (email: string, code: string) =>
    apiFetch<{ valid: boolean }>('/api/v1/auth/reset-password/verify', {
      method: 'POST', body: JSON.stringify({ email, code }),
    }),
  resetPassword: async (email: string, code: string, newPassword: string) =>
    apiFetch<void>('/api/v1/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ email, code, newPassword }),
    }),
  // userId é ignorado — o backend identifica o utilizador pelo JWT
  // autenticado (UserDetailsImpl), nunca por um id no corpo/rota. Mantido no
  // parâmetro só para bater com a assinatura que as páginas já chamam.
  changePassword: async (_userId: string, currentPassword: string, newPassword: string) =>
    apiFetch<void>('/api/v1/auth/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
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
// Os forms de PT guardam datas vazias como '' (string vazia). No backend estes
// campos são LocalDate — mandar "" faz o Jackson rebentar com 400. Omitimos as
// chaves de data vazias em vez de as enviar em branco.
const PT_DATE_FIELDS = ['teefValidUntil', 'insuranceValidUntil'] as const
function stripEmptyPtDates<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data }
  for (const k of PT_DATE_FIELDS) {
    const v = out[k]
    if (v === '' || v === null) delete out[k]
  }
  return out
}

export const ptApi = {
  list: async () =>
    apiFetch<Array<Record<string, unknown>>>('/api/v1/personal-trainers')
      .then(list => list.map(pt => ({ sessionsThisMonth: pt.hoursThisMonth ?? 0, alunoCount: pt.studentCount ?? 0, ...pt }))),
  me: async () => apiFetch('/api/v1/personal-trainers/me'),
  // Password é gerada no servidor; o backend devolve temporaryPassword na criação.
  create: async (data: { name: string; email: string; phone?: string; specialty?: string; bio?: string; planId?: string; teefNumber?: string; teefValidUntil?: string; insuranceValidUntil?: string }) =>
    apiFetch<{ temporaryPassword?: string } & Record<string, unknown>>('/api/v1/personal-trainers', { method: 'POST', body: JSON.stringify(stripEmptyPtDates(data)) }),
  update: async (id: string, data: object) =>
    apiFetch(`/api/v1/personal-trainers/${id}`, { method: 'PATCH', body: JSON.stringify(stripEmptyPtDates(data as Record<string, unknown>)) }),
  // Confirmado live 07/jul: POST /personal-trainers/{id}/reset-password
  // (ADMIN only) devolve exatamente { tempPassword, emailSent } —
  // mesmo shape do mock (adminResetPassword), sem rename necessário.
  resetPassword: async (id: string) =>
    apiFetch<{ tempPassword: string; emailSent: boolean }>(`/api/v1/personal-trainers/${id}/reset-password`, {
      method: 'POST',
    }),
  // Self-service: PATCH /personal-trainers/me (PERSONAL_TRAINER-only). O PT
  // edita contacto + fiscal do próprio perfil, nunca plano/estado.
  updateOwnProfile: async (data: {
    name?: string; email?: string; phone?: string; specialty?: string; specialties?: string[]; bio?: string
    taxId?: string; address?: string
  }) => apiFetch('/api/v1/personal-trainers/me', { method: 'PATCH', body: JSON.stringify(data) }),
}

// ── Documentos do PT (seguro / TEEF / outros) ─────────────────────────────────
export interface PtDocument {
  id: string; type: 'SEGURO' | 'TEEF' | 'OUTRO'; fileName: string
  contentType: string; sizeBytes: number; validUntil: string | null; uploadedAt: string
}
export const ptDocumentApi = {
  list: async (ptId: string) =>
    apiFetch<PtDocument[]>(`/api/v1/personal-trainers/${ptId}/documents`),
  // Upload é multipart → não passa pelo apiFetch (que força JSON). Fetch cru
  // com o token, deixando o browser pôr o boundary do multipart.
  upload: async (ptId: string, data: { type: string; file: File; validUntil?: string | null }) => {
    const fd = new FormData()
    fd.append('type', data.type)
    fd.append('file', data.file)
    if (data.validUntil) fd.append('validUntil', data.validUntil)
    const token = useAuthStore.getState().accessToken
    const res = await fetch(`${API_BASE_URL}/api/v1/personal-trainers/${ptId}/documents`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message ?? `Erro ${res.status} ao enviar o documento`)
    }
    return res.json() as Promise<PtDocument>
  },
  // Endpoint autenticado → não dá para usar <a href> direto; puxa como blob.
  download: async (ptId: string, docId: string) => {
    const token = useAuthStore.getState().accessToken
    const res = await fetch(`${API_BASE_URL}/api/v1/personal-trainers/${ptId}/documents/${docId}/download`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) throw new Error(`Erro ${res.status} ao abrir o documento`)
    return res.blob()
  },
  remove: async (ptId: string, docId: string) =>
    apiFetch<void>(`/api/v1/personal-trainers/${ptId}/documents/${docId}`, { method: 'DELETE' }),
}

// ── Documentos do aluno ───────────────────────────────────────────────────────
// Mesmo padrão dos documentos do PT. Por agora só o contrato de anamnese —
// o backend aceita mais tipos sem migração, basta acrescentar aqui.
export interface StudentDocument {
  id: string; type: 'CONTRATO_ANAMNESE'; fileName: string
  contentType: string; sizeBytes: number; validUntil: string | null; uploadedAt: string
}
export const studentDocumentApi = {
  list: async (studentId: string) =>
    apiFetch<StudentDocument[]>(`/api/v1/students/${studentId}/documents`),
  upload: async (studentId: string, data: { type: string; file: File; validUntil?: string | null }) => {
    const fd = new FormData()
    fd.append('type', data.type)
    fd.append('file', data.file)
    if (data.validUntil) fd.append('validUntil', data.validUntil)
    const token = useAuthStore.getState().accessToken
    const res = await fetch(`${API_BASE_URL}/api/v1/students/${studentId}/documents`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.message ?? `Erro ${res.status} ao enviar o documento`)
    }
    return res.json() as Promise<StudentDocument>
  },
  download: async (studentId: string, docId: string) => {
    const token = useAuthStore.getState().accessToken
    const res = await fetch(`${API_BASE_URL}/api/v1/students/${studentId}/documents/${docId}/download`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) throw new Error(`Erro ${res.status} ao abrir o documento`)
    return res.blob()
  },
  remove: async (studentId: string, docId: string) =>
    apiFetch<void>(`/api/v1/students/${studentId}/documents/${docId}`, { method: 'DELETE' }),
}

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  byMonth: async (month?: string) => {
    const qs = month ? `?month=${encodeURIComponent(month)}` : ''
    return apiFetch<{ entries: unknown[]; total: number; month: string }>(`/api/v1/billing${qs}`)
  },
}

// ── Cobrança semanal do PT + inadimplência ────────────────────────────────────
export interface PtWeeklyCharge {
  ptId: string; ptName: string; planName: string | null
  periodStart: string; periodEnd: string; dueDate: string
  hours: number; amountDue: number; amountPaid: number; balance: number
  status: 'PAGO' | 'PARCIAL' | 'EM_ABERTO' | 'VENCIDO'; recorded: boolean
}
export interface PtWeeklyOverview {
  periodStart: string; periodEnd: string; dueDate: string
  entries: PtWeeklyCharge[]; totalDue: number; totalPaid: number; totalBalance: number
}
export interface DelinquentPt {
  ptId: string; ptName: string; planName: string | null
  totalOwed: number; weeksOverdue: number; oldestPeriodStart: string
  daysLate: number; periods: PtWeeklyCharge[]
}
export interface DelinquencyReport {
  asOf: string; trainers: DelinquentPt[]; totalOwed: number
}
// (os métodos semanais/inadimplência vivem no ptPaymentApi já existente,
//  mais abaixo — ver "PT weekly payment cycle")

// ── Leads CRM ─────────────────────────────────────────────────────────────────
// Route and fields confirmed live against the backend on 01-02/jul — renamed
// from /convert-to-aluno (interesse/responsavel/planoInteresse/observacoes)
// to /convert-to-student (interest/assignedTo/interestedPlan/notes).
// O backend usa LeadStatus em INGLÊS (NEW/CONTACTED/…); a CRM (e o mock)
// usam PORTUGUÊS (NOVO/CONTACTADO/…). Sem traduzir, os leads chegam com um
// status que não bate com nenhuma coluna → "0 leads no pipeline" mesmo com
// leads no banco. Bug real, invisível ao tsc (lead é tipado solto).
const LEAD_STATUS_EN_TO_PT: Record<string, string> = {
  NEW: 'NOVO', CONTACTED: 'CONTACTADO', VISIT_SCHEDULED: 'VISITA_AGENDADA',
  VISITED: 'VISITOU', ENROLLED: 'INSCRITO', NO_FEEDBACK: 'NAO_DEU_FEEDBACK',
  LOST: 'PERDIDO', ARCHIVED: 'ARQUIVADO',
}
const LEAD_STATUS_PT_TO_EN: Record<string, string> =
  Object.fromEntries(Object.entries(LEAD_STATUS_EN_TO_PT).map(([en, pt]) => [pt, en]))

// LeadResponse (backend) → MockLead (o shape que a CRM lê). O mock renomeia
// vários campos, então mapeamos todos — senão o lead aparece mas com
// interesse/responsável/observações vazios.
function mapLead(r: Record<string, unknown>) {
  return {
    id: r.id, name: r.name, email: r.email ?? undefined, phone: r.phone ?? undefined,
    status: LEAD_STATUS_EN_TO_PT[r.status as string] ?? r.status,
    interesse: r.interest ?? undefined,
    source: r.source ?? undefined,
    responsavel: r.assignedTo ?? undefined,
    visitaDate: r.visitDate ?? undefined,
    observacoes: r.notes ?? undefined,
    tags: (r.tags as string[]) ?? [],
    planoInteresse: r.interestedPlan ?? undefined,
    followUpDate: r.followUpDate ?? undefined,
    inscritoEm: r.enrolledAt ?? undefined,
    createdAt: r.createdAt, updatedAt: r.updatedAt,
    // Respostas aos campos próprios do formulário — sem isto o estúdio
    // configura perguntas e nunca vê as respostas no CRM.
    customAnswers: (r.customAnswers as Array<{ fieldId: string; label: string; value: string }>) ?? [],
  }
}

// Campos PT (que a CRM manda em updateStatus/create) → EN (o que o backend
// espera). Só os presentes são reescritos.
function leadPayloadPtToEn(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {}
  const map: Record<string, string> = {
    interesse: 'interest', responsavel: 'assignedTo', observacoes: 'notes',
    planoInteresse: 'interestedPlan', visitaDate: 'visitDate',
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) out[map[k] ?? k] = v
  return out
}

// ── Formulário de captura configurável ────────────────────────────────────────
export type LeadFieldType = 'TEXT' | 'TEXTAREA' | 'RADIO' | 'CHECKBOX' | 'SELECT'
export interface LeadFormField {
  id: string
  label: string
  type: LeadFieldType
  required: boolean
  options: string[]
  placeholder?: string | null
}
export interface LeadFormConfig {
  logoUrl: string | null
  headline: string | null
  subheadline: string | null
  fields: LeadFormField[]
  maxFields: number
}

export const leadFormApi = {
  get: async () => apiFetch<LeadFormConfig>('/api/v1/admin/lead-form'),
  update: async (patch: { headline?: string | null; subheadline?: string | null; fields?: LeadFormField[] }) =>
    apiFetch<LeadFormConfig>('/api/v1/admin/lead-form', { method: 'PUT', body: JSON.stringify(patch) }),
  // multipart: NÃO definir content-type à mão — o browser tem de gerar o
  // boundary. Por isso não passa pelo apiFetch, que força application/json.
  uploadLogo: async (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch<LeadFormConfig>('/api/v1/admin/lead-form/logo', { method: 'POST', body })
  },
  removeLogo: async () => apiFetch<LeadFormConfig>('/api/v1/admin/lead-form/logo', { method: 'DELETE' }),
}

export const leadApi = {
  // Backend pagina GET /leads (Page<LeadResponse>). Desempacota .content E
  // traduz cada lead (status EN→PT + campos renomeados) para o shape da CRM.
  list: async () =>
    apiFetch<{ content: Array<Record<string, unknown>> }>('/api/v1/leads?size=200')
      .then((page) => page.content.map(mapLead)),
  byStatus: async (status: string) =>
    leadApi.list().then((all) => all.filter(l => l.status === status)),
  create: async (data: { name: string; email?: string; phone?: string; interest?: string; source?: string; assignedTo?: string; interestedPlan?: string; notes?: string }) =>
    apiFetch('/api/v1/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: async (id: string, status: string, data?: object) =>
    apiFetch(`/api/v1/leads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: LEAD_STATUS_PT_TO_EN[status] ?? status,
        ...leadPayloadPtToEn(data as Record<string, unknown>),
      }),
    }),
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
  create: async (data: { alunoId: string; total: number; sessionDuration: number; expiresAt?: string }) =>
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
  byAluno: async (alunoId: string) =>
    apiFetch<RealStudent[]>(`/api/v1/assessments?studentId=${alunoId}`).then(l => l.map(assessmentToMock)),
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

// ── Availability — PT releases studio slots ───────────────────────────────────
// Confirmed live 07-08/jul. See the model-mismatch note at the top of this
// file: the backend has no "studio grid cell" concept — each row here is one
// PT's own Availability row. The grid/slotKey-shaped methods below
// synthesize that view client-side from GET /admin/schedule (all PTs) or
// GET /availability (own PT only).
export const availabilityApi = {
  // mock signature: studioGrid(startDate, endDate) -> per-slot grid rows
  // shaped { date, slotTime, startTime, endTime, released, releaseId,
  // studioCount, myBookings, studioMax, alunoNames }. Built by fetching the
  // current PT's own availability rows (GET /availability) for the "released"
  // flag/myBookings, plus the admin-wide schedule to compute the shared
  // studio-wide occupancy per exact startTime (studioCount). A PT (not
  // ADMIN) can't call GET /admin/schedule (403), so studioCount here is
  // approximated from the PT's own rows only — the true cross-PT count is
  // only ever enforced server-side at booking time (BookingService.create).
  // This mirrors what a PT is *allowed* to see (their own releases), not a
  // full admin view (see adminScheduleApi for that).
  studioGrid: async (startDate: string, endDate: string) => {
    const start = new Date(startDate).toISOString()
    const end = new Date(endDate).toISOString()
    const [mine, config, blocks, weekly] = await Promise.all([
      apiFetch<RealAvailability[]>(
        `/api/v1/availability?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
      ),
      fetchStudioConfig(),
      // #10 — fechos do estúdio (rota PT-readable). Degrada para [] se falhar.
      studioScheduleApi.listBlocksReadonly(startDate, endDate).catch(() => [] as Array<{ id: string; date: string; startTime: string; endTime: string; reason: string }>),
      // Horas reais do estúdio, mesma fonte que a agenda do admin usa.
      studioScheduleApi.getWeeklyHoursReadonly().catch(() => [] as Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null; lunchStart: string | null; lunchEnd: string | null }>),
    ])

    // Horas configuradas por dia da semana (backend serializa LocalTime como
    // "HH:mm:ss"). Cai nos defaults partilhados só para os dias que o estúdio
    // ainda não configurou — um estúdio novo continua a ter grelha.
    const hoursByDow = new Map<number, [string | null, string | null]>()
    const lunchByDow = new Map<number, [string | null, string | null]>()
    for (const w of weekly) {
      hoursByDow.set(w.dayOfWeek, [w.openTime ? w.openTime.slice(0, 5) : null, w.closeTime ? w.closeTime.slice(0, 5) : null])
      lunchByDow.set(w.dayOfWeek, [w.lunchStart ? w.lunchStart.slice(0, 5) : null, w.lunchEnd ? w.lunchEnd.slice(0, 5) : null])
    }

    // Index the PT's own releases by cell key (backend UTC slice).
    const mineByCell = new Map<string, RealAvailability>()
    for (const a of mine) mineByCell.set(`${a.startTime.slice(0, 10)}-${a.startTime.slice(11, 16)}`, a)

    // Draw the FULL week grid from studio open-hours, not just the rows that
    // already exist — otherwise a fresh studio (zero availabilities) renders
    // an empty grid with no black "click to release" cells, making it
    // impossible to create the first slot. weekly-hours is ADMIN-only, so the
    // PT grid uses the shared default hours (same as backend fallback).
    const out: Array<{
      date: string; slotTime: string; startTime: string; endTime: string
      released: boolean; releaseId?: string
      studioCount: number; myBookings: number; studioMax: number; alunoNames: string[]
      blocked: boolean; blockReason?: string
    }> = []
    for (const date of eachDateStr(startDate, endDate)) {
      const dow = dowOf(date)
      const hours = hoursByDow.get(dow) ?? DEFAULT_STUDIO_HOURS[dow] ?? [null, null]
      const lunch = lunchByDow.get(dow) ?? [null, null]
      for (const time of slotTimesForHours(hours[0], hours[1], config.slotDurationMinutes, config.classDurationMinutes, lunch[0], lunch[1])) {
        const a = mineByCell.get(`${date}-${time}`)
        const blk = slotBlock(blocks, date, time, config.classDurationMinutes)
        out.push({
          date, slotTime: time,
          startTime: a ? a.startTime : `${date}T${time}:00Z`,
          endTime: a ? a.endTime : `${date}T${addMinutesToTime(time, config.classDurationMinutes)}:00Z`,
          released: !!a,
          releaseId: a?.id,
          blocked: !!blk,
          blockReason: blk?.reason,
          // Cross-PT studio occupancy isn't visible to a PERSONAL_TRAINER —
          // only their own confirmedCount is known here. The studio-wide cap
          // is still enforced server-side regardless of what the UI displays.
          studioCount: a ? a.confirmedCount : 0,
          myBookings: a ? a.confirmedCount : 0,
          studioMax: STUDIO_MAX_SPOTS_FALLBACK,
          alunoNames: [] as string[],
        })
      }
    }
    return out
  },

  // Legacy mock method — kept for API-shape parity, delegates to the same
  // GET /availability the studioGrid uses.
  mySlots: async (startDate: string, endDate: string) => {
    const start = new Date(startDate).toISOString()
    const end = new Date(endDate).toISOString()
    const rows = await apiFetch<RealAvailability[]>(
      `/api/v1/availability?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
    )
    return rows.map(r => ({
      id: r.id,
      personalTrainerId: r.personalTrainerId,
      personalTrainerName: r.personalTrainerName,
      startTime: r.startTime,
      endTime: r.endTime,
      maxAlunos: r.maxStudents,
      confirmedCount: r.confirmedCount,
      availableSlots: r.availableSlots,
      myBookings: r.confirmedCount,
    }))
  },

  // Aluno-facing: slots released by their own PT, with isBooked info.
  // GET /availability/pt/{ptId} — any authenticated user, service enforces
  // tenant match.
  ptSlots: async (ptId: string, startDate: string, endDate: string) => {
    const start = new Date(startDate).toISOString()
    const end = new Date(endDate).toISOString()
    const rows = await apiFetch<RealAvailability[]>(
      `/api/v1/availability/pt/${ptId}?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
    )
    // isBooked requires knowing which of these the current student already
    // holds a CONFIRMED booking for — cross-referenced against /bookings/my
    // (student-scoped) since Availability itself doesn't carry per-student
    // booking state (only aggregate confirmedCount).
    const myBookings = await apiFetch<Array<{ availabilityId: string; status: string }>>('/api/v1/bookings/my').catch(() => [])
    const bookedIds = new Set(myBookings.filter(b => b.status === 'CONFIRMED').map(b => b.availabilityId))
    return rows.map(r => ({
      id: r.id,
      personalTrainerId: r.personalTrainerId,
      personalTrainerName: r.personalTrainerName,
      startTime: r.startTime,
      endTime: r.endTime,
      maxAlunos: r.maxStudents,
      confirmedCount: r.confirmedCount,
      availableSlots: r.availableSlots,
      isBooked: bookedIds.has(r.id),
      // sessionDuration/packRemaining aren't part of AvailabilityResponse —
      // computed from the slot's own duration and left for the caller
      // (dashboardApi/alunoApi) to enrich with the active pack separately.
      sessionDuration: Math.round((new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000),
      packRemaining: 0,
    }))
  },

  // Libertação em bloco: 1 request para a semana inteira em vez de um POST por
  // slot em série (era ~150 round-trips e dezenas de segundos). O backend
  // avalia cada slot isoladamente, por isso um slot no passado ou bloqueado é
  // ignorado com motivo em vez de abortar o lote.
  createBatch: async (slots: Array<{ date: string; slotTime: string; endTime?: string }>) => {
    if (slots.length === 0) return { created: 0, skipped: 0, results: [] }
    const config = await fetchStudioConfig()
    const payload = slots.map(s => ({
      startTime: `${s.date}T${s.slotTime}:00Z`,
      endTime: s.endTime ?? `${s.date}T${addMinutesToTime(s.slotTime, config.classDurationMinutes)}:00Z`,
    }))
    return apiFetch<{ created: number; skipped: number; results: Array<{ startTime: string; created: boolean; reason: string | null }> }>(
      '/api/v1/availability/batch',
      { method: 'POST', body: JSON.stringify({ slots: payload }) },
    )
  },

  // PT releases a slot — POST /availability { startTime, endTime }, no
  // slotTime/date split like the mock (real Availability rows carry full
  // ISO instants for both bounds). The 40-minute mock convention doesn't
  // apply — the real endTime must be provided by the caller.
  create: async (data: { date: string; slotTime: string; endTime?: string }) => {
    const startISO = `${data.date}T${data.slotTime}:00Z`
    const endISO = data.endTime ?? await classEndISO(data.date, data.slotTime)
    return apiFetch<RealAvailability>('/api/v1/availability', {
      method: 'POST',
      body: JSON.stringify({ startTime: startISO, endTime: endISO }),
    })
  },

  // Admin creates a release on behalf of a PT — POST /admin/schedule
  // { ptId, startTime, endTime }.
  createForPT: async (data: { ptId: string; date: string; slotTime: string; endTime?: string }) => {
    const startISO = `${data.date}T${data.slotTime}:00Z`
    const endISO = data.endTime ?? await classEndISO(data.date, data.slotTime)
    return apiFetch<RealAvailability>('/api/v1/admin/schedule', {
      method: 'POST',
      body: JSON.stringify({ ptId: data.ptId, startTime: startISO, endTime: endISO }),
    })
  },

  // PT removes their own release — DELETE /availability/{id}. Note:
  // releaseId here MUST be the real Availability UUID, not a "date-time"
  // slotKey the mock used — callers built against the mock's slotKey format
  // need to pass through the `id`/`releaseId` field this file's studioGrid/
  // mySlots already return as the real UUID.
  delete: async (releaseId: string) => apiFetch<void>(`/api/v1/availability/${releaseId}`, { method: 'DELETE' }),

  // Attendees for a specific PT's own slot — GET /admin/schedule/{id}/attendees
  // also serves PERSONAL_TRAINER (service checks the slot belongs to them).
  attendees: async (slotKey: string) =>
    apiFetch<Array<{ studentId: string; studentName: string; status: string }>>(
      `/api/v1/admin/schedule/${slotKey}/attendees`,
    ).then(rows => rows.map(r => ({ bookingId: r.studentId, alunoId: r.studentId, alunoName: r.studentName, status: r.status }))),
}

// ── Admin Schedule ────────────────────────────────────────────────────────────
// Confirmed live 07/jul: GET /admin/schedule returns a FLAT array of
// AvailabilityResponse (one row per PT per released slot), not a grid
// pre-grouped by date+time+PT the way the mock's adminScheduleApi.list
// returns. Grouped here client-side to keep the exact same return shape.
export const adminScheduleApi = {
  list: async (startDate: string, endDate: string) => {
    const start = new Date(startDate).toISOString()
    const end = new Date(endDate).toISOString()

    // Fetch the three inputs in parallel: existing releases, the studio's
    // configured weekly hours, and one-off blocks. weekly-hours/blocks are
    // ADMIN-only and this list() is only ever called from the admin agenda,
    // so they're available here. Both degrade gracefully to [] on failure.
    const [rows, weekly, blocks, config] = await Promise.all([
      apiFetch<RealAvailability[]>(
        `/api/v1/admin/schedule?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
      ).catch(() => [] as RealAvailability[]),
      studioScheduleApi.getWeeklyHours().catch(() => [] as Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null; lunchStart: string | null; lunchEnd: string | null }>),
      studioScheduleApi.listBlocks(startDate, endDate).catch(() => [] as Array<{ id: string; date: string; startTime: string; endTime: string; reason: string }>),
      fetchStudioConfig(),
    ])

    // Index existing releases by cell key (backend UTC slice). Grouping by
    // exact date+time mirrors how the backend computes the shared studio-wide
    // cap in BookingService.create (countConfirmedByTenantAndExactStartTime).
    const byCell = new Map<string, RealAvailability[]>()
    for (const r of rows) {
      const key = `${r.startTime.slice(0, 10)}-${r.startTime.slice(11, 16)}`
      const list = byCell.get(key) ?? []
      list.push(r)
      byCell.set(key, list)
    }

    // Configured hours per weekday, HH:MM (backend serializes LocalTime as
    // "HH:mm:ss"). Falls back to the shared defaults for any day the tenant
    // hasn't configured — so a brand-new studio still gets a full grid.
    const hoursByDow = new Map<number, [string | null, string | null]>()
    const lunchByDow = new Map<number, [string | null, string | null]>()
    for (const w of weekly) {
      hoursByDow.set(w.dayOfWeek, [w.openTime ? w.openTime.slice(0, 5) : null, w.closeTime ? w.closeTime.slice(0, 5) : null])
      lunchByDow.set(w.dayOfWeek, [w.lunchStart ? w.lunchStart.slice(0, 5) : null, w.lunchEnd ? w.lunchEnd.slice(0, 5) : null])
    }

    // Materialize the full week grid: one cell per studio-hour slot per day,
    // whether or not a PT is already released into it. Empty cells are what
    // give the admin a "+ PT" button to allocate the first trainer.
    const out: Array<{
      date: string; slotTime: string; startTime: string; endTime: string
      studioCount: number; studioMax: number
      releases: Array<{ releaseId: string; ptId: string; ptName: string; confirmedCount: number; studentNames: string[] }>
      blocked: boolean; blockReason?: string; blockId?: string
    }> = []
    for (const date of eachDateStr(startDate, endDate)) {
      const dow = dowOf(date)
      const hours = hoursByDow.get(dow) ?? DEFAULT_STUDIO_HOURS[dow] ?? [null, null]
      const lunch = lunchByDow.get(dow) ?? [null, null]
      for (const time of slotTimesForHours(hours[0], hours[1], config.slotDurationMinutes, config.classDurationMinutes, lunch[0], lunch[1])) {
        const group = byCell.get(`${date}-${time}`) ?? []
        const first = group[0]
        const blk = slotBlock(blocks, date, time, config.classDurationMinutes)
        out.push({
          date, slotTime: time,
          startTime: first ? first.startTime : `${date}T${time}:00Z`,
          endTime: first ? first.endTime : `${date}T${addMinutesToTime(time, config.classDurationMinutes)}:00Z`,
          studioCount: group.reduce((s, r) => s + r.confirmedCount, 0),
          studioMax: STUDIO_MAX_SPOTS_FALLBACK,
          releases: group.map(r => ({
            releaseId: r.id,
            ptId: r.personalTrainerId,
            ptName: r.personalTrainerName,
            confirmedCount: r.confirmedCount,
            studentNames: r.studentNames ?? [],
          })),
          blocked: !!blk,
          blockReason: blk?.reason,
          blockId: blk?.id,
        })
      }
    }
    return out
  },

  addRelease: async (data: { ptId: string; date: string; slotTime: string; endTime?: string }) =>
    availabilityApi.createForPT(data),

  // ALOCAR = criar o horário E marcar o aluno, numa só chamada. Não existe
  // alocar sem aluno — a regra é imposta no servidor, não só na UI.
  allocate: async (data: { ptId: string; studentId: string; date: string; slotTime: string }) => {
    const config = await fetchStudioConfig()
    return apiFetch('/api/v1/admin/schedule/allocate', {
      method: 'POST',
      body: JSON.stringify({
        ptId: data.ptId,
        studentId: data.studentId,
        startTime: `${data.date}T${data.slotTime}:00Z`,
        endTime: `${data.date}T${addMinutesToTime(data.slotTime, config.classDurationMinutes)}:00Z`,
      }),
    })
  },

  removeRelease: async (releaseId: string) =>
    apiFetch<void>(`/api/v1/admin/schedule/${releaseId}`, { method: 'DELETE' }),

  // Admin sees attendees for any PT's slot. AttendeeResponse from the
  // backend doesn't include email/phone (unlike the mock's admin-only
  // enrichment) — confirmed live: { studentId, studentName, status } only.
  // Contact info would need a separate GET /students/{id} call per attendee;
  // left un-enriched here to avoid an N+1 fan-out on every modal open. Pages
  // relying on email/phone in this response need a follow-up fetch.
  attendees: async (_ptId: string, slotKey: string) =>
    apiFetch<Array<{ studentId: string; studentName: string; status: string }>>(
      `/api/v1/admin/schedule/${slotKey}/attendees`,
    ).then(rows => rows.map(r => ({
      bookingId: r.studentId, alunoId: r.studentId, alunoName: r.studentName, status: r.status,
      email: undefined as string | undefined, phone: undefined as string | undefined,
    }))),
}

// ── Studio Schedule (weekly hours + one-off blocks) ───────────────────────────
// Confirmed live 07/jul against StudioScheduleController — all ADMIN-only.
export const studioScheduleApi = {
  getWeeklyHours: async () =>
    apiFetch<Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null; lunchStart: string | null; lunchEnd: string | null }>>(
      '/api/v1/admin/studio-schedule/weekly-hours',
    ),

  updateWeeklyHours: async (dayOfWeek: number, openTime: string | null, closeTime: string | null, lunchStart: string | null = null, lunchEnd: string | null = null) =>
    apiFetch(`/api/v1/admin/studio-schedule/weekly-hours/${dayOfWeek}`, {
      method: 'PATCH',
      body: JSON.stringify({ openTime, closeTime, lunchStart, lunchEnd }),
    }),

  listBlocks: async (startDate: string, endDate: string) =>
    apiFetch<Array<{ id: string; date: string; startTime: string; endTime: string; reason: string }>>(
      `/api/v1/admin/studio-schedule/blocks?startDate=${startDate}&endDate=${endDate}`,
    ),

  // Horas de funcionamento reais, legíveis pelo PT (rota fora de /admin). A
  // grelha do PT desenhava com horários hardcoded e por isso mostrava linhas
  // que o estúdio nunca configurou — e omitia as que configurou.
  getWeeklyHoursReadonly: async () =>
    apiFetch<Array<{ dayOfWeek: number; openTime: string | null; closeTime: string | null; lunchStart: string | null; lunchEnd: string | null }>>(
      '/api/v1/studio-schedule/weekly-hours',
    ),

  // Leitura acessível ao PT (rota fora de /admin) — para mostrar os fechos do
  // estúdio na agenda do PT (#10). Mutações continuam admin-only.
  listBlocksReadonly: async (startDate: string, endDate: string) =>
    apiFetch<Array<{ id: string; date: string; startTime: string; endTime: string; reason: string }>>(
      `/api/v1/studio-schedule/blocks?startDate=${startDate}&endDate=${endDate}`,
    ),

  createBlock: async (data: { date: string; startTime: string; endTime: string; reason: string }) =>
    apiFetch('/api/v1/admin/studio-schedule/blocks', { method: 'POST', body: JSON.stringify(data) }),

  deleteBlock: async (id: string) =>
    apiFetch<void>(`/api/v1/admin/studio-schedule/blocks/${id}`, { method: 'DELETE' }),
}

// ── Bookings ──────────────────────────────────────────────────────────────────
// Confirmed live 07/jul. BookingResponse doesn't carry a slotKey — callers
// that need one (e.g. cross-referencing against availabilityApi rows) should
// use `availabilityId` (the real Availability UUID) instead of the mock's
// synthetic date-time slotKey.
export const bookingApi = {
  myBookings: async () =>
    apiFetch<Array<{
      id: string; availabilityId: string; startTime: string; endTime: string
      studentId: string; studentName: string; personalTrainerId: string; personalTrainerName: string
      status: string; createdAt: string
    }>>('/api/v1/bookings/my'),

  // mock signature: create(slotKey) where slotKey = "YYYY-MM-DD-HH:MM". The
  // real backend takes an availabilityId (UUID) directly — callers must pass
  // the real Availability id (as returned by availabilityApi.ptSlots/
  // studioGrid's `id`/`releaseId` field), not a synthesized slotKey.
  create: async (availabilityId: string) =>
    apiFetch('/api/v1/bookings', {
      method: 'POST',
      body: JSON.stringify({ availabilityId }),
    }),

  // Admin/PT marcam POR um aluno específico (desconta do pack do aluno). O
  // aluno passa a ter uma reserva real (Confirmada), não uma disponibilidade.
  createForStudent: async (availabilityId: string, studentId: string) =>
    apiFetch('/api/v1/bookings/for-student', {
      method: 'POST',
      body: JSON.stringify({ availabilityId, studentId }),
    }),

  cancel: async (bookingId: string) =>
    apiFetch<void>(`/api/v1/bookings/${bookingId}`, { method: 'DELETE' }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
// Confirmed live 07/jul against DashboardController/DashboardDtos. Field
// renames from the mock: totalAlunos -> totalStudents, confirmedAlunos ->
// confirmedStudents, maxAlunos -> maxStudents, alunosBooked has no backend
// equivalent (NextSession doesn't carry per-student names — only counts).
export const dashboardApi = {
  admin: async () =>
    apiFetch<{
      stats: {
        activePTs: number; totalStudents: number; sessionsThisWeek: number; sessionsThisMonth: number
        estimatedRevenue: number; hoursThisMonth: number; hoursLastMonth: number
      }
      occupationByDay: Array<{ day: string; occupied: number; available: number }>
    }>('/api/v1/dashboard/admin').then(res => ({
      stats: { ...res.stats, totalAlunos: res.stats.totalStudents },
      occupationByDay: res.occupationByDay,
    })),

  pt: async () =>
    apiFetch<{
      stats: { totalStudents: number; sessionsThisWeek: number; hoursThisMonth: number; amountDue: number }
      nextSessions: Array<{ availabilityId: string; startTime: string; endTime: string; confirmedStudents: number; maxStudents: number }>
    }>('/api/v1/dashboard/pt').then(res => ({
      stats: { ...res.stats, totalAlunos: res.stats.totalStudents },
      nextSessions: res.nextSessions.map(s => ({
        availabilityId: s.availabilityId, startTime: s.startTime, endTime: s.endTime,
        confirmedAlunos: s.confirmedStudents, maxAlunos: s.maxStudents,
        // studioCount/alunosBooked have no backend equivalent in
        // PTDashboardResponse.NextSession — left as safe defaults so pages
        // reading these fields don't crash; real per-slot studio occupancy
        // requires a separate availabilityApi call if a page needs it.
        studioCount: s.confirmedStudents, alunosBooked: [] as string[],
      })),
      // recentBookings doesn't exist in PTDashboardResponse (backend only
      // returns nextSessions, not a history list) — bookingApi.myBookings
      // isn't PT-scoped either (it's STUDENT-only per BookingController).
      // GAP: see summary at the end of this task.
      recentBookings: [] as unknown[],
    })),

  aluno: async () =>
    apiFetch<{
      nextSession?: { availabilityId: string; startTime: string; endTime: string; confirmedStudents: number; maxStudents: number }
      upcomingCount: number; completedCount: number; ptName: string
      recentSessions: Array<{ bookingId: string; startTime: string; endTime: string; status: string; ptName: string }>
      pack?: { total: number; used: number; remaining: number; sessionDuration: number; expiresAt: string | null }
    }>('/api/v1/dashboard/student').then(res => ({
      nextSession: res.nextSession ? {
        availabilityId: res.nextSession.availabilityId, startTime: res.nextSession.startTime, endTime: res.nextSession.endTime,
        confirmedAlunos: res.nextSession.confirmedStudents, maxAlunos: res.nextSession.maxStudents,
      } : undefined,
      upcomingCount: res.upcomingCount,
      completedCount: res.completedCount,
      ptName: res.ptName,
      // ptBillingCycleDay/inscricaoDate have no equivalent in
      // StudentDashboardResponse — see GAP summary.
      ptBillingCycleDay: undefined as number | undefined,
      inscricaoDate: undefined as string | undefined,
      pack: res.pack,
      recentSessions: res.recentSessions,
    })),
}

// ── Alunos (student-side own view) ────────────────────────────────────────────
// Mix of StudentController (own profile) + availabilityApi/bookingApi (own
// PT's slots + booking). Confirmed live 07/jul.
export const alunoApi = {
  // BUG FIX: /students/me devolve o StudentResponse COMPLETO (mesmo
  // findResponseById que /students/{id} usa), com a anamnese em nomes ingleses
  // (medicalConditions, intakeFormSignedAt, gender…). Sem passar pelo
  // studentToMock, a página "Minha Anamnese" lia aluno.doencas/genero/
  // anamneseAssinadaEm como undefined → mostrava sempre "não preenchida" e
  // nunca o badge de assinatura. studentToMock é function (hoisted), chamável
  // aqui mesmo estando definido mais abaixo.
  me: async () =>
    studentToMock(await apiFetch<RealStudent>('/api/v1/students/me')),

  // Alias kept for pages built against the mock's `assinarAnamnese`/intake
  // form naming — backend route is /students/me/intake-form/sign.
  assinarAnamnese: async (nome: string) =>
    apiFetch('/api/v1/students/me/intake-form/sign', { method: 'POST', body: JSON.stringify({ name: nome }) }),

  // /students/my-students devolve List<StudentResponse> (mesmo shape inglês:
  // status 'ACTIVE', goal...). Sem studentToMock, o card do PT comparava
  // s.status === 'ATIVO' e mostrava TODOS os alunos ativos como "Suspenso",
  // e o objetivo (goal) sumia. Mapeado igual aos outros caminhos.
  myStudents: async () =>
    apiFetch<RealStudent[]>('/api/v1/students/my-students').then(list => list.map(studentToMock)),

  // Backend requires a password on CreateStudentRequest — personalTrainerId
  // is auto-filled server-side when the caller is a PERSONAL_TRAINER (see
  // StudentController.create). Generates a real random password (never a
  // fixed/guessable one) and tries to email it, same pattern as
  // ptApi.create's welcome-credentials flow — returns tempPassword/emailSent
  // so the calling page can fall back to copy/WhatsApp when email fails.
  createByPT: async (data: { name: string; email: string; phone?: string; objetivo?: string; dataNascimento?: string }) => {
    const tempPassword = generateTempPassword()
    const created = await apiFetch<Record<string, unknown>>('/api/v1/students', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name, email: data.email, phone: data.phone,
        goal: data.objetivo, dateOfBirth: data.dataNascimento,
        password: tempPassword,
        // @NotBlank no backend, mas o valor é sempre sobrescrito
        // server-side quando quem chama é um PERSONAL_TRAINER (ver
        // StudentController.create) — precisa só ser não-vazio.
        personalTrainerId: 'auto',
      }),
    })
    const { sent } = await sendCredentialsEmail({ to: data.email, name: data.name, password: tempPassword, isReset: false })
    return { ...created, tempPassword, emailSent: sent }
  },

  create: async (data: { name: string; email: string; password: string; personalTrainerId: string }) =>
    apiFetch('/api/v1/students', {
      method: 'POST',
      body: JSON.stringify({ name: data.name, email: data.email, password: data.password, personalTrainerId: data.personalTrainerId }),
    }),
}

// ── Plan Tiers (TIERED_HOURLY pricing) ────────────────────────────────────────
// Confirmed live 07/jul (tested against an empty tier list — no
// TIERED_HOURLY plan in the seed, but the route/shape is confirmed via
// RentalPlanController + PlanHourTierResponse).
export const planTierApi = {
  listTiers: async (planId: string) =>
    apiFetch<Array<{ id: string; tierOrder: number; hoursFrom: number; hoursTo: number | null; pricePerHour: number; bonus: number }>>(
      `/api/v1/plans/${planId}/tiers`,
    ),
  // Backend PUT replaces all tiers, matching the mock's saveTiers
  // replace-all semantics exactly — no per-row diffing needed.
  saveTiers: async (planId: string, tiers: Array<{ hoursFrom: number; hoursTo: number | null; pricePerHour: number; bonus: number }>) =>
    apiFetch(`/api/v1/plans/${planId}/tiers`, { method: 'PUT', body: JSON.stringify(tiers) }),
}

// ── PT weekly payment cycle (TIERED_HOURLY plans only) ────────────────────────
// Confirmed live 07/jul — errors with 422 "Este PT não está num plano por
// faixas" for a non-TIERED_HOURLY plan, exactly like the mock's guard.
export const ptPaymentApi = {
  weeklySchedule: async (ptId: string, month: string) =>
    apiFetch<{
      ptId: string; ptName: string; planName: string
      tiers: Array<{ id: string; tierOrder: number; hoursFrom: number; hoursTo: number | null; pricePerHour: number; bonus: number }>
      weeks: Array<{
        weekStart: string; weekEnd: string; hoursThisWeek: number; cumulativeHours: number
        isClosingWeek: boolean; amountAdvanced: number; retroactiveAdjustment?: number; bonus?: number
      }>
      totalHours: number
    }>(`/api/v1/billing/${ptId}/weekly-schedule?month=${encodeURIComponent(month)}`),

  // Controlo de inadimplência (cobrança semanal da renda). Distinto do
  // weeklySchedule acima (adiantamentos de planos por faixas) — isto é o
  // registo de quem pagou, quanto e quando, por semana.
  week: async (date?: string) =>
    apiFetch<PtWeeklyOverview>(`/api/v1/pt-payments/week${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  delinquency: async () => apiFetch<DelinquencyReport>('/api/v1/pt-payments/delinquency'),
  history: async (ptId: string) => apiFetch<PtWeeklyCharge[]>(`/api/v1/pt-payments/history/${ptId}`),
  record: async (data: { ptId: string; periodStart: string; amount: number; notes?: string }) =>
    apiFetch<PtWeeklyCharge>('/api/v1/pt-payments', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Workout Plans ─────────────────────────────────────────────────────────────
// Confirmed live 07/jul against WorkoutController/WorkoutDtos.
export const workoutApi = {
  // mock signature: ptAlunos(ptId) -> students of a PT with a planCount.
  // Backend has no single endpoint for "students of PT X with workout plan
  // counts" — composed here from /students/my-students (PERSONAL_TRAINER-
  // scoped, ptId param is ignored/unused since the backend infers the PT
  // from the JWT) + one /workout-plans?studentId= call per student to
  // count plans. This is an N+1 the mock doesn't have — acceptable for a
  // PT's own student list (typically single digits), but see GAP summary.
  ptAlunos: async (_ptId: string) => {
    const students = await apiFetch<Array<{ id: string; name: string; email: string }>>('/api/v1/students/my-students')
    const withCounts = await Promise.all(students.map(async s => {
      const plans = await apiFetch<unknown[]>(`/api/v1/workout-plans?studentId=${s.id}`).catch(() => [])
      return { ...s, planCount: plans.length }
    }))
    return withCounts
  },

  plans: async (alunoId: string) =>
    apiFetch<Array<{
      id: string; studentId: string; studentName: string; ptId: string; label: string; focus: string
      exercises: Array<{ id: string; name: string; muscleGroup: string; sets: number; reps: string; rest: string; notes?: string }>
      validUntil: string | null; updatedAt: string
    }>>(`/api/v1/workout-plans?studentId=${alunoId}`),

  savePlan: async (data: { alunoId: string; alunoName: string; ptId: string; label: string; focus: string; exercises: import('@/types').Exercise[]; validUntil?: string }) =>
    apiFetch('/api/v1/workout-plans', {
      method: 'POST',
      body: JSON.stringify({
        studentId: data.alunoId,
        label: data.label,
        focus: data.focus,
        exercises: data.exercises.map(e => ({
          name: e.name, muscleGroup: e.muscleGroup, sets: e.sets, reps: e.reps, rest: e.rest, notes: e.notes,
        })),
        validUntil: data.validUntil,
      }),
    }),

  updateValidity: async (planId: string, validUntil: string) =>
    apiFetch(`/api/v1/workout-plans/${planId}/validity`, { method: 'PATCH', body: JSON.stringify({ validUntil }) }),

  addExercise: async (planId: string, exercise: Omit<import('@/types').Exercise, 'id'>) =>
    apiFetch(`/api/v1/workout-plans/${planId}/exercises`, {
      method: 'POST',
      body: JSON.stringify({
        name: exercise.name, muscleGroup: exercise.muscleGroup, sets: exercise.sets,
        reps: exercise.reps, rest: exercise.rest, notes: exercise.notes,
      }),
    }),

  removeExercise: async (planId: string, exerciseId: string) =>
    apiFetch<void>(`/api/v1/workout-plans/${planId}/exercises/${exerciseId}`, { method: 'DELETE' }),

  // No standalone DELETE /workout-plans/{id} caller in the mock's shape
  // mismatch sense — the backend DOES have this route (WorkoutController
  // line 72-77), so this maps directly with no gap.
  deletePlan: async (planId: string) => apiFetch<void>(`/api/v1/workout-plans/${planId}`, { method: 'DELETE' }),
}

// ── Notification engine config ────────────────────────────────────────────────
// Antes de 08/jul isto não existia em lugar nenhum (nem mock nem real) além
// da tela de toggles — agora o backend de facto dispara os emails
// (NotificationDispatchService), então esta tela precisa falar com o
// backend real para os toggles terem efeito de verdade em produção.
export const notificationApi = {
  list: async () => apiFetch('/api/v1/notification-configs'),
  toggle: async (id: string, enabled: boolean) =>
    apiFetch(`/api/v1/notification-configs/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  update: async (id: string, data: Partial<{ enabled: boolean; daysOffset: number }>) =>
    apiFetch(`/api/v1/notification-configs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// Sino do estúdio (inbox in-app) — separado do config acima.
export interface InboxNotificationItem {
  id: string; type: string; title: string; body: string | null; link: string | null; createdAt: string; read: boolean
}
export const notificationInboxApi = {
  inbox: async () =>
    apiFetch<{ items: InboxNotificationItem[]; unreadCount: number }>('/api/v1/notifications'),
  unreadCount: async () =>
    (await apiFetch<{ unreadCount: number }>('/api/v1/notifications/unread-count')).unreadCount,
  markAllRead: async () =>
    apiFetch<{ updated: number }>('/api/v1/notifications/mark-read', { method: 'POST' }),
}

// ── Admin — gestão de alunos ──────────────────────────────────────────────────
// O backend fala inglês (StudentResponse/CreateStudentRequest), o frontend
// espera o shape MockAluno em português. Estes mapas fazem a tradução
// bidirecional dos enums e nomes de campo — sem eles, o admin/alunos mostraria
// undefined em tudo. Estúdio novo = lista vazia (correto), nunca dados fake.

const GENDER_EN2PT: Record<string, 'MASCULINO' | 'FEMININO' | 'OUTRO'> = { MALE: 'MASCULINO', FEMALE: 'FEMININO', OTHER: 'OUTRO' }
const GENDER_PT2EN: Record<string, string> = { MASCULINO: 'MALE', FEMININO: 'FEMALE', OUTRO: 'OTHER' }
const ALCOHOL_EN2PT: Record<string, 'NUNCA' | 'OCASIONAL' | 'FREQUENTE'> = { NEVER: 'NUNCA', OCCASIONAL: 'OCASIONAL', FREQUENT: 'FREQUENTE' }
const ALCOHOL_PT2EN: Record<string, string> = { NUNCA: 'NEVER', OCASIONAL: 'OCCASIONAL', FREQUENTE: 'FREQUENT' }
const ACTIVITY_EN2PT: Record<string, 'SEDENTARIO' | 'POUCO_ATIVO' | 'ATIVO' | 'MUITO_ATIVO'> = { SEDENTARY: 'SEDENTARIO', LIGHTLY_ACTIVE: 'POUCO_ATIVO', ACTIVE: 'ATIVO', VERY_ACTIVE: 'MUITO_ATIVO' }
const ACTIVITY_PT2EN: Record<string, string> = { SEDENTARIO: 'SEDENTARY', POUCO_ATIVO: 'LIGHTLY_ACTIVE', ATIVO: 'ACTIVE', MUITO_ATIVO: 'VERY_ACTIVE' }
const STRESS_EN2PT: Record<string, 'BAIXO' | 'MEDIO' | 'ALTO'> = { LOW: 'BAIXO', MEDIUM: 'MEDIO', HIGH: 'ALTO' }
const STRESS_PT2EN: Record<string, string> = { BAIXO: 'LOW', MEDIO: 'MEDIUM', ALTO: 'HIGH' }
const STATUS_EN2PT: Record<string, 'ATIVO' | 'INATIVO' | 'SUSPENSO'> = { ACTIVE: 'ATIVO', INACTIVE: 'INATIVO', SUSPENDED: 'SUSPENSO' }
const STATUS_PT2EN: Record<string, string> = { ATIVO: 'ACTIVE', INATIVO: 'INACTIVE', SUSPENSO: 'SUSPENDED' }

type RealStudent = Record<string, unknown>

function studentToMock(s: RealStudent) {
  const g = (v: unknown, m: Record<string, string>) => (v == null ? undefined : m[v as string])
  return {
    id: String(s.id), userId: String(s.userId ?? ''), name: String(s.name ?? ''), email: String(s.email ?? ''),
    phone: (s.phone as string) ?? undefined,
    personalTrainerId: String(s.personalTrainerId ?? ''), personalTrainerName: String(s.personalTrainerName ?? ''),
    nextSession: (s.nextSession as string) ?? undefined,
    completedSessions: (s.completedSessions as number) ?? 0,
    status: STATUS_EN2PT[s.status as string] ?? 'ATIVO',
    dataNascimento: (s.dateOfBirth as string) ?? undefined,
    inscricaoDate: (s.enrollmentDate as string) ?? new Date().toISOString().slice(0, 10),
    objetivo: (s.goal as string) ?? undefined,
    genero: g(s.gender, GENDER_EN2PT) as 'MASCULINO' | 'FEMININO' | 'OUTRO' | undefined,
    profissao: (s.occupation as string) ?? undefined,
    doencas: (s.medicalConditions as string[]) ?? [],
    doencasOutras: (s.otherMedicalConditions as string) ?? undefined,
    cirurgias: (s.surgeries as string) ?? undefined,
    medicamentos: (s.medications as string) ?? undefined,
    limitacoesFisicas: (s.physicalLimitations as string) ?? undefined,
    fumante: (s.smoker as boolean) ?? undefined,
    alcool: g(s.alcoholConsumption, ALCOHOL_EN2PT) as 'NUNCA' | 'OCASIONAL' | 'FREQUENTE' | undefined,
    praticouAtividade: (s.hasPracticedActivity as boolean) ?? undefined,
    atividadeAnterior: (s.previousActivity as string) ?? undefined,
    tempoSemAtividade: (s.timeWithoutActivity as string) ?? undefined,
    nivelAtividade: g(s.activityLevel, ACTIVITY_EN2PT) as 'SEDENTARIO' | 'POUCO_ATIVO' | 'ATIVO' | 'MUITO_ATIVO' | undefined,
    horasSono: (s.sleepHours as number) ?? undefined,
    nivelEstresse: g(s.stressLevel, STRESS_EN2PT) as 'BAIXO' | 'MEDIO' | 'ALTO' | undefined,
    prazoObjetivo: (s.goalDeadline as string) ?? undefined,
    disponibilidadeSemanal: (s.weeklyAvailability as number) ?? undefined,
    observacoesGerais: (s.generalNotes as string) ?? undefined,
    anamneseAssinadaEm: (s.intakeFormSignedAt as string) ?? undefined,
    anamneseAssinadaNome: (s.intakeFormSignedName as string) ?? undefined,
    nif: (s.taxId as string) ?? undefined,
    morada: (s.address as string) ?? undefined,
  }
}

// AssessmentResponse (backend, inglês) → shape PT que a UI lê (av.tipo/data/
// peso/altura/imc/...). Sem isto, a secção de Avaliações Físicas no detalhe do
// aluno renderiza tudo vazio (datas em branco, tipo errado, sem peso/altura).
// bmi é calculado no backend e devolvido — mapeado para imc.
function assessmentToMock(a: RealStudent) {
  return {
    id: String(a.id ?? ''),
    alunoId: (a.studentId as string) ?? undefined,
    tipo: (a.type as string) ?? undefined,
    data: (a.date as string) ?? undefined,
    frequenciaSemanal: (a.weeklyFrequency as number) ?? undefined,
    peso: (a.weight as number) ?? undefined,
    altura: (a.height as number) ?? undefined,
    imc: (a.bmi as number) ?? undefined,
    percentualGordura: (a.bodyFatPercentage as number) ?? undefined,
    massaMuscular: (a.muscleMass as number) ?? undefined,
    objetivo: (a.goal as string) ?? undefined,
    observacoes: (a.notes as string) ?? undefined,
    proximaAvaliacao: (a.nextAssessmentDate as string) ?? undefined,
  }
}

// Traduz o payload PT do form → EN que o backend aceita. Só inclui chaves
// presentes (undefined não vira null no JSON, graças ao filtro).
function mockToStudentPayload(d: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const put = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== '') out[k] = v }
  put('name', d.name); put('email', d.email); put('phone', d.phone)
  put('personalTrainerId', d.personalTrainerId)
  put('dateOfBirth', d.dataNascimento)
  put('gender', d.genero ? GENDER_PT2EN[d.genero as string] : undefined)
  put('occupation', d.profissao)
  put('goal', d.objetivo); put('goalDeadline', d.prazoObjetivo)
  put('weeklyAvailability', d.disponibilidadeSemanal)
  put('medicalConditions', d.doencas)
  put('otherMedicalConditions', d.doencasOutras)
  put('surgeries', d.cirurgias); put('medications', d.medicamentos)
  put('physicalLimitations', d.limitacoesFisicas)
  put('smoker', d.fumante)
  put('alcoholConsumption', d.alcool ? ALCOHOL_PT2EN[d.alcool as string] : undefined)
  put('hasPracticedActivity', d.praticouAtividade)
  put('previousActivity', d.atividadeAnterior)
  put('timeWithoutActivity', d.tempoSemAtividade)
  put('activityLevel', d.nivelAtividade ? ACTIVITY_PT2EN[d.nivelAtividade as string] : undefined)
  put('sleepHours', d.horasSono)
  put('stressLevel', d.nivelEstresse ? STRESS_PT2EN[d.nivelEstresse as string] : undefined)
  put('generalNotes', d.observacoesGerais)
  put('status', d.status ? STATUS_PT2EN[d.status as string] : undefined)
  put('taxId', d.nif); put('address', d.morada)
  return out
}

export const adminApi = {
  allAlunos: async () =>
    apiFetch<{ content: RealStudent[] }>('/api/v1/students?size=200').then(p => p.content.map(studentToMock)),

  alunosByPt: async (ptId: string) =>
    adminApi.allAlunos().then(list => list.filter(a => a.personalTrainerId === ptId)),

  alunoById: async (id: string) => {
    const aluno = studentToMock(await apiFetch<RealStudent>(`/api/v1/students/${id}`))
    // Agregados em paralelo — cada um degrada para [] se o endpoint falhar,
    // nunca quebra a página inteira. Histórico de reservas do aluno visto
    // pelo admin ainda não tem endpoint dedicado no backend (myBookings é
    // STUDENT-only), então vem vazio por enquanto.
    const [packs, avaliacoes, workoutPlans] = await Promise.all([
      apiFetch<unknown[]>(`/api/v1/session-packs?studentId=${id}`).catch(() => []),
      // Assessments vêm em inglês do backend → mapear p/ o shape PT que a UI
      // lê (av.tipo/data/peso/imc...), senão as avaliações aparecem vazias.
      apiFetch<RealStudent[]>(`/api/v1/assessments?studentId=${id}`).then(l => l.map(assessmentToMock)).catch(() => []),
      apiFetch<unknown[]>(`/api/v1/workout-plans?studentId=${id}`).catch(() => []),
    ])
    return { aluno, bookings: [] as unknown[], packs, avaliacoes, workoutPlan: (workoutPlans as unknown[])[0] }
  },

  createAluno: async (data: Record<string, unknown>) =>
    apiFetch<RealStudent>('/api/v1/students', {
      method: 'POST',
      body: JSON.stringify({ ...mockToStudentPayload(data), password: generateTempPassword() }),
    }).then(studentToMock),

  updateAluno: async (id: string, data: Record<string, unknown>) =>
    apiFetch<RealStudent>(`/api/v1/students/${id}`, {
      method: 'PATCH', body: JSON.stringify(mockToStudentPayload(data)),
    }).then(studentToMock),

  cancelBooking: async (bookingId: string) =>
    apiFetch(`/api/v1/bookings/${bookingId}`, { method: 'DELETE' }),
}
