'use client'

import {
  db, delay, uid, getCurrentUser, syncSlotCounts,
  getSlotsForPT, getSlotsInRange, getPlanById, getPTById,
  sessionsThisWeek, estimatedRevenue, getOccupationByDay,
} from './mock-db'

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

    const nextSessions = db.availabilities
      .filter(s => s.personalTrainerId === pt.id && new Date(s.startTime) > now && s.confirmedCount > 0)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5)
      .map(s => ({
        availabilityId: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        confirmedAlunos: s.confirmedCount,
        maxAlunos: s.maxAlunos,
      }))

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
    const nextSlot = nextBooking ? db.availabilities.find(s => s.id === nextBooking.availabilityId) : undefined

    return {
      nextSession: nextBooking ? {
        availabilityId: nextBooking.availabilityId,
        startTime: nextBooking.startTime,
        endTime: nextBooking.endTime,
        confirmedAlunos: nextSlot?.confirmedCount ?? 1,
        maxAlunos: nextSlot?.maxAlunos ?? 4,
      } : undefined,
      upcomingCount: upcoming.length,
      completedCount: myBookings.filter(b => b.status === 'COMPLETED').length,
      ptName: aluno.personalTrainerName,
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
    name: string; email: string; password: string
    phone?: string; specialty?: string; bio?: string; planId?: string
  }) => {
    await delay(500)
    const newUser = { id: 'u-' + uid(), email: data.email, password: data.password, name: data.name, role: 'PERSONAL_TRAINER' as const }
    const newPT = {
      id: 'pt-' + uid(), userId: newUser.id, name: data.name, email: data.email,
      phone: data.phone, specialty: data.specialty, bio: data.bio,
      active: true, inadimplente: false, planId: data.planId,
      alunoCount: 0, hoursThisMonth: 0,
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
    return db.alunos.map(a => ({
      ...a,
      nextSession: db.bookings.find(b => b.alunoId === a.id && b.status === 'CONFIRMED' && new Date(b.startTime) > new Date())?.startTime,
      completedSessions: db.bookings.filter(b => b.alunoId === a.id && b.status === 'COMPLETED').length,
    }))
  },

  me: async () => {
    await delay(200)
    const user = getCurrentUser()
    return db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
  },

  myStudents: async () => {
    await delay(250)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    return db.alunos.filter(a => a.personalTrainerId === pt.id).map(a => ({
      ...a,
      nextSession: db.bookings.find(b => b.alunoId === a.id && b.status === 'CONFIRMED' && new Date(b.startTime) > new Date())?.startTime,
      completedSessions: db.bookings.filter(b => b.alunoId === a.id && b.status === 'COMPLETED').length,
    }))
  },

  create: async (data: { name: string; email: string; password: string; personalTrainerId: string }) => {
    await delay(400)
    const pt = getPTById(data.personalTrainerId)
    const newUser = { id: 'u-' + uid(), email: data.email, password: data.password, name: data.name, role: 'ALUNO' as const }
    const newAluno = {
      id: 'al-' + uid(), userId: newUser.id, name: data.name, email: data.email,
      personalTrainerId: data.personalTrainerId,
      personalTrainerName: pt?.name ?? '',
      completedSessions: 0,
    }
    db.users.push(newUser)
    db.alunos.push(newAluno)
    return newAluno
  },
}

