'use client'

// Implementação MOCK — roda 100% sobre mock-db.ts, sem rede.
// É o fallback padrão do sistema. Nunca remover enquanto houver
// utilizadores/demos a depender do estado atual da aplicação.
// Ligar o backend real é feito via flags em api-config.ts + real-api.ts,
// nunca editando este ficheiro.

import {
  db, delay, uid, getCurrentUser,
  getPlanById, getPTById,
  getStudioSlotCount, getPTSlotCount,
  getSlotTimesForDay, getBookableSlotTimesForDay, addMinutesToTime,
  sessionsThisWeek, estimatedRevenue, getOccupationByDay,
  STUDIO_MAX_SPOTS, isSlotBlocked, studioSchedule, studioBlocks,
} from './mock-db'
import type { MockPlanHourTier } from './mock-db'
import { addDays, startOfWeek } from 'date-fns'

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function slotKeyToISO(date: string, time: string): { start: string; end: string } {
  return {
    start: `${date}T${time}:00Z`,
    end:   `${date}T${addMinutesToTime(time, 40)}:00Z`,
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string) => {
    await delay(400)
    const user = db.users.find(u => u.email === email && u.password === password)
    if (!user) throw new Error('Credenciais inválidas')
    return {
      accessToken: 'mock-token-' + uid(),
      refreshToken: 'mock-refresh-' + uid(),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  },
  refresh: async (_refreshToken: string) => {
    await delay(200)
    return { accessToken: 'mock-token-' + uid() }
  },
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  admin: async () => {
    await delay(300)
    return {
      stats: {
        activePTs: db.pts.filter(p => p.active).length,
        totalAlunos: db.alunos.length,
        sessionsThisWeek: sessionsThisWeek(),
        sessionsThisMonth: db.bookings.filter(b => b.status !== 'CANCELLED').length,
        estimatedRevenue: estimatedRevenue(),
        hoursThisMonth: db.pts.reduce((s, p) => s + p.hoursThisMonth, 0),
        hoursLastMonth: db.pts.reduce((s, p) => s + Math.round(p.hoursThisMonth * 0.88), 0),
      },
      occupationByDay: getOccupationByDay(),
    }
  },

  pt: async () => {
    await delay(280)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const now = new Date()

    // Next sessions: PT releases in the future that have at least 1 confirmed booking from this PT's alunos
    const monday = startOfWeek(now, { weekStartsOn: 1 })
    const twoWeeks = addDays(monday, 14)

    const nextSessions = db.ptReleases
      .filter(r => r.ptId === pt.id && new Date(`${r.date}T${r.slotTime}:00Z`) > now && new Date(`${r.date}T${r.slotTime}:00Z`) <= twoWeeks)
      .sort((a, b) => new Date(`${a.date}T${a.slotTime}:00Z`).getTime() - new Date(`${b.date}T${b.slotTime}:00Z`).getTime())
      .map(r => {
        const key = `${r.date}-${r.slotTime}`
        const { start, end } = slotKeyToISO(r.date, r.slotTime)
        const ptCount = getPTSlotCount(pt.id, r.date, r.slotTime)
        const studioCount = getStudioSlotCount(r.date, r.slotTime)
        const alunosBooked = db.bookings
          .filter(b => b.slotKey === key && b.personalTrainerId === pt.id && b.status === 'CONFIRMED')
          .map(b => b.alunoName)
        return {
          availabilityId: key,
          startTime: start,
          endTime: end,
          confirmedAlunos: ptCount,
          maxAlunos: STUDIO_MAX_SPOTS,
          studioCount,
          alunosBooked,
        }
      })
      .filter(s => s.confirmedAlunos > 0)
      .slice(0, 8)

    const myAlunos = db.alunos.filter(a => a.personalTrainerId === pt.id)
    const myBookings = db.bookings.filter(b => b.personalTrainerId === pt.id)
    const plan = getPlanById(pt.planId)

    let amountDue = 0
    if (plan) {
      if (plan.type === 'MONTHLY') amountDue = plan.priceMonthly ?? 0
      if (plan.type === 'WEEKLY') amountDue = (plan.priceWeekly ?? 0) * 4
      if (plan.type === 'HOURLY') amountDue = (plan.priceHourly ?? 0) * pt.hoursThisMonth
    }

    return {
      stats: {
        totalAlunos: myAlunos.length,
        sessionsThisWeek: myBookings.filter(b => {
          const d = new Date(b.startTime)
          const mon = new Date(); mon.setDate(mon.getDate() - mon.getDay() + 1); mon.setHours(0,0,0,0)
          const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999)
          return b.status === 'CONFIRMED' && d >= mon && d <= sun
        }).length,
        hoursThisMonth: pt.hoursThisMonth,
        amountDue,
      },
      nextSessions,
      recentBookings: myBookings
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 10),
    }
  },

  aluno: async () => {
    await delay(260)
    const user = getCurrentUser()
    const aluno = db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
    const now = new Date()

    const myBookings = db.bookings.filter(b => b.alunoId === aluno.id)
    const upcoming = myBookings.filter(b => b.status === 'CONFIRMED' && new Date(b.startTime) > now)
    const nextBooking = upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
    const pt = db.pts.find(p => p.id === aluno.personalTrainerId)

    return {
      nextSession: nextBooking ? {
        availabilityId: nextBooking.slotKey,
        startTime: nextBooking.startTime,
        endTime: nextBooking.endTime,
        confirmedAlunos: getStudioSlotCount(nextBooking.slotKey.slice(0, 10), nextBooking.slotKey.slice(11)),
        maxAlunos: STUDIO_MAX_SPOTS,
      } : undefined,
      upcomingCount: upcoming.length,
      completedCount: myBookings.filter(b => b.status === 'COMPLETED').length,
      ptName: aluno.personalTrainerName,
      ptBillingCycleDay: pt?.billingCycleAnchorDay,
      inscricaoDate: aluno.inscricaoDate,
      pack: (() => {
        const p = db.packs.find(pk => pk.alunoId === aluno.id && pk.status === 'ACTIVE')
        if (!p) return undefined
        return { total: p.total, used: p.used, remaining: p.total - p.used, sessionDuration: p.sessionDuration, expiresAt: p.expiresAt }
      })(),
      recentSessions: myBookings
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 5)
        .map(b => ({
          bookingId: b.id,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          ptName: b.personalTrainerName,
        })),
    }
  },
}

