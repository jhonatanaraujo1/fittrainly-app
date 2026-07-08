'use client'

// Ponto único de importação para todas as páginas ('@/lib/api').
// Decide, por domínio, se usa mock (mock-api.ts) ou backend real (real-api.ts),
// com base nas flags de api-config.ts. Por defeito TUDO é mock — isto nunca
// muda o comportamento de quem já está a usar a aplicação.
//
// Páginas continuam a importar exatamente como antes:
//   import { authApi, ptApi, planApi, ... } from '@/lib/api'
// Nada nas páginas precisa de mudar quando o backend for ligado.

import { USE_REAL } from './api-config'
import * as mock from './mock-api'
import * as real from './real-api'
import { persistDB } from './mock-db'

// O mock roda 100% em memória JS — sem isto, qualquer mutação (criar PT,
// editar faixas, reservar sessão) desaparece no primeiro F5. Envolve cada
// método do objeto mock com "gravar depois de chamar", sem precisar tocar em
// cada função individual de mock-api.ts. Nunca aplicado aos objetos reais
// (real-api.ts) — esses já persistem no Postgres do backend.
function withPersistence<T extends object>(api: T): T {
  const wrapped = {} as T
  for (const key of Object.keys(api) as (keyof T)[]) {
    const value = api[key]
    if (typeof value === 'function') {
      wrapped[key] = ((...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown)(...args)
        if (result instanceof Promise) {
          return result.then(
            (r: unknown) => { persistDB(); return r },
            (e: unknown) => { persistDB(); throw e },
          )
        }
        persistDB()
        return result
      }) as T[keyof T]
    } else {
      wrapped[key] = value
    }
  }
  return wrapped
}

export const authApi         = USE_REAL.auth ? (real.authApi as unknown as typeof mock.authApi) : withPersistence(mock.authApi)
export const dashboardApi    = USE_REAL.dashboard ? (real.dashboardApi as unknown as typeof mock.dashboardApi) : withPersistence(mock.dashboardApi)
export const ptApi           = USE_REAL.personalTrainers ? (real.ptApi as unknown as typeof mock.ptApi) : withPersistence(mock.ptApi)
export const alunoApi        = USE_REAL.aluno ? (real.alunoApi as unknown as typeof mock.alunoApi) : withPersistence(mock.alunoApi)
export const availabilityApi = USE_REAL.availability ? (real.availabilityApi as unknown as typeof mock.availabilityApi) : withPersistence(mock.availabilityApi)
export const adminScheduleApi = USE_REAL.adminSchedule ? (real.adminScheduleApi as unknown as typeof mock.adminScheduleApi) : withPersistence(mock.adminScheduleApi)
export const studioScheduleApi = USE_REAL.studioSchedule ? (real.studioScheduleApi as typeof mock.studioScheduleApi) : withPersistence(mock.studioScheduleApi)
export const bookingApi      = USE_REAL.bookings ? (real.bookingApi as unknown as typeof mock.bookingApi) : withPersistence(mock.bookingApi)
export const adminApi        = USE_REAL.admin ? (real.adminApi as unknown as typeof mock.adminApi) : withPersistence(mock.adminApi)
export const modalidadeApi   = USE_REAL.modalidades ? (real.modalidadeApi as typeof mock.modalidadeApi) : withPersistence(mock.modalidadeApi)
export const planApi         = USE_REAL.plans ? (real.planApi as typeof mock.planApi) : withPersistence(mock.planApi)
export const planTierApi     = USE_REAL.planTiers ? (real.planTierApi as unknown as typeof mock.planTierApi) : withPersistence(mock.planTierApi)
export const ptPaymentApi    = USE_REAL.ptPayment ? (real.ptPaymentApi as unknown as typeof mock.ptPaymentApi) : withPersistence(mock.ptPaymentApi)
export const avaliacaoApi    = USE_REAL.avaliacoes ? (real.avaliacaoApi as unknown as typeof mock.avaliacaoApi) : withPersistence(mock.avaliacaoApi)
export const packApi         = USE_REAL.packs ? (real.packApi as unknown as typeof mock.packApi) : withPersistence(mock.packApi)
export const leadApi         = USE_REAL.leads ? (real.leadApi as unknown as typeof mock.leadApi) : withPersistence(mock.leadApi)
export const notificationApi = USE_REAL.notifications ? (real.notificationApi as unknown as typeof mock.notificationApi) : withPersistence(mock.notificationApi)
export const workoutApi      = USE_REAL.workout ? (real.workoutApi as unknown as typeof mock.workoutApi) : withPersistence(mock.workoutApi)
export const billingApi      = USE_REAL.billing ? (real.billingApi as typeof mock.billingApi) : withPersistence(mock.billingApi)
