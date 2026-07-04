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

export const authApi         = USE_REAL.auth ? real.authApi : mock.authApi
export const dashboardApi    = mock.dashboardApi
export const ptApi           = USE_REAL.personalTrainers ? (real.ptApi as typeof mock.ptApi) : mock.ptApi
export const alunoApi        = mock.alunoApi
export const availabilityApi = mock.availabilityApi
export const adminScheduleApi = mock.adminScheduleApi
export const studioScheduleApi = mock.studioScheduleApi
export const bookingApi      = mock.bookingApi
export const adminApi        = mock.adminApi
export const modalidadeApi   = USE_REAL.modalidades ? (real.modalidadeApi as typeof mock.modalidadeApi) : mock.modalidadeApi
export const planApi         = USE_REAL.plans ? (real.planApi as typeof mock.planApi) : mock.planApi
export const planTierApi     = mock.planTierApi
export const ptPaymentApi    = mock.ptPaymentApi
export const avaliacaoApi    = USE_REAL.avaliacoes ? (real.avaliacaoApi as unknown as typeof mock.avaliacaoApi) : mock.avaliacaoApi
export const packApi         = USE_REAL.packs ? (real.packApi as unknown as typeof mock.packApi) : mock.packApi
export const leadApi         = USE_REAL.leads ? (real.leadApi as unknown as typeof mock.leadApi) : mock.leadApi
export const notificationApi = mock.notificationApi
export const workoutApi      = mock.workoutApi
export const billingApi      = USE_REAL.billing ? (real.billingApi as typeof mock.billingApi) : mock.billingApi