// ── Modalidades ───────────────────────────────────────────────────────────────
export const modalidadeApi = {
  list: async () => {
    await delay(200)
    return [...db.modalidades]
  },

  create: async (data: { name: string; categoria?: string; descricao?: string; cor?: string }) => {
    await delay(400)
    const nova = {
      id: 'mod-' + uid(), name: data.name, categoria: data.categoria,
      descricao: data.descricao, cor: data.cor ?? '#111111',
      active: true, createdAt: new Date().toISOString(),
    }
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
    return db.plans.map(p => ({
      ...p,
      ptCount: db.pts.filter(pt => pt.planId === p.id).length,
    }))
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

// ── Availability ──────────────────────────────────────────────────────────────
export const availabilityApi = {
  mySlots: async (startDate: string, endDate: string) => {
    await delay(250)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    return getSlotsForPT(pt.id, startDate, endDate)
  },

  ptSlots: async (ptId: string, startDate: string, endDate: string) => {
    await delay(250)
    return getSlotsForPT(ptId, startDate, endDate).map(s => ({
      ...s,
      isBooked: db.bookings.some(b => {
        const user = getCurrentUser()
        const aluno = db.alunos.find(a => a.userId === user?.id)
        return b.availabilityId === s.id && b.alunoId === aluno?.id && b.status === 'CONFIRMED'
      }),
    }))
  },

  create: async (data: { startTime: string; endTime: string; maxAlunos?: number }) => {
    await delay(350)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const novo = {
      id: 'av-' + uid(), personalTrainerId: pt.id, personalTrainerName: pt.name,
      startTime: data.startTime, endTime: data.endTime,
      maxAlunos: data.maxAlunos ?? 4, confirmedCount: 0, availableSlots: data.maxAlunos ?? 4,
    }
    db.availabilities.push(novo)
    return novo
  },

  delete: async (id: string) => {
    await delay(300)
    const hasBookings = db.bookings.some(b => b.availabilityId === id && b.status === 'CONFIRMED')
    if (hasBookings) throw new Error('Slot tem reservas confirmadas e não pode ser apagado')
    const idx = db.availabilities.findIndex(s => s.id === id)
    if (idx !== -1) db.availabilities.splice(idx, 1)
  },

  attendees: async (id: string) => {
    await delay(200)
    return db.bookings.filter(b => b.availabilityId === id && b.status === 'CONFIRMED')
      .map(b => ({ alunoId: b.alunoId, alunoName: b.alunoName, status: b.status }))
  },
}

// ── Admin Schedule ────────────────────────────────────────────────────────────
export const adminScheduleApi = {
  list: async (startDate: string, endDate: string) => {
    await delay(280)
    return getSlotsInRange(startDate, endDate).map(s => ({
      ...s,
      attendees: db.bookings
        .filter(b => b.availabilityId === s.id && b.status === 'CONFIRMED')
        .map(b => ({ id: b.alunoId, name: b.alunoName })),
    }))
  },

  create: async (data: { ptId: string; startTime: string; endTime: string; maxAlunos?: number }) => {
    await delay(350)
    const pt = getPTById(data.ptId)
    const novo = {
      id: 'av-' + uid(), personalTrainerId: data.ptId,
      personalTrainerName: pt?.name ?? '',
      startTime: data.startTime, endTime: data.endTime,
      maxAlunos: data.maxAlunos ?? 4, confirmedCount: 0, availableSlots: data.maxAlunos ?? 4,
    }
    db.availabilities.push(novo)
    return novo
  },

  delete: async (id: string) => {
    await delay(300)
    const idx = db.availabilities.findIndex(s => s.id === id)
    if (idx !== -1) db.availabilities.splice(idx, 1)
  },
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookingApi = {
  myBookings: async () => {
    await delay(250)
    const user = getCurrentUser()
    const aluno = db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
    return db.bookings.filter(b => b.alunoId === aluno.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  },

  create: async (availabilityId: string) => {
    await delay(400)
    const user = getCurrentUser()
    const aluno = db.alunos.find(a => a.userId === user?.id) ?? db.alunos[0]
    const slot = db.availabilities.find(s => s.id === availabilityId)
    if (!slot) throw new Error('Slot não encontrado')
    if (slot.confirmedCount >= slot.maxAlunos) throw new Error('Slot lotado')
    const alreadyBooked = db.bookings.some(b => b.availabilityId === availabilityId && b.alunoId === aluno.id && b.status === 'CONFIRMED')
    if (alreadyBooked) throw new Error('Já tens uma reserva neste slot')
    const booking = {
      id: 'bk-' + uid(), availabilityId, alunoId: aluno.id, alunoName: aluno.name,
      personalTrainerId: slot.personalTrainerId, personalTrainerName: slot.personalTrainerName,
      startTime: slot.startTime, endTime: slot.endTime,
      status: 'CONFIRMED' as const, createdAt: new Date().toISOString(),
    }
    db.bookings.push(booking)
    slot.confirmedCount++
    slot.availableSlots--
    syncSlotCounts()
    return booking
  },

  cancel: async (id: string) => {
    await delay(300)
    const booking = db.bookings.find(b => b.id === id)
    if (!booking) throw new Error('Reserva não encontrada')
    booking.status = 'CANCELLED'
    const slot = db.availabilities.find(s => s.id === booking.availabilityId)
    if (slot) { slot.confirmedCount = Math.max(0, slot.confirmedCount - 1); slot.availableSlots++ }
    syncSlotCounts()
    return booking
  },
}

// ── Admin: Alunos por PT ──────────────────────────────────────────────────────
export const adminApi = {
  alunosByPt: async (ptId: string) => {
    await delay(250)
    return db.alunos.filter(a => a.personalTrainerId === ptId)
  },
}

// ── Workout Plans ─────────────────────────────────────────────────────────────
export const workoutApi = {
  // PT: lista alunos com status de treino
  ptAlunos: async (ptId: string) => {
    await delay(250)
    const alunos = db.alunos.filter(a => a.personalTrainerId === ptId)
    return alunos.map(a => ({
      ...a,
      planCount: db.workoutPlans.filter(p => p.alunoId === a.id).length,
    }))
  },

  // PT + Aluno: lista planos de um aluno
  plans: async (alunoId: string) => {
    await delay(250)
    return db.workoutPlans.filter(p => p.alunoId === alunoId)
  },

  // PT: salva (cria ou actualiza) um plano
  savePlan: async (data: {
    alunoId: string; alunoName: string; ptId: string
    label: string; focus: string; exercises: import('@/types').Exercise[]
  }) => {
    await delay(350)
    const existing = db.workoutPlans.find(p => p.alunoId === data.alunoId && p.label === data.label)
    if (existing) {
      Object.assign(existing, { ...data, updatedAt: new Date().toISOString() })
      return existing
    }
    const novo = { ...data, id: 'wp-' + uid(), updatedAt: new Date().toISOString() }
    db.workoutPlans.push(novo)
    return novo
  },

  // PT: adiciona exercício a um plano existente
  addExercise: async (planId: string, exercise: Omit<import('@/types').Exercise, 'id'>) => {
    await delay(300)
    const plan = db.workoutPlans.find(p => p.id === planId)
    if (!plan) throw new Error('Plano não encontrado')
    const novo = { ...exercise, id: 'ex-' + uid() }
    plan.exercises.push(novo)
    plan.updatedAt = new Date().toISOString()
    return novo
  },

  // PT: remove exercício de um plano
  removeExercise: async (planId: string, exerciseId: string) => {
    await delay(200)
    const plan = db.workoutPlans.find(p => p.id === planId)
    if (!plan) throw new Error('Plano não encontrado')
    plan.exercises = plan.exercises.filter(e => e.id !== exerciseId)
    plan.updatedAt = new Date().toISOString()
  },

  // PT: apaga um plano completo
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
      return {
        ptId: pt.id,
        ptName: pt.name,
        planName: plan?.name ?? '—',
        planType: plan?.type ?? '—',
        sessionsCount: pt.hoursThisMonth,
        value,
      }
    })
    return {
      entries,
      total: entries.reduce((s, e) => s + e.value, 0),
      month: currentMonth,
    }
  },
}
