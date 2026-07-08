// Interruptor mock/real por domínio. TUDO por defeito é 'mock' — quem está
// a usar/ver a aplicação hoje nunca é afetado. Ligar o backend real é uma
// decisão explícita por deployment (env var), nunca automática.
//
// Para ligar um domínio ao backend real numa Vercel preview/produção,
// definir a env var correspondente como "true" e apontar NEXT_PUBLIC_API_URL
// para o backend Railway. Sem essas envs, o comportamento é idêntico ao atual.
//
// IMPORTANT: process.env.NEXT_PUBLIC_* tem de ser acedido de forma literal
// (nunca via process.env[nomeDinamico]) para o Next.js conseguir substituir
// o valor em build-time no bundle do browser.

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

// INTERRUPTOR MESTRE. Setar NEXT_PUBLIC_USE_REAL_BACKEND=true no deployment
// (Vercel) joga TODOS os domínios pro backend real de uma vez — não é preciso
// acertar 20 flags individuais. É isto que evita o "Frankenstein" (uns
// domínios reais, outros mock) que mostra dados fake num estúdio real.
// As flags individuais continuam válidas como override pontual (só ligam,
// nunca desligam o mestre). Em produção, use SÓ o mestre.
const ALL_REAL = process.env.NEXT_PUBLIC_USE_REAL_BACKEND === 'true'
const on = (v: string | undefined) => ALL_REAL || v === 'true'

export const USE_REAL = {
  auth: on(process.env.NEXT_PUBLIC_REAL_AUTH),
  plans: on(process.env.NEXT_PUBLIC_REAL_PLANS),
  modalidades: on(process.env.NEXT_PUBLIC_REAL_MODALIDADES),
  personalTrainers: on(process.env.NEXT_PUBLIC_REAL_PERSONAL_TRAINERS),
  billing: on(process.env.NEXT_PUBLIC_REAL_BILLING),
  leads: on(process.env.NEXT_PUBLIC_REAL_LEADS),
  packs: on(process.env.NEXT_PUBLIC_REAL_PACKS),
  avaliacoes: on(process.env.NEXT_PUBLIC_REAL_AVALIACOES),
  availability: on(process.env.NEXT_PUBLIC_REAL_AVAILABILITY),
  bookings: on(process.env.NEXT_PUBLIC_REAL_BOOKINGS),
  adminSchedule: on(process.env.NEXT_PUBLIC_REAL_ADMIN_SCHEDULE),
  studioSchedule: on(process.env.NEXT_PUBLIC_REAL_STUDIO_SCHEDULE),
  dashboard: on(process.env.NEXT_PUBLIC_REAL_DASHBOARD),
  aluno: on(process.env.NEXT_PUBLIC_REAL_ALUNO),
  planTiers: on(process.env.NEXT_PUBLIC_REAL_PLAN_TIERS),
  ptPayment: on(process.env.NEXT_PUBLIC_REAL_PT_PAYMENT),
  workout: on(process.env.NEXT_PUBLIC_REAL_WORKOUT),
  notifications: on(process.env.NEXT_PUBLIC_REAL_NOTIFICATIONS),
  admin: on(process.env.NEXT_PUBLIC_REAL_ADMIN),
} as const