// ── Personal Trainers ─────────────────────────────────────────────────────────
export const ptApi = {
  list: async () => {
    await delay(250)
    return db.pts.map(pt => {
      const p = getPlanById(pt.planId)
      return {
        ...pt,
        plan: p ? { id: p.id, name: p.name, type: p.type } : undefined,
        alunoCount: db.alunos.filter(a => a.personalTrainerId === pt.id).length,
        sessionsThisMonth: db.bookings.filter(b => b.personalTrainerId === pt.id && b.status !== 'CANCELLED').length,
      }
    })
  },

  me: async () => {
    await delay(200)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const p = getPlanById(pt.planId)
    return { ...pt, plan: p ? { id: p.id, name: p.name, type: p.type } : undefined }
  },

  create: async (data: {
    name: string; email: string; password: string; phone?: string; specialty?: string; bio?: string; planId?: string
    teefNumber?: string; teefValidUntil?: string; insuranceValidUntil?: string
  }) => {
    await delay(500)
    const newUser = { id: 'u-' + uid(), email: data.email, password: data.password, name: data.name, role: 'PERSONAL_TRAINER' as const }
    const newPT = {
      id: 'pt-' + uid(), userId: newUser.id, name: data.name, email: data.email, phone: data.phone, specialty: data.specialty, bio: data.bio,
      active: true, inadimplente: false, planId: data.planId, alunoCount: 0, hoursThisMonth: 0, billingCycleAnchorDay: new Date().getDate(),
      teefNumber: data.teefNumber || undefined,
      teefValidUntil: data.teefValidUntil || undefined,
      insuranceValidUntil: data.insuranceValidUntil || undefined,
    }
    db.users.push(newUser)
    db.pts.push(newPT)
    return { ...newPT, plan: getPlanById(data.planId) ?? null }
  },

  update: async (id: string, data: object) => {
    await delay(300)
    const idx = db.pts.findIndex(p => p.id === id)
    if (idx === -1) throw new Error('PT não encontrado')
    db.pts[idx] = { ...db.pts[idx], ...data }
    return db.pts[idx]
  },
}

// ── Alunos ────────────────────────────────────────────────────────────────────
export const alunoApi = {
  list: async () => {
    await delay(250)
    const now = new Date()
    return db.alunos.map(a => ({
      ...a,
      nextSession: db.bookings.find(b => b.alunoId === a.id && b.status === 'CONFIRMED' && new Date(b.startTime) > now)?.startTime,
      completedSessions: db.bookings.filter(b => b.alunoId === a.id && b.status === 'COMPLETED').length,
    }))
  },

  me: async () => {
    await delay(200)
    const user = getCurrentUser()
    return db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
  },

  assinarAnamnese: async (nome: string) => {
    await delay(300)
    const user = getCurrentUser()
    const aluno = db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
    aluno.anamneseAssinadaEm = new Date().toISOString()
    aluno.anamneseAssinadaNome = nome
    return { ...aluno }
  },

  myStudents: async () => {
    await delay(250)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const now = new Date()
    return db.alunos.filter(a => a.personalTrainerId === pt.id).map(a => ({
      ...a,
      nextSession: db.bookings.find(b => b.alunoId === a.id && b.status === 'CONFIRMED' && new Date(b.startTime) > now)?.startTime,
      completedSessions: db.bookings.filter(b => b.alunoId === a.id && b.status === 'COMPLETED').length,
      activePack: db.packs.find(p => p.alunoId === a.id && p.status === 'ACTIVE'),
    }))
  },

  // PT can create a new aluno linked to themselves
  createByPT: async (data: { name: string; email: string; phone?: string; objetivo?: string; dataNascimento?: string }) => {
    await delay(400)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const newUser = { id: 'u-' + uid(), email: data.email, password: 'aluno123', name: data.name, role: 'ALUNO' as const }
    const newAluno = {
      id: 'al-' + uid(), userId: newUser.id, name: data.name, email: data.email, phone: data.phone,
      personalTrainerId: pt.id, personalTrainerName: pt.name,
      completedSessions: 0, status: 'ATIVO' as const,
      dataNascimento: data.dataNascimento, inscricaoDate: new Date().toISOString().split('T')[0],
      objetivo: data.objetivo,
    }
    db.users.push(newUser)
    db.alunos.push(newAluno)
    return newAluno
  },

  create: async (data: { name: string; email: string; password: string; personalTrainerId: string }) => {
    await delay(400)
    const pt = getPTById(data.personalTrainerId)
    const newUser = { id: 'u-' + uid(), email: data.email, password: data.password, name: data.name, role: 'ALUNO' as const }
    const newAluno = {
      id: 'al-' + uid(), userId: newUser.id, name: data.name, email: data.email,
      personalTrainerId: data.personalTrainerId, personalTrainerName: pt?.name ?? '',
      completedSessions: 0, status: 'ATIVO' as const,
      inscricaoDate: new Date().toISOString().split('T')[0],
    }
    db.users.push(newUser)
    db.alunos.push(newAluno)
    return newAluno
  },
}

// ── Availability — PT releases studio slots ───────────────────────────────────
export const availabilityApi = {
  // Returns the studio grid for a week — each slot shows PT's release status + studio occupancy
  studioGrid: async (startDate: string, endDate: string) => {
    await delay(250)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const start = new Date(startDate)
    const end = new Date(endDate)
    const result: Array<{
      date: string; slotTime: string; startTime: string; endTime: string
      released: boolean; releaseId?: string
      studioCount: number; myBookings: number; studioMax: number
      alunoNames?: string[]
    }> = []

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const date = localDate(d)
      const times = getBookableSlotTimesForDay(d)
      for (const time of times) {
        const release = db.ptReleases.find(r => r.ptId === pt.id && r.date === date && r.slotTime === time)
        const { start: s, end: e } = slotKeyToISO(date, time)
        const myCount = getPTSlotCount(pt.id, date, time)
        const slotKey = `${date}-${time}`
        const alunoNames = myCount > 0
          ? db.bookings.filter(b => b.slotKey === slotKey && b.personalTrainerId === pt.id && b.status === 'CONFIRMED').map(b => b.alunoName)
          : []
        result.push({
          date, slotTime: time,
          startTime: s, endTime: e,
          released: !!release,
          releaseId: release?.id,
          studioCount: getStudioSlotCount(date, time),
          myBookings: myCount,
          studioMax: STUDIO_MAX_SPOTS,
          alunoNames,
        })
      }
    }
    return result
  },

  // Legacy: returns PT's released slots as Availability-shaped objects
  mySlots: async (startDate: string, endDate: string) => {
    await delay(250)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()

    return db.ptReleases
      .filter(r => {
        const t = new Date(`${r.date}T${r.slotTime}:00Z`).getTime()
        return r.ptId === pt.id && t >= start && t <= end
      })
      .map(r => {
        const { start: s, end: e } = slotKeyToISO(r.date, r.slotTime)
        const key = `${r.date}-${r.slotTime}`
        const ptCount = getPTSlotCount(pt.id, r.date, r.slotTime)
        const studioCount = getStudioSlotCount(r.date, r.slotTime)
        return {
          id: key,
          personalTrainerId: pt.id,
          personalTrainerName: pt.name,
          startTime: s, endTime: e,
          maxAlunos: STUDIO_MAX_SPOTS,
          confirmedCount: studioCount,
          availableSlots: STUDIO_MAX_SPOTS - studioCount,
          myBookings: ptCount,
        }
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  },

  // Returns PT's released slots with aluno isBooked info (for aluno booking page)
  ptSlots: async (ptId: string, startDate: string, endDate: string) => {
    await delay(250)
    const user = getCurrentUser()
    const aluno = db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
    const pack = db.packs.find(p => p.alunoId === aluno.id && p.status === 'ACTIVE')
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()

    const fromReleases = db.ptReleases
      .filter(r => {
        const t = new Date(`${r.date}T${r.slotTime}:00Z`).getTime()
        return r.ptId === ptId && t >= start && t <= end
      })
      .map(r => {
        const { start: s, end: e } = slotKeyToISO(r.date, r.slotTime)
        const key = `${r.date}-${r.slotTime}`
        const studioCount = getStudioSlotCount(r.date, r.slotTime)
        const isBooked = db.bookings.some(b => b.slotKey === key && b.alunoId === aluno.id && b.status === 'CONFIRMED')
        return {
          id: key,
          personalTrainerId: ptId,
          personalTrainerName: r.ptName,
          startTime: s, endTime: e,
          maxAlunos: STUDIO_MAX_SPOTS,
          confirmedCount: studioCount,
          availableSlots: Math.max(0, STUDIO_MAX_SPOTS - studioCount),
          isBooked,
          sessionDuration: pack?.sessionDuration ?? 60,
          packRemaining: pack ? pack.total - pack.used : 0,
        }
      })

    const seenKeys = new Set(fromReleases.map(s => s.id))

    // The list ("Últimas Sessões") reads straight from db.bookings, with no
    // dependency on a release row existing. If the aluno has a booking whose
    // slot isn't backed by a release (e.g. released, then later un-released
    // by the PT, or a slot from before release history starts), the grid
    // must still show it — same data as the list, always.
    const fromMyBookings = db.bookings
      .filter(b => {
        if (b.alunoId !== aluno.id || b.personalTrainerId !== ptId) return false
        if (seenKeys.has(b.slotKey)) return false
        const t = new Date(b.startTime).getTime()
        return t >= start && t <= end
      })
      .map(b => ({
        id: b.slotKey,
        personalTrainerId: ptId,
        personalTrainerName: b.personalTrainerName,
        startTime: b.startTime, endTime: b.endTime,
        maxAlunos: STUDIO_MAX_SPOTS,
        confirmedCount: getStudioSlotCount(b.slotKey.slice(0, 10), b.slotKey.slice(11)),
        availableSlots: 0,
        isBooked: b.status === 'CONFIRMED',
        sessionDuration: pack?.sessionDuration ?? 60,
        packRemaining: pack ? pack.total - pack.used : 0,
      }))

    return [...fromReleases, ...fromMyBookings]
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  },

  // PT releases a slot (creates MockPTRelease)
  create: async (data: { date: string; slotTime: string }) => {
    await delay(300)
    if (isSlotBlocked(data.date, data.slotTime)) {
      throw new Error('Este horário está bloqueado pelo estúdio (feriado ou fecho)')
    }
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const existing = db.ptReleases.find(r => r.ptId === pt.id && r.date === data.date && r.slotTime === data.slotTime)
    if (existing) return existing
    const release = { id: 'rel-' + uid(), ptId: pt.id, ptName: pt.name, date: data.date, slotTime: data.slotTime }
    db.ptReleases.push(release)
    return release
  },

  // Admin creates a release on behalf of a PT
  createForPT: async (data: { ptId: string; date: string; slotTime: string }) => {
    await delay(300)
    if (isSlotBlocked(data.date, data.slotTime)) {
      throw new Error('Este horário está bloqueado pelo estúdio (feriado ou fecho)')
    }
    const pt = getPTById(data.ptId)
    if (!pt) throw new Error('PT não encontrado')
    const existing = db.ptReleases.find(r => r.ptId === data.ptId && r.date === data.date && r.slotTime === data.slotTime)
    if (existing) return existing
    const release = { id: 'rel-' + uid(), ptId: data.ptId, ptName: pt.name, date: data.date, slotTime: data.slotTime }
    db.ptReleases.push(release)
    return release
  },

  // PT or admin removes a release
  delete: async (releaseId: string) => {
    await delay(280)
    const release = db.ptReleases.find(r => r.id === releaseId)
    if (!release) throw new Error('Release não encontrado')
    const key = `${release.date}-${release.slotTime}`
    const hasBookings = db.bookings.some(b => b.slotKey === key && b.personalTrainerId === release.ptId && b.status === 'CONFIRMED')
    if (hasBookings) throw new Error('Tens alunos confirmados neste slot — cancela as reservas primeiro')
    const idx = db.ptReleases.findIndex(r => r.id === releaseId)
    if (idx !== -1) db.ptReleases.splice(idx, 1)
  },

  // Returns who's booked in a specific slot (for PT agenda view)
  attendees: async (slotKey: string) => {
    await delay(200)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    return db.bookings
      .filter(b => b.slotKey === slotKey && b.personalTrainerId === pt.id && b.status === 'CONFIRMED')
      .map(b => ({ bookingId: b.id, alunoId: b.alunoId, alunoName: b.alunoName, status: b.status }))
  },
}

// ── Admin Schedule ────────────────────────────────────────────────────────────
export const adminScheduleApi = {
  // Returns all studio slots for date range with PT releases per slot
  list: async (startDate: string, endDate: string) => {
    await delay(280)
    const start = new Date(startDate)
    const end = new Date(endDate)
    const result: Array<{
      date: string; slotTime: string; startTime: string; endTime: string
      studioCount: number; studioMax: number
      releases: Array<{ releaseId: string; ptId: string; ptName: string; confirmedCount: number }>
      blocked: boolean; blockReason?: string; blockId?: string
    }> = []

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const date = localDate(d)
      const times = getSlotTimesForDay(d)
      for (const time of times) {
        const { start: s, end: e } = slotKeyToISO(date, time)
        const releases = db.ptReleases
          .filter(r => r.date === date && r.slotTime === time)
          .map(r => ({ releaseId: r.id, ptId: r.ptId, ptName: r.ptName, confirmedCount: getPTSlotCount(r.ptId, date, time) }))
        const block = studioBlocks.find(b => {
          if (b.date !== date) return false
          const [bh, bm] = b.startTime.split(':').map(Number)
          const [eh, em] = b.endTime.split(':').map(Number)
          const [th, tm] = time.split(':').map(Number)
          const slotStart = th * 60 + tm
          return slotStart >= bh * 60 + bm && slotStart < eh * 60 + em
        })
        result.push({
          date, slotTime: time,
          startTime: s, endTime: e,
          studioCount: getStudioSlotCount(date, time),
          studioMax: STUDIO_MAX_SPOTS,
          releases,
          blocked: !!block,
          blockReason: block?.reason,
          blockId: block?.id,
        })
      }
    }
    return result
  },

  addRelease: async (data: { ptId: string; date: string; slotTime: string }) => {
    return availabilityApi.createForPT(data)
  },

  removeRelease: async (releaseId: string) => {
    await delay(280)
    const idx = db.ptReleases.findIndex(r => r.id === releaseId)
    if (idx !== -1) db.ptReleases.splice(idx, 1)
  },

  // Admin sees attendees for any PT's slot (not scoped to the current user) —
  // includes contact info so admin can reach the student directly from the modal.
  attendees: async (ptId: string, slotKey: string) => {
    await delay(200)
    return db.bookings
      .filter(b => b.slotKey === slotKey && b.personalTrainerId === ptId && b.status === 'CONFIRMED')
      .map(b => {
        const aluno = db.alunos.find(a => a.id === b.alunoId)
        return {
          bookingId: b.id, alunoId: b.alunoId, alunoName: b.alunoName, status: b.status,
          email: aluno?.email, phone: aluno?.phone,
        }
      })
  },
}

// ── Studio Schedule (weekly hours + one-off blocks) ───────────────────────────
export const studioScheduleApi = {
  getWeeklyHours: async () => { await delay(150); return [...studioSchedule] },

  updateWeeklyHours: async (dayOfWeek: number, openTime: string | null, closeTime: string | null) => {
    await delay(250)
    const day = studioSchedule.find(d => d.dayOfWeek === dayOfWeek)
    if (!day) throw new Error('Dia inválido')
    day.openTime = openTime
    day.closeTime = closeTime
    return day
  },

  listBlocks: async (startDate: string, endDate: string) => {
    await delay(200)
    return studioBlocks
      .filter(b => b.date >= startDate && b.date <= endDate)
      .sort((a, b) => a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date))
  },

  createBlock: async (data: { date: string; startTime: string; endTime: string; reason: string }) => {
    await delay(300)
    const hasBookings = db.bookings.some(b => {
      if (b.status !== 'CONFIRMED' || !b.slotKey.startsWith(data.date)) return false
      const slotTime = b.slotKey.slice(11)
      const [th, tm] = slotTime.split(':').map(Number)
      const [sh, sm] = data.startTime.split(':').map(Number)
      const [eh, em] = data.endTime.split(':').map(Number)
      const slotStart = th * 60 + tm
      return slotStart >= sh * 60 + sm && slotStart < eh * 60 + em
    })
    if (hasBookings) {
      throw new Error('Já existem alunos confirmados neste horário — cancela as reservas primeiro')
    }
    const block = { id: 'block-' + uid(), ...data }
    studioBlocks.push(block)
    return block
  },

  deleteBlock: async (id: string) => {
    await delay(250)
    const idx = studioBlocks.findIndex(b => b.id === id)
    if (idx !== -1) studioBlocks.splice(idx, 1)
  },
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookingApi = {
  myBookings: async () => {
    await delay(250)
    const user = getCurrentUser()
    const aluno = db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
    return db.bookings
      .filter(b => b.alunoId === aluno.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  },

  // slotKey = "YYYY-MM-DD-HH:MM" (=availabilityId)
  create: async (slotKey: string) => {
    await delay(400)
    const user = getCurrentUser()
    const aluno = db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]

    // Parse slotKey
    const date = slotKey.slice(0, 10)
    const slotTime = slotKey.slice(11)

    // Check PT released this slot (any PT — aluno is linked to specific PT)
    const ptRelease = db.ptReleases.find(r => r.ptId === aluno.personalTrainerId && r.date === date && r.slotTime === slotTime)
    if (!ptRelease) throw new Error('O teu PT não tem disponibilidade neste horário')

    // Defense in depth — a block added after the PT released this slot
    // should still make it unbookable.
    if (isSlotBlocked(date, slotTime)) throw new Error('Este horário está bloqueado pelo estúdio')

    // Sessions are 1-on-1 — a PT can only have one student per slot, never a group
    const ptAlreadyBooked = db.bookings.some(b =>
      b.slotKey === slotKey && b.personalTrainerId === aluno.personalTrainerId && b.status === 'CONFIRMED'
    )
    if (ptAlreadyBooked) throw new Error('O teu PT já tem uma sessão marcada neste horário — escolhe outro horário')

    // Check studio max (4 across all PTs)
    const studioCount = getStudioSlotCount(date, slotTime)
    if (studioCount >= STUDIO_MAX_SPOTS) throw new Error('Slot lotado — 4/4 vagas do estúdio preenchidas')

    // Check aluno not already booked
    const already = db.bookings.some(b => b.slotKey === slotKey && b.alunoId === aluno.id && b.status === 'CONFIRMED')
    if (already) throw new Error('Já tens uma reserva neste horário')

    // Check active pack with remaining sessions
    const pack = db.packs.find(p => p.alunoId === aluno.id && p.status === 'ACTIVE')
    if (!pack) throw new Error('Não tens sessões disponíveis. Fala com o teu PT para carregar um pack.')
    if (pack.total - pack.used <= 0) throw new Error('Pack sem sessões disponíveis — fala com o teu PT')

    const { start, end } = slotKeyToISO(date, slotTime)
    const booking = {
      id: 'bk-' + uid(),
      slotKey, availabilityId: slotKey,
      alunoId: aluno.id, alunoName: aluno.name,
      personalTrainerId: aluno.personalTrainerId,
      personalTrainerName: aluno.personalTrainerName,
      startTime: start, endTime: end,
      sessionDuration: pack.sessionDuration,
      status: 'CONFIRMED' as const,
      createdAt: new Date().toISOString(),
    }
    db.bookings.push(booking)

    // Debit pack
    pack.used++
    if (pack.total - pack.used === 0) pack.status = 'DEPLETED'

    return booking
  },

  // Cancel with role-based time enforcement
  // Aluno: >= 24h | PT: >= 12h | Admin: always
  cancel: async (bookingId: string) => {
    await delay(300)
    const booking = db.bookings.find(b => b.id === bookingId)
    if (!booking) throw new Error('Reserva não encontrada')

    const user = getCurrentUser()
    const role = user?.role ?? 'ALUNO'
    const now = new Date()
    const sessionTime = new Date(booking.startTime)
    const hoursUntil = (sessionTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (role === 'ALUNO' && hoursUntil < 24) {
      throw new Error('Só é possível cancelar com mais de 24h de antecedência. Para casos excecionais dentro desse prazo, contacta o estúdio diretamente.')
    }
    if (role === 'PERSONAL_TRAINER' && hoursUntil < 12) {
      throw new Error('Só podes cancelar com pelo menos 12h de antecedência')
    }
    // ADMIN: no restriction

    booking.status = 'CANCELLED'

    // Refund session to pack if future booking
    if (hoursUntil > 0) {
      const pack = db.packs.find(p => p.alunoId === booking.alunoId && (p.status === 'ACTIVE' || p.status === 'DEPLETED'))
      if (pack) {
        pack.used = Math.max(0, pack.used - 1)
        if (pack.status === 'DEPLETED') pack.status = 'ACTIVE'
      }
    }

    return booking
  },
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  alunosByPt: async (ptId: string) => {
    await delay(250)
    return db.alunos.filter(a => a.personalTrainerId === ptId)
  },

  allAlunos: async () => {
    await delay(280)
    return db.alunos
  },

  alunoById: async (id: string) => {
    await delay(200)
    const aluno = db.alunos.find(a => a.id === id)
    if (!aluno) throw new Error('Aluno não encontrado')
    const bookings = db.bookings.filter(b => b.alunoId === id)
    const packs = db.packs.filter(p => p.alunoId === id)
    const avaliacoes = db.avaliacoes.filter(a => a.alunoId === id)
    const workoutPlan = db.workoutPlans.find(p => p.alunoId === id)
    return { aluno, bookings, packs, avaliacoes, workoutPlan }
  },

  createAluno: async (data: {
    name: string; email: string; phone?: string; personalTrainerId: string
    dataNascimento?: string; genero?: 'MASCULINO' | 'FEMININO' | 'OUTRO'; profissao?: string
    objetivo?: string; prazoObjetivo?: string; disponibilidadeSemanal?: number
    doencas?: string[]; doencasOutras?: string; cirurgias?: string; medicamentos?: string
    limitacoesFisicas?: string; fumante?: boolean; alcool?: 'NUNCA' | 'OCASIONAL' | 'FREQUENTE'
    praticouAtividade?: boolean; atividadeAnterior?: string; tempoSemAtividade?: string
    nivelAtividade?: 'SEDENTARIO' | 'POUCO_ATIVO' | 'ATIVO' | 'MUITO_ATIVO'
    horasSono?: number; nivelEstresse?: 'BAIXO' | 'MEDIO' | 'ALTO'; observacoesGerais?: string
  }) => {
    await delay(400)
    const pt = db.pts.find(p => p.id === data.personalTrainerId)
    if (!pt) throw new Error('PT não encontrado')
    const newUser = { id: 'u-' + uid(), email: data.email, name: data.name, password: 'aluno123', role: 'ALUNO' as const }
    db.users.push(newUser)
    const { personalTrainerId, ...rest } = data
    const newAluno = {
      id: 'al-' + uid(), userId: newUser.id,
      personalTrainerId, personalTrainerName: pt.name,
      completedSessions: 0, status: 'ATIVO' as const,
      inscricaoDate: new Date().toISOString().split('T')[0],
      doencas: data.doencas ?? [],
      ...rest,
    }
    db.alunos.push(newAluno)
    return newAluno
  },

  updateAluno: async (id: string, data: Partial<{
    status: 'ATIVO' | 'INATIVO' | 'SUSPENSO'; phone: string
    objetivo: string; genero: 'MASCULINO' | 'FEMININO' | 'OUTRO'; profissao: string
    prazoObjetivo: string; disponibilidadeSemanal: number
    doencas: string[]; doencasOutras: string; cirurgias: string; medicamentos: string
    limitacoesFisicas: string; fumante: boolean; alcool: 'NUNCA' | 'OCASIONAL' | 'FREQUENTE'
    praticouAtividade: boolean; atividadeAnterior: string; tempoSemAtividade: string
    nivelAtividade: 'SEDENTARIO' | 'POUCO_ATIVO' | 'ATIVO' | 'MUITO_ATIVO'
    horasSono: number; nivelEstresse: 'BAIXO' | 'MEDIO' | 'ALTO'; observacoesGerais: string
  }>) => {
    await delay(300)
    const aluno = db.alunos.find(a => a.id === id)
    if (!aluno) throw new Error('Aluno não encontrado')
    // personalTrainerId is permanent — set at registration and cannot be changed
    Object.assign(aluno, data)
    return aluno
  },

  // Admin cancels any booking (no time restriction)
  cancelBooking: async (bookingId: string) => {
    await delay(300)
    const booking = db.bookings.find(b => b.id === bookingId)
    if (!booking) throw new Error('Reserva não encontrada')
    booking.status = 'CANCELLED'
    const pack = db.packs.find(p => p.alunoId === booking.alunoId && (p.status === 'ACTIVE' || p.status === 'DEPLETED'))
    if (pack) {
      pack.used = Math.max(0, pack.used - 1)
      if (pack.status === 'DEPLETED') pack.status = 'ACTIVE'
    }
    return booking
  },
}

// ── Modalidades ───────────────────────────────────────────────────────────────
export const modalidadeApi = {
  list: async () => { await delay(200); return [...db.modalidades] },
  create: async (data: { name: string; categoria?: string; descricao?: string; cor?: string }) => {
    await delay(400)
    const nova = { id: 'mod-' + uid(), name: data.name, categoria: data.categoria, descricao: data.descricao, cor: data.cor ?? '#111111', active: true, createdAt: new Date().toISOString() }
    db.modalidades.push(nova)
    return nova
  },
  update: async (id: string, data: object) => {
    await delay(300)
    const idx = db.modalidades.findIndex(m => m.id === id)
    if (idx === -1) throw new Error('Modalidade não encontrada')
    db.modalidades[idx] = { ...db.modalidades[idx], ...data }
    return db.modalidades[idx]
  },
  delete: async (id: string) => {
    await delay(300)
    const idx = db.modalidades.findIndex(m => m.id === id)
    if (idx !== -1) db.modalidades.splice(idx, 1)
  },
}

// ── Plans ─────────────────────────────────────────────────────────────────────
export const planApi = {
  list: async () => {
    await delay(200)
    return db.plans.map(p => ({ ...p, ptCount: db.pts.filter(pt => pt.planId === p.id).length }))
  },
  create: async (data: { name: string; type: string; priceHourly?: number; priceWeekly?: number; priceMonthly?: number; description?: string }) => {
    await delay(400)
    const novo = { id: 'plan-' + uid(), ...data } as typeof db.plans[0]
    db.plans.push(novo)
    return novo
  },
  update: async (id: string, data: object) => {
    await delay(300)
    const idx = db.plans.findIndex(p => p.id === id)
    if (idx === -1) throw new Error('Plano não encontrado')
    db.plans[idx] = { ...db.plans[idx], ...data }
    return db.plans[idx]
  },
}

// ── Tiered hourly pricing (per plan, admin-configurable) ──────────────────────
// Progressive bracket calculation — like a tax bracket, each bracket of hours
// is charged its own rate, not "whichever bracket the total falls into
// applies to everything". Pure function, easy to unit-test in isolation.
export function computeTieredAmount(hoursWorked: number, tiers: MockPlanHourTier[]) {
  const sorted = [...tiers].sort((a, b) => a.tierOrder - b.tierOrder)
  let amount = 0
  let bonus = 0
  const bracketsReached: number[] = []
  for (const tier of sorted) {
    const hoursInTier = tier.hoursTo === null
      ? Math.max(0, hoursWorked - tier.hoursFrom + 1)
      : Math.max(0, Math.min(hoursWorked, tier.hoursTo) - tier.hoursFrom + 1)
    if (hoursInTier > 0) {
      amount += hoursInTier * tier.pricePerHour
      bonus += tier.bonus
      bracketsReached.push(tier.tierOrder)
    }
  }
  return { amount, bonus, bracketsReached }
}

export const planTierApi = {
  listTiers: async (planId: string) => {
    await delay(150)
    return db.planHourTiers.filter(t => t.planId === planId).sort((a, b) => a.tierOrder - b.tierOrder)
  },
  // Replaces all tiers for a plan — simpler than per-row CRUD for an admin editor
  saveTiers: async (planId: string, tiers: Omit<MockPlanHourTier, 'id' | 'planId'>[]) => {
    await delay(300)
    const kept = db.planHourTiers.filter(t => t.planId !== planId)
    const next = tiers.map((t, i) => ({ id: 'tier-' + uid(), planId, ...t, tierOrder: i + 1 }))
    db.planHourTiers.length = 0
    db.planHourTiers.push(...kept, ...next)
    return next
  },
}

// ── Avaliações Físicas ────────────────────────────────────────────────────────
export const avaliacaoApi = {
  byAluno: async (alunoId: string) => {
    await delay(250)
    return db.avaliacoes.filter(a => a.alunoId === alunoId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  },
  create: async (data: Omit<import('@/lib/mock-db').MockAvaliacao, 'id' | 'createdAt'>) => {
    await delay(400)
    const nova = { ...data, id: 'av-eval-' + uid(), createdAt: new Date().toISOString() }
    db.avaliacoes.push(nova)
    return nova
  },
  update: async (id: string, data: Partial<import('@/lib/mock-db').MockAvaliacao>) => {
    await delay(300)
    const av = db.avaliacoes.find(a => a.id === id)
    if (!av) throw new Error('Avaliação não encontrada')
    Object.assign(av, data)
    return av
  },
}

// ── Packs de Sessões ──────────────────────────────────────────────────────────
export const packApi = {
  byAluno: async (alunoId: string) => {
    await delay(200)
    return db.packs.filter(p => p.alunoId === alunoId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },
  allActive: async () => { await delay(250); return db.packs.filter(p => p.status === 'ACTIVE') },
  create: async (data: { alunoId: string; total: number; sessionDuration: 30 | 60; expiresAt?: string }) => {
    await delay(350)
    const aluno = db.alunos.find(a => a.id === data.alunoId)
    if (!aluno) throw new Error('Aluno não encontrado')
    const novo = {
      id: 'pack-' + uid(), alunoId: data.alunoId, alunoName: aluno.name,
      total: data.total, used: 0,
      sessionDuration: data.sessionDuration,
      expiresAt: data.expiresAt, status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
    }
    db.packs.push(novo)
    return novo
  },
  debitSession: async (packId: string) => {
    await delay(250)
    const pack = db.packs.find(p => p.id === packId)
    if (!pack) throw new Error('Pack não encontrado')
    if (pack.total - pack.used <= 0) throw new Error('Pack sem sessões disponíveis')
    pack.used++
    if (pack.total - pack.used === 0) pack.status = 'DEPLETED'
    return pack
  },
}

// ── Leads CRM ─────────────────────────────────────────────────────────────────
export const leadApi = {
  list: async () => { await delay(280); return db.leads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) },
  byStatus: async (status: import('@/lib/mock-db').MockLead['status']) => { await delay(200); return db.leads.filter(l => l.status === status) },
  create: async (data: Omit<import('@/lib/mock-db').MockLead, 'id' | 'createdAt' | 'updatedAt'>) => {
    await delay(350)
    const novo = { ...data, id: 'lead-' + uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    db.leads.push(novo)
    return novo
  },
  updateStatus: async (id: string, status: import('@/lib/mock-db').MockLead['status'], data?: Partial<import('@/lib/mock-db').MockLead>) => {
    await delay(300)
    const lead = db.leads.find(l => l.id === id)
    if (!lead) throw new Error('Lead não encontrado')
    lead.status = status
    lead.updatedAt = new Date().toISOString()
    if (data) Object.assign(lead, data)
    return lead
  },
  delete: async (id: string) => {
    await delay(250)
    const idx = db.leads.findIndex(l => l.id === id)
    if (idx !== -1) db.leads.splice(idx, 1)
  },
  convertToAluno: async (leadId: string, personalTrainerId: string) => {
    await delay(400)
    const lead = db.leads.find(l => l.id === leadId)
    if (!lead) throw new Error('Lead não encontrado')
    const pt = db.pts.find(p => p.id === personalTrainerId) ?? db.pts[0]
    const newUserId = 'u-' + uid()
    const newAlunoId = 'al-' + uid()
    db.users.push({ id: newUserId, email: lead.email ?? `${newAlunoId}@fittrainly.com`, password: 'aluno123', name: lead.name, role: 'ALUNO' })
    const aluno = {
      id: newAlunoId, userId: newUserId, name: lead.name,
      email: lead.email ?? '', phone: lead.phone ?? undefined,
      personalTrainerId: pt.id, personalTrainerName: pt.name,
      status: 'ATIVO' as const, inscricaoDate: new Date().toISOString().slice(0, 10),
      completedSessions: 0, objetivo: lead.interesse ?? undefined,
    }
    db.alunos.push(aluno)
    pt.alunoCount = db.alunos.filter(a => a.personalTrainerId === pt.id).length
    lead.status = 'INSCRITO'
    lead.inscritoEm = new Date().toISOString()
    lead.updatedAt = new Date().toISOString()
    return aluno
  },
}

// ── Notificações ──────────────────────────────────────────────────────────────
export const notificationApi = {
  list: async () => { await delay(200); return db.notificationConfigs },
  toggle: async (id: string, enabled: boolean) => {
    await delay(250)
    const config = db.notificationConfigs.find(n => n.id === id)
    if (!config) throw new Error('Configuração não encontrada')
    config.enabled = enabled
    return config
  },
  update: async (id: string, data: Partial<{ enabled: boolean; daysOffset: number }>) => {
    await delay(250)
    const config = db.notificationConfigs.find(n => n.id === id)
    if (!config) throw new Error('Configuração não encontrada')
    Object.assign(config, data)
    return config
  },
}

// ── Workout Plans ─────────────────────────────────────────────────────────────
export const workoutApi = {
  ptAlunos: async (ptId: string) => {
    await delay(250)
    return db.alunos.filter(a => a.personalTrainerId === ptId).map(a => ({ ...a, planCount: db.workoutPlans.filter(p => p.alunoId === a.id).length }))
  },
  plans: async (alunoId: string) => { await delay(250); return db.workoutPlans.filter(p => p.alunoId === alunoId) },
  savePlan: async (data: { alunoId: string; alunoName: string; ptId: string; label: string; focus: string; exercises: import('@/types').Exercise[]; validUntil?: string }) => {
    await delay(350)
    const existing = db.workoutPlans.find(p => p.alunoId === data.alunoId && p.label === data.label)
    if (existing) { Object.assign(existing, { ...data, updatedAt: new Date().toISOString() }); return existing }
    const novo = { ...data, id: 'wp-' + uid(), updatedAt: new Date().toISOString() }
    db.workoutPlans.push(novo)
    return novo
  },
  updateValidity: async (planId: string, validUntil: string) => {
    await delay(250)
    const plan = db.workoutPlans.find(p => p.id === planId)
    if (!plan) throw new Error('Plano não encontrado')
    plan.validUntil = validUntil; plan.updatedAt = new Date().toISOString()
    return plan
  },
  addExercise: async (planId: string, exercise: Omit<import('@/types').Exercise, 'id'>) => {
    await delay(300)
    const plan = db.workoutPlans.find(p => p.id === planId)
    if (!plan) throw new Error('Plano não encontrado')
    const novo = { ...exercise, id: 'ex-' + uid() }
    plan.exercises.push(novo); plan.updatedAt = new Date().toISOString()
    return novo
  },
  removeExercise: async (planId: string, exerciseId: string) => {
    await delay(200)
    const plan = db.workoutPlans.find(p => p.id === planId)
    if (!plan) throw new Error('Plano não encontrado')
    plan.exercises = plan.exercises.filter(e => e.id !== exerciseId)
    plan.updatedAt = new Date().toISOString()
  },
  deletePlan: async (planId: string) => {
    await delay(300)
    const idx = db.workoutPlans.findIndex(p => p.id === planId)
    if (idx !== -1) db.workoutPlans.splice(idx, 1)
  },
}

// ── Billing ───────────────────────────────────────────────────────────────────
export const billingApi = {
  byMonth: async (month?: string) => {
    await delay(300)
    const currentMonth = month ?? new Date().toISOString().slice(0, 7)
    const entries = db.pts.map(pt => {
      const plan = getPlanById(pt.planId)
      let value = 0
      if (plan) {
        if (plan.type === 'MONTHLY') value = plan.priceMonthly ?? 0
        if (plan.type === 'WEEKLY') value = (plan.priceWeekly ?? 0) * 4
        if (plan.type === 'HOURLY') value = (plan.priceHourly ?? 0) * pt.hoursThisMonth
      }
      const sessionsCount = db.bookings.filter(b =>
        b.personalTrainerId === pt.id &&
        (b.status === 'CONFIRMED' || b.status === 'COMPLETED') &&
        b.startTime.slice(0, 7) === currentMonth
      ).length
      if (plan?.type === 'HOURLY') value = (plan.priceHourly ?? 0) * sessionsCount
      if (plan?.type === 'TIERED_HOURLY') {
        const tiers = db.planHourTiers.filter(t => t.planId === plan.id)
        value = computeTieredAmount(sessionsCount, tiers).amount
      }
      return { ptId: pt.id, ptName: pt.name, planName: plan?.name ?? '—', planType: plan?.type ?? '—', sessionsCount, value }
    })
    return { entries, total: entries.reduce((s, e) => s + e.value, 0), month: currentMonth }
  },
}

// ── PT weekly payment cycle (TIERED_HOURLY plans only) ────────────────────────
// Rental model: the PT pays the studio, not the other way around. Every
// Monday except the last one of the month, the PT is advanced the week's
// hours at the tier-1 (highest) rate, since the month total isn't known yet.
// On the last Monday, the whole month is recalculated progressively across
// brackets and reconciled against what was already advanced — always a
// credit back to the PT, since more hours only ever make the marginal rate
// cheaper, never more expensive.
export const ptPaymentApi = {
  weeklySchedule: async (ptId: string, month: string) => {
    await delay(250)
    const pt = db.pts.find(p => p.id === ptId)
    if (!pt) throw new Error('PT não encontrado')
    const plan = getPlanById(pt.planId)
    if (!plan || plan.type !== 'TIERED_HOURLY') throw new Error('Este PT não está num plano por faixas')
    const tiers = db.planHourTiers.filter(t => t.planId === plan.id).sort((a, b) => a.tierOrder - b.tierOrder)
    const tier1Rate = tiers[0]?.pricePerHour ?? 0

    const [year, m] = month.split('-').map(Number)
    const monthStart = new Date(year, m - 1, 1)
    const monthEnd = new Date(year, m, 0)

    const cursor = new Date(monthStart)
    const dow = cursor.getDay()
    cursor.setDate(cursor.getDate() + (dow === 0 ? -6 : 1 - dow))

    const weeks: Array<{
      weekStart: string; weekEnd: string; hoursThisWeek: number; cumulativeHours: number
      isClosingWeek: boolean; amountAdvanced: number; retroactiveAdjustment?: number; bonus?: number
    }> = []

    let cumulativeHours = 0
    while (cursor <= monthEnd) {
      const weekStart = cursor < monthStart ? monthStart : new Date(cursor)
      const weekEndRaw = new Date(cursor); weekEndRaw.setDate(weekEndRaw.getDate() + 6)
      const weekEnd = weekEndRaw > monthEnd ? monthEnd : weekEndRaw
      const nextMonday = new Date(cursor); nextMonday.setDate(nextMonday.getDate() + 7)
      const isClosingWeek = nextMonday > monthEnd

      const hoursThisWeek = db.bookings.filter(b => {
        if (b.personalTrainerId !== ptId) return false
        if (b.status !== 'CONFIRMED' && b.status !== 'COMPLETED') return false
        const d = new Date(b.startTime)
        return d >= weekStart && d <= weekEnd
      }).length

      cumulativeHours += hoursThisWeek
      const week: typeof weeks[0] = {
        weekStart: localDate(weekStart), weekEnd: localDate(weekEnd),
        hoursThisWeek, cumulativeHours, isClosingWeek,
        amountAdvanced: hoursThisWeek * tier1Rate,
      }

      if (isClosingWeek) {
        const settlement = computeTieredAmount(cumulativeHours, tiers)
        week.retroactiveAdjustment = settlement.amount - (cumulativeHours * tier1Rate)
        week.bonus = settlement.bonus
      }

      weeks.push(week)
      cursor.setDate(cursor.getDate() + 7)
    }

    return { ptId, ptName: pt.name, planName: plan.name, tiers, weeks, totalHours: cumulativeHours }
  },
}
