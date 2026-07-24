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
  STUDIO_MAX_SPOTS, isSlotBlocked, studioSchedule, studioBlocks, mockStudioConfig,
} from './mock-db'
import type { MockPlanHourTier } from './mock-db'
import { addDays, startOfWeek } from 'date-fns'
import { generateTempPassword, sendCredentialsEmail } from './notify'

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function slotKeyToISO(date: string, time: string): { start: string; end: string } {
  return {
    start: `${date}T${time}:00Z`,
    end:   `${date}T${addMinutesToTime(time, mockStudioConfig.classDurationMinutes)}:00Z`,
  }
}

// ── Cadeia de slots de uma sessão ─────────────────────────────────────────────
// Espelha BookingService.book do backend: um pack de 60min numa grelha de 30min
// ocupa DOIS slots consecutivos do MESMO PT. Não é erro — só falha se a
// continuação não existir ou não estiver livre, e a mensagem diz porquê.
// As 4 validações por bloco: PT libertou, estúdio não bloqueou, o PT não tem
// outro aluno nesse bloco, e as 4 vagas partilhadas do estúdio.
function resolveSlotChain(opts: {
  ptId: string; alunoId: string; date: string; slotTime: string; sessionDuration: number; retroativo?: boolean
}): string[] {
  const { ptId, alunoId, date, slotTime, sessionDuration, retroativo } = opts
  const slotMinutes = mockStudioConfig.classDurationMinutes
  if (sessionDuration % slotMinutes !== 0) {
    throw new Error(`A sessão é de ${sessionDuration}min e o estúdio trabalha em blocos de ${slotMinutes}min — não encaixa.`)
  }
  const needed = sessionDuration / slotMinutes
  const chain: string[] = []
  let time = slotTime

  for (let i = 0; i < needed; i++) {
    if (!retroativo && new Date(`${date}T${time}:00Z`).getTime() < Date.now()) {
      throw new Error('Não é possível reservar um slot que já passou')
    }
    const released = db.ptReleases.some(r => r.ptId === ptId && r.date === date && r.slotTime === time)
    if (!released) {
      throw i === 0
        ? new Error('O teu PT não tem disponibilidade neste horário')
        : new Error(`Esta sessão é de ${sessionDuration}min e precisa de ${slotTime}–${addMinutesToTime(slotTime, sessionDuration)}. O PT não tem o horário das ${time} disponível.`)
    }
    const where = needed > 1 ? ` (bloco das ${time})` : ''
    if (isSlotBlocked(date, time)) throw new Error(`Este horário está bloqueado pelo estúdio${where}`)
    if (getPTSlotCount(ptId, date, time) >= 1) {
      throw new Error(needed > 1
        ? `Esta sessão é de ${sessionDuration}min e precisa até às ${addMinutesToTime(slotTime, sessionDuration)}, mas o PT já tem outro aluno no bloco das ${time}.`
        : 'O teu PT já tem uma sessão marcada neste horário — escolhe outro horário')
    }
    if (getStudioSlotCount(date, time) >= STUDIO_MAX_SPOTS) {
      throw new Error(needed > 1
        ? `O estúdio fica lotado (${STUDIO_MAX_SPOTS} vagas) no bloco das ${time}, que esta sessão de ${sessionDuration}min precisa de ocupar.`
        : `Slot lotado — ${STUDIO_MAX_SPOTS}/${STUDIO_MAX_SPOTS} vagas do estúdio preenchidas`)
    }
    const key = `${date}-${time}`
    if (db.bookings.some(b => b.slotKey === key && b.alunoId === alunoId && b.status === 'CONFIRMED')) {
      throw new Error('Já tens uma reserva neste horário')
    }
    chain.push(time)
    time = addMinutesToTime(time, slotMinutes)
  }
  return chain
}

// Studio slot config (V14) — cadência (travada 1h) + duração da aula
// (editável pelo admin). Mock: vive em memória; a mudança vale na sessão.
export const studioConfigApi = {
  get: async () => {
    await delay(120)
    return { ...mockStudioConfig }
  },
  update: async (classDurationMinutes: number) => {
    await delay(200)
    if (classDurationMinutes <= 0 || classDurationMinutes > mockStudioConfig.slotDurationMinutes) {
      throw new Error(`A duração da aula tem de estar entre 1 e ${mockStudioConfig.slotDurationMinutes} minutos`)
    }
    mockStudioConfig.classDurationMinutes = classDurationMinutes
    return { ...mockStudioConfig }
  },
  updateSettings: async (patch: { slotDurationMinutes?: number; classDurationMinutes?: number; studioCapacity?: number; maxStudentsPerTrainer?: number; name?: string; privacyPolicyUrl?: string | null; leadCaptureEnabled?: boolean }) => {
    await delay(200)
    // Lotação: resolvidos juntos, porque a regra que os liga é cruzada — um PT
    // não pode atender mais alunos do que a sala inteira comporta.
    if (patch.studioCapacity !== undefined || patch.maxStudentsPerTrainer !== undefined) {
      const capacidade = patch.studioCapacity ?? mockStudioConfig.studioCapacity
      const porPt = patch.maxStudentsPerTrainer ?? mockStudioConfig.maxStudentsPerTrainer
      if (capacidade < 1 || capacidade > 100) throw new Error('A lotação do estúdio deve estar entre 1 e 100 pessoas')
      if (porPt < 1 || porPt > 20) throw new Error('Cada PT deve atender entre 1 e 20 alunos por horário')
      if (porPt > capacidade) throw new Error(`Cada PT atenderia ${porPt} alunos, mas a sala só comporta ${capacidade} ao todo.`)
      mockStudioConfig.studioCapacity = capacidade
      mockStudioConfig.maxStudentsPerTrainer = porPt
    }
    if (patch.slotDurationMinutes !== undefined) {
      if (patch.slotDurationMinutes < 15 || patch.slotDurationMinutes > 180) {
        throw new Error('A cadência do slot deve estar entre 15 e 180 minutos')
      }
      mockStudioConfig.slotDurationMinutes = patch.slotDurationMinutes
      if (mockStudioConfig.classDurationMinutes > patch.slotDurationMinutes) {
        mockStudioConfig.classDurationMinutes = patch.slotDurationMinutes
      }
    }
    if (patch.classDurationMinutes !== undefined) {
      if (patch.classDurationMinutes <= 0 || patch.classDurationMinutes > mockStudioConfig.slotDurationMinutes) {
        throw new Error(`A duração da aula tem de estar entre 1 e ${mockStudioConfig.slotDurationMinutes} minutos`)
      }
      mockStudioConfig.classDurationMinutes = patch.classDurationMinutes
    }
    if (patch.name?.trim()) mockStudioConfig.name = patch.name.trim()
    if (patch.privacyPolicyUrl !== undefined) mockStudioConfig.privacyPolicyUrl = patch.privacyPolicyUrl?.trim() || null
    if (patch.leadCaptureEnabled !== undefined) mockStudioConfig.leadCaptureEnabled = patch.leadCaptureEnabled
    return { ...mockStudioConfig }
  },
}

// ── Auth ─────────────────────────────────────────────────────────────────────
// Códigos de reset em memória (mock) — no backend real vivem em tabela própria.
const mockResetCodes: Record<string, string> = {}

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

  // Esqueci a senha — passo 1: gera um código de 6 dígitos. No mock não há
  // email real, então devolvemos o código (devCode) para o demo funcionar; no
  // backend real o código chega SÓ por email. Resposta genérica de qualquer
  // forma (não revela se o email existe).
  forgotPassword: async (email: string): Promise<{ message: string; devCode?: string }> => {
    await delay(400)
    const generic = 'Se o email existir na plataforma, enviaremos um código para redefinir a senha.'
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (!user) return { message: generic }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    mockResetCodes[user.email.toLowerCase()] = code
    return { message: generic, devCode: code }
  },
  // Passo 2a — confirma o código (não consome).
  verifyResetCode: async (email: string, code: string): Promise<{ valid: boolean }> => {
    await delay(200)
    return { valid: mockResetCodes[email.toLowerCase()] === code }
  },
  // Passo 2b — código + nova senha.
  resetPassword: async (email: string, code: string, newPassword: string): Promise<void> => {
    await delay(300)
    const key = email.toLowerCase()
    if (!mockResetCodes[key] || mockResetCodes[key] !== code) {
      throw new Error('Código inválido ou expirado. Peça um novo.')
    }
    const user = db.users.find(u => u.email.toLowerCase() === key)
    if (user) user.password = newPassword
    delete mockResetCodes[key]
  },

  // Alteração de senha estando autenticado — exige a senha atual.
  changePassword: async (userId: string, currentPassword: string, newPassword: string): Promise<{ success: true }> => {
    await delay(350)
    const user = db.users.find(u => u.id === userId)
    if (!user) throw new Error('Utilizador não encontrado')
    if (user.password !== currentPassword) throw new Error('Senha atual incorreta')
    if (newPassword.length < 6) throw new Error('A nova senha precisa de pelo menos 6 caracteres')
    user.password = newPassword
    return { success: true }
  },

  // Reset forçado pelo admin — para quando o PT/aluno perde o acesso e não
  // tem email de recuperação a funcionar (ou não quer esperar). Gera uma
  // password nova, tenta email real, e devolve sempre a password + um link de
  // WhatsApp pronto para o admin reenviar manualmente se o email falhar.
  adminResetPassword: async (userId: string, name: string, email: string): Promise<{ tempPassword: string; emailSent: boolean }> => {
    await delay(350)
    const user = db.users.find(u => u.id === userId)
    if (!user) throw new Error('Utilizador não encontrado')
    const tempPassword = generateTempPassword()
    user.password = tempPassword
    const { sent } = await sendCredentialsEmail({ to: email, name, password: tempPassword, isReset: true })
    return { tempPassword, emailSent: sent }
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

  // Self-service: o PT edita o próprio perfil (contacto + fiscal). Não toca em
  // plano/estado. Espelha o PATCH /personal-trainers/me do backend.
  updateOwnProfile: async (data: {
    name?: string; email?: string; phone?: string; specialty?: string; specialties?: string[]; bio?: string
    taxId?: string; address?: string
  }) => {
    await delay(300)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    Object.assign(pt, {
      name: data.name ?? pt.name,
      email: data.email ?? pt.email,
      phone: data.phone ?? pt.phone,
      // Espelha o backend: a lista manda, `specialty` fica derivado dela.
      specialties: data.specialties ?? (pt as { specialties?: string[] }).specialties,
      specialty: data.specialties ? data.specialties.join(', ') : (data.specialty ?? pt.specialty),
      bio: data.bio ?? pt.bio,
      taxId: data.taxId ?? (pt as { taxId?: string }).taxId,
      address: data.address ?? (pt as { address?: string }).address,
    })
    const p = getPlanById(pt.planId)
    return { ...pt, plan: p ? { id: p.id, name: p.name, type: p.type } : undefined }
  },

  // Password é GERADA aqui (não vem do form) e devolvida como temporaryPassword,
  // espelhando o backend real. O PT recebe por email; o admin vê só esta 1ª vez.
  create: async (data: {
    name: string; email: string; phone?: string; specialty?: string; bio?: string; planId?: string
    teefNumber?: string; teefValidUntil?: string; insuranceValidUntil?: string
  }) => {
    await delay(500)
    const tempPassword = generateTempPassword()
    const newUser = { id: 'u-' + uid(), email: data.email, password: tempPassword, name: data.name, role: 'PERSONAL_TRAINER' as const }
    const newPT = {
      id: 'pt-' + uid(), userId: newUser.id, name: data.name, email: data.email, phone: data.phone, specialty: data.specialty, bio: data.bio,
      active: true, inadimplente: false, planId: data.planId, alunoCount: 0, hoursThisMonth: 0, billingCycleAnchorDay: new Date().getDate(),
      teefNumber: data.teefNumber || undefined,
      teefValidUntil: data.teefValidUntil || undefined,
      insuranceValidUntil: data.insuranceValidUntil || undefined,
    }
    db.users.push(newUser)
    db.pts.push(newPT)
    await sendCredentialsEmail({ to: data.email, name: data.name, password: tempPassword, isReset: false })
    return { ...newPT, plan: getPlanById(data.planId) ?? null, temporaryPassword: tempPassword }
  },

  update: async (id: string, data: object) => {
    await delay(300)
    const idx = db.pts.findIndex(p => p.id === id)
    if (idx === -1) throw new Error('PT não encontrado')
    db.pts[idx] = { ...db.pts[idx], ...data }
    return db.pts[idx]
  },

  // Reset de senha pelo admin — mesma assinatura/retorno do real
  // (POST /personal-trainers/{id}/reset-password): gera senha nova, grava,
  // tenta email, devolve {tempPassword, emailSent} para a UI mostrar o
  // fallback (copiar/WhatsApp).
  resetPassword: async (id: string): Promise<{ tempPassword: string; emailSent: boolean }> => {
    await delay(350)
    const pt = db.pts.find(p => p.id === id)
    if (!pt) throw new Error('PT não encontrado')
    const user = db.users.find(u => u.id === pt.userId)
    const tempPassword = generateTempPassword()
    if (user) user.password = tempPassword
    const { sent } = await sendCredentialsEmail({ to: pt.email, name: pt.name, password: tempPassword, isReset: true })
    return { tempPassword, emailSent: sent }
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

  // PT can create a new aluno linked to themselves. Password is generated
  // (never a fixed guessable "aluno123") and sent the same way PT creation
  // does — real email if configured, tempPassword/emailSent returned so the
  // UI can fall back to copy/WhatsApp.
  createByPT: async (data: { name: string; email: string; phone?: string; objetivo?: string; dataNascimento?: string }) => {
    await delay(400)
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const tempPassword = generateTempPassword()
    const newUser = { id: 'u-' + uid(), email: data.email, password: tempPassword, name: data.name, role: 'ALUNO' as const }
    const newAluno = {
      id: 'al-' + uid(), userId: newUser.id, name: data.name, email: data.email, phone: data.phone,
      personalTrainerId: pt.id, personalTrainerName: pt.name,
      completedSessions: 0, status: 'ATIVO' as const,
      dataNascimento: data.dataNascimento, inscricaoDate: new Date().toISOString().split('T')[0],
      objetivo: data.objetivo,
    }
    db.users.push(newUser)
    db.alunos.push(newAluno)
    const { sent } = await sendCredentialsEmail({ to: data.email, name: data.name, password: tempPassword, isReset: false })
    return { ...newAluno, tempPassword, emailSent: sent }
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

  // Libertação em bloco — espelha POST /availability/batch. Cada slot é
  // avaliado isoladamente: os inválidos voltam com motivo em vez de rebentar o
  // lote inteiro (era o bug do "Semana toda" a meio da semana).
  createBatch: async (slots: Array<{ date: string; slotTime: string; endTime?: string }>) => {
    await delay(320)
    if (slots.length === 0) return { created: 0, skipped: 0, results: [] as Array<{ startTime: string; created: boolean; reason: string | null }> }
    const user = getCurrentUser()
    const pt = db.pts.find(p => p.userId === user?.id) ?? db.pts[0]
    const now = Date.now()
    const results: Array<{ startTime: string; created: boolean; reason: string | null }> = []
    let created = 0
    for (const s of slots) {
      const startTime = `${s.date}T${s.slotTime}:00Z`
      const reason =
        new Date(startTime).getTime() < now ? 'Já passou'
        : isSlotBlocked(s.date, s.slotTime) ? 'Bloqueado pelo estúdio'
        : db.ptReleases.some(r => r.ptId === pt.id && r.date === s.date && r.slotTime === s.slotTime) ? 'Já estava ativo'
        : null
      if (reason) { results.push({ startTime, created: false, reason }); continue }
      db.ptReleases.push({ id: 'rel-' + uid(), ptId: pt.id, ptName: pt.name, date: s.date, slotTime: s.slotTime })
      results.push({ startTime, created: true, reason: null })
      created++
    }
    return { created, skipped: results.length - created, results }
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
  // ALOCAR = criar o horário E marcar o aluno, numa só operação. Espelha
  // POST /admin/schedule/allocate. Alocar sem aluno deixou de existir.
  allocate: async (data: { ptId: string; studentId: string; date: string; slotTime: string }) => {
    await delay(400)
    const pt = getPTById(data.ptId)
    if (!pt) throw new Error('PT não encontrado')
    const aluno = db.alunos.find(a => a.id === data.studentId)
    if (!aluno) throw new Error('Aluno não encontrado')
    if (aluno.personalTrainerId !== data.ptId) {
      throw new Error(`${aluno.name} está vinculado a outro personal trainer.`)
    }
    // Reutiliza a libertação do PT se já existir — libertar não é ocupar.
    if (!db.ptReleases.some(r => r.ptId === data.ptId && r.date === data.date && r.slotTime === data.slotTime)) {
      db.ptReleases.push({ id: 'rel-' + uid(), ptId: data.ptId, ptName: pt.name, date: data.date, slotTime: data.slotTime })
    }
    return bookingApi.createForStudent(`${data.date}-${data.slotTime}`, data.studentId, true)
  },

  // Returns all studio slots for date range with PT releases per slot
  list: async (startDate: string, endDate: string) => {
    await delay(280)
    const start = new Date(startDate)
    const end = new Date(endDate)
    const result: Array<{
      date: string; slotTime: string; startTime: string; endTime: string
      studioCount: number; studioMax: number
      releases: Array<{ releaseId: string; ptId: string; ptName: string; confirmedCount: number; studentNames: string[] }>
      blocked: boolean; blockReason?: string; blockId?: string
    }> = []

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const date = localDate(d)
      const times = getSlotTimesForDay(d)
      for (const time of times) {
        const { start: s, end: e } = slotKeyToISO(date, time)
        const releases = db.ptReleases
          .filter(r => r.date === date && r.slotTime === time)
          .map(r => ({
            releaseId: r.id, ptId: r.ptId, ptName: r.ptName,
            confirmedCount: getPTSlotCount(r.ptId, date, time),
            // Nome do aluno direto na grelha — o admin não devia ter de abrir
            // chip a chip para saber quem está em cada horário.
            studentNames: db.bookings
              .filter(b => b.slotKey === `${date}-${time}` && b.personalTrainerId === r.ptId && b.status === 'CONFIRMED')
              .map(b => b.alunoName),
          }))
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

  updateWeeklyHours: async (dayOfWeek: number, openTime: string | null, closeTime: string | null, lunchStart: string | null = null, lunchEnd: string | null = null) => {
    await delay(250)
    const day = studioSchedule.find(d => d.dayOfWeek === dayOfWeek)
    if (!day) throw new Error('Dia inválido')
    day.openTime = openTime
    day.closeTime = closeTime
    day.lunchStart = openTime === null ? null : lunchStart
    day.lunchEnd = openTime === null ? null : lunchEnd
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

    // O pack decide QUANTOS blocos a sessão ocupa — resolve-se primeiro.
    const pack = db.packs.find(p => p.alunoId === aluno.id && p.status === 'ACTIVE')
    if (!pack) throw new Error('Não tens sessões disponíveis. Fala com o teu PT para carregar um pack.')
    if (pack.total - pack.used <= 0) throw new Error('Pack sem sessões disponíveis — fala com o teu PT')

    // Valida TODOS os blocos antes de gravar qualquer um.
    const chain = resolveSlotChain({
      ptId: aluno.personalTrainerId, alunoId: aluno.id,
      date, slotTime, sessionDuration: pack.sessionDuration,
    })

    const bookingGroupId = 'grp-' + uid()
    const created = chain.map(time => {
      const { start, end } = slotKeyToISO(date, time)
      const b = {
        id: 'bk-' + uid(),
        bookingGroupId,
        slotKey: `${date}-${time}`, availabilityId: `${date}-${time}`,
        alunoId: aluno.id, alunoName: aluno.name,
        personalTrainerId: aluno.personalTrainerId,
        personalTrainerName: aluno.personalTrainerName,
        startTime: start, endTime: end,
        sessionDuration: pack.sessionDuration,
        status: 'CONFIRMED' as const,
        createdAt: new Date().toISOString(),
      }
      db.bookings.push(b)
      return b
    })

    // UMA sessão debitada, por mais blocos que ocupe.
    pack.used++
    if (pack.total - pack.used === 0) pack.status = 'DEPLETED'

    // Devolve o intervalo real da sessão.
    return { ...created[0], endTime: created[created.length - 1].endTime }
  },

  // Admin/PT marcam POR um aluno específico (desconta do pack do aluno).
  // `retroativo` = regularização pelo admin de uma aula que já passou.
  createForStudent: async (availabilityId: string, studentId: string, retroativo = false) => {
    await delay(400)
    const aluno = db.alunos.find(a => a.id === studentId)
    if (!aluno) throw new Error('Aluno não encontrado')
    const date = availabilityId.slice(0, 10)
    const slotTime = availabilityId.slice(11)
    const pack = db.packs.find(p => p.alunoId === aluno.id && p.status === 'ACTIVE')
    if (!pack || pack.total - pack.used <= 0) throw new Error('O aluno não tem pack ativo com sessões disponíveis')

    // Mesma cadeia do auto-agendamento: 60min em blocos de 30 ocupa dois.
    const chain = resolveSlotChain({
      ptId: aluno.personalTrainerId, alunoId: aluno.id,
      date, slotTime, sessionDuration: pack.sessionDuration, retroativo,
    })

    const jaPassou = new Date(`${date}T${slotTime}:00Z`).getTime() < Date.now()
    const bookingGroupId = 'grp-' + uid()
    const created = chain.map(time => {
      const { start, end } = slotKeyToISO(date, time)
      const b = {
        id: 'bk-' + uid(),
        bookingGroupId,
        slotKey: `${date}-${time}`, availabilityId: `${date}-${time}`,
        alunoId: aluno.id, alunoName: aluno.name,
        personalTrainerId: aluno.personalTrainerId,
        personalTrainerName: aluno.personalTrainerName,
        startTime: start, endTime: end,
        sessionDuration: pack.sessionDuration,
        // Aula já dada entra como concluída, não "por dar".
        status: (jaPassou ? 'COMPLETED' : 'CONFIRMED') as 'COMPLETED' | 'CONFIRMED',
        createdAt: new Date().toISOString(),
      }
      db.bookings.push(b)
      return b
    })
    pack.used++
    if (pack.total - pack.used === 0) pack.status = 'DEPLETED'
    return { ...created[0], endTime: created[created.length - 1].endTime }
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

    // Cancela a sessão INTEIRA — numa sessão de 60min em blocos de 30,
    // cancelar o primeiro bloco deixaria o segundo reservado.
    const grupo = booking.bookingGroupId
      ? db.bookings.filter(b => b.bookingGroupId === booking.bookingGroupId && b.status === 'CONFIRMED')
      : [booking]
    grupo.forEach(b => { b.status = 'CANCELLED' })

    // Devolve UMA sessão — foi uma que se debitou.
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
    return {
      // completedSessions derivado das reservas, como o backend faz
      // (countByStudentIdAndStatus COMPLETED). O valor semeado era estático e
      // não crescia ao regularizar uma aula antiga — a sessão descontava do
      // pack mas aparecia em "Agendadas" em vez de "Concluídas".
      aluno: { ...aluno, completedSessions: bookings.filter(b => b.status === 'COMPLETED').length },
      bookings, packs, avaliacoes, workoutPlan,
    }
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
    nif: string; morada: string
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
  create: async (data: { alunoId: string; total: number; sessionDuration: number; expiresAt?: string }) => {
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
// ── Formulário de captura configurável ────────────────────────────────────────
export type LeadFieldType = 'TEXT' | 'TEXTAREA' | 'RADIO' | 'CHECKBOX' | 'SELECT'
export interface LeadFormField {
  id: string; label: string; type: LeadFieldType
  required: boolean; options: string[]; placeholder?: string | null
}
export interface LeadFormConfig {
  logoUrl: string | null; headline: string | null; subheadline: string | null
  fields: LeadFormField[]; maxFields: number
}

const MAX_CUSTOM_FIELDS = 6
const mockLeadForm: LeadFormConfig = {
  logoUrl: null,
  headline: 'Agenda a tua visita.',
  subheadline: 'Conhece o espaço e fala com um personal trainer, sem compromisso. Deixa o teu contacto que ligamos-te.',
  fields: [],
  maxFields: MAX_CUSTOM_FIELDS,
}

// Mesmas regras do LeadFormService — o mock não pode ser mais permissivo que a
// produção, senão a demo valida coisas que o backend recusa.
function validateLeadFields(fields: LeadFormField[]): LeadFormField[] {
  if (fields.length > MAX_CUSTOM_FIELDS) {
    throw new Error(`O formulário aceita no máximo ${MAX_CUSTOM_FIELDS} campos próprios (enviaste ${fields.length}).`)
  }
  const vistos = new Set<string>()
  return fields.map((f, i) => {
    const label = (f.label ?? '').trim()
    if (!label) throw new Error(`O campo ${i + 1} está sem pergunta.`)
    if (vistos.has(label.toLowerCase())) throw new Error(`Há dois campos com a mesma pergunta: "${label}".`)
    vistos.add(label.toLowerCase())
    const precisaOpcoes = f.type === 'RADIO' || f.type === 'CHECKBOX' || f.type === 'SELECT'
    let options: string[] = []
    if (precisaOpcoes) {
      options = [...new Set((f.options ?? []).map(o => o.trim()).filter(Boolean))]
      if (options.length < 2) throw new Error(`O campo "${label}" é de escolha e precisa de pelo menos 2 opções.`)
      if (options.length > 12) throw new Error(`O campo "${label}" tem opções a mais (máx. 12).`)
    }
    return { id: f.id?.trim() || 'fld-' + uid(), label, type: f.type, required: !!f.required, options, placeholder: f.placeholder?.trim() || null }
  })
}

export const leadFormApi = {
  get: async () => { await delay(150); return { ...mockLeadForm, fields: [...mockLeadForm.fields] } },
  update: async (patch: { headline?: string | null; subheadline?: string | null; fields?: LeadFormField[] }) => {
    await delay(250)
    if (patch.headline !== undefined) mockLeadForm.headline = patch.headline?.trim() || null
    if (patch.subheadline !== undefined) mockLeadForm.subheadline = patch.subheadline?.trim() || null
    if (patch.fields !== undefined) mockLeadForm.fields = validateLeadFields(patch.fields)
    return { ...mockLeadForm, fields: [...mockLeadForm.fields] }
  },
  uploadLogo: async (file: File) => {
    await delay(400)
    if (file.size > 1_000_000) throw new Error(`O logo tem ${Math.round(file.size / 1024)}KB — o máximo é 976KB.`)
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      throw new Error('Formato não suportado. Usa PNG, JPG, WEBP ou SVG.')
    }
    // No mock não há S3: um object URL local serve para ver o resultado.
    mockLeadForm.logoUrl = URL.createObjectURL(file)
    return { ...mockLeadForm, fields: [...mockLeadForm.fields] }
  },
  removeLogo: async () => {
    await delay(200)
    mockLeadForm.logoUrl = null
    return { ...mockLeadForm, fields: [...mockLeadForm.fields] }
  },
}

export const leadApi = {
  list: async () => { await delay(280); return db.leads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) },
  byStatus: async (status: import('@/lib/mock-db').MockLead['status']) => { await delay(200); return db.leads.filter(l => l.status === status) },
  create: async (data: Omit<import('@/lib/mock-db').MockLead, 'id' | 'createdAt' | 'updatedAt'> & { answers?: Record<string, string[]> }) => {
    await delay(350)
    // Converte as respostas dos campos configurados no formato guardado
    // (rótulo = id no mock, que não tem a config à mão; em produção o backend
    // grava o rótulo real). answers não faz parte do MockLead — retira-se.
    const { answers, ...rest } = data
    const customAnswers = Object.entries(answers ?? {})
      .filter(([, v]) => v.length > 0)
      .map(([fieldId, v]) => ({ fieldId, label: fieldId, value: v.join(', ') }))
    const novo = { ...rest, customAnswers, id: 'lead-' + uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
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

// ── Sino do estúdio (inbox in-app) ────────────────────────────────────────────
interface MockInboxNotification {
  id: string; type: string; title: string; body: string | null; link: string | null; createdAt: string; read: boolean
}
const mockInbox: MockInboxNotification[] = [
  { id: 'ntf-1', type: 'NEW_LEAD', title: 'Novo lead: Luísa Ferreira', body: 'Chegou pelo site. Contacta antes que esfrie.', link: '/admin/leads', createdAt: new Date(Date.now() - 6 * 3600e3).toISOString(), read: false },
  { id: 'ntf-2', type: 'PT_SLOT_RELEASED', title: 'João Silva marcou um horário', body: 'Agenda 15/07 às 08:00.', link: '/admin/schedule', createdAt: new Date(Date.now() - 9 * 3600e3).toISOString(), read: false },
  { id: 'ntf-3', type: 'NEW_LEAD', title: 'Novo lead: André Pereira', body: 'Chegou pelo site. Contacta antes que esfrie.', link: '/admin/leads', createdAt: new Date(Date.now() - 26 * 3600e3).toISOString(), read: true },
]
export const notificationInboxApi = {
  inbox: async () => {
    await delay(200)
    const items = [...mockInbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { items, unreadCount: items.filter(n => !n.read).length }
  },
  unreadCount: async () => {
    await delay(120)
    return mockInbox.filter(n => !n.read).length
  },
  markAllRead: async () => {
    await delay(180)
    let updated = 0
    mockInbox.forEach(n => { if (!n.read) { n.read = true; updated++ } })
    return { updated }
  },
}

// ── Documentos do PT (mock) ───────────────────────────────────────────────────
interface MockPtDoc {
  id: string; type: 'SEGURO' | 'TEEF' | 'OUTRO'; fileName: string
  contentType: string; sizeBytes: number; validUntil: string | null; uploadedAt: string
}
const mockPtDocs: Record<string, MockPtDoc[]> = {}
function seedPtDocs(ptId: string): MockPtDoc[] {
  if (!mockPtDocs[ptId]) {
    const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 864e5).toISOString()
    mockPtDocs[ptId] = [
      { id: 'doc-' + uid(), type: 'SEGURO', fileName: 'seguro_2026.pdf', contentType: 'application/pdf', sizeBytes: 240_000, validUntil: iso(40).slice(0, 10), uploadedAt: iso(-5) },
      { id: 'doc-' + uid(), type: 'TEEF', fileName: 'cedula_teef.pdf', contentType: 'application/pdf', sizeBytes: 180_000, validUntil: iso(18).slice(0, 10), uploadedAt: iso(-30) },
    ]
  }
  return mockPtDocs[ptId]
}
export const ptDocumentApi = {
  list: async (ptId: string) => {
    await delay(200)
    return [...seedPtDocs(ptId)].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  },
  upload: async (ptId: string, data: { type: string; file: File; validUntil?: string | null }) => {
    await delay(400)
    const doc: MockPtDoc = {
      id: 'doc-' + uid(), type: data.type as MockPtDoc['type'], fileName: data.file.name,
      contentType: data.file.type || 'application/octet-stream', sizeBytes: data.file.size,
      validUntil: data.validUntil ?? null, uploadedAt: new Date().toISOString(),
    }
    seedPtDocs(ptId).unshift(doc)
    return doc
  },
  download: async (_ptId: string, docId: string) => {
    await delay(200)
    return new Blob([`Documento de demonstração (${docId}).`], { type: 'text/plain' })
  },
  remove: async (ptId: string, docId: string) => {
    await delay(200)
    const arr = seedPtDocs(ptId)
    const i = arr.findIndex(d => d.id === docId)
    if (i >= 0) arr.splice(i, 1)
  },
}

// ── Cobrança semanal do PT + inadimplência (mock) ─────────────────────────────
// Mock leve — produção usa o backend real. Só o suficiente para os tipos
// baterem e a página não crashar em modo mock.
const mockPtPayments: Record<string, { periodStart: string; amountPaid: number; notes?: string }> = {}
function mockWeekStart(d: Date) {
  const day = (d.getDay() + 6) % 7 // 0 = segunda
  const m = new Date(d); m.setDate(d.getDate() - day); return m.toISOString().slice(0, 10)
}
const ptPaymentDelinquencyExtra = {
  week: async (date?: string) => {
    await delay(200)
    const base = date ? new Date(date) : new Date()
    const periodStart = mockWeekStart(base)
    const end = new Date(periodStart); end.setDate(end.getDate() + 6)
    const due = new Date(periodStart); due.setDate(due.getDate() + 7)
    const entries = db.pts.filter(p => p.active).map(pt => {
      const amountDue = 0
      const paid = mockPtPayments[`${pt.id}-${periodStart}`]?.amountPaid ?? 0
      return {
        ptId: pt.id, ptName: pt.name, planName: null,
        periodStart, periodEnd: end.toISOString().slice(0, 10), dueDate: due.toISOString().slice(0, 10),
        hours: 0, amountDue, amountPaid: paid, balance: Math.max(0, amountDue - paid),
        status: 'PAGO' as const, recorded: paid > 0,
      }
    })
    return {
      periodStart, periodEnd: end.toISOString().slice(0, 10), dueDate: due.toISOString().slice(0, 10),
      entries, totalDue: 0, totalPaid: entries.reduce((s, e) => s + e.amountPaid, 0), totalBalance: 0,
    }
  },
  delinquency: async () => { await delay(200); return { asOf: new Date().toISOString().slice(0, 10), trainers: [] as import('./real-api').DelinquentPt[], totalOwed: 0 } },
  history: async (_ptId: string) => { await delay(200); return [] as import('./real-api').PtWeeklyCharge[] },
  record: async (data: { ptId: string; periodStart: string; amount: number; notes?: string }) => {
    await delay(300)
    const k = `${data.ptId}-${data.periodStart}`
    mockPtPayments[k] = { periodStart: data.periodStart, amountPaid: (mockPtPayments[k]?.amountPaid ?? 0) + data.amount, notes: data.notes }
    const pt = db.pts.find(p => p.id === data.ptId)
    const end = new Date(data.periodStart); end.setDate(end.getDate() + 6)
    const due = new Date(data.periodStart); due.setDate(due.getDate() + 7)
    return {
      ptId: data.ptId, ptName: pt?.name ?? 'PT', planName: null,
      periodStart: data.periodStart, periodEnd: end.toISOString().slice(0, 10), dueDate: due.toISOString().slice(0, 10),
      hours: 0, amountDue: 0, amountPaid: mockPtPayments[k].amountPaid, balance: 0,
      status: 'PAGO' as const, recorded: true,
    }
  },
}

// ── Documentos do aluno (mock) ────────────────────────────────────────────────
// Por agora só o contrato de anamnese.
interface MockStudentDoc {
  id: string; type: 'CONTRATO_ANAMNESE'; fileName: string
  contentType: string; sizeBytes: number; validUntil: string | null; uploadedAt: string
}
const mockStudentDocs: Record<string, MockStudentDoc[]> = {}
function seedStudentDocs(studentId: string): MockStudentDoc[] {
  if (!mockStudentDocs[studentId]) mockStudentDocs[studentId] = []
  return mockStudentDocs[studentId]
}
export const studentDocumentApi = {
  list: async (studentId: string) => {
    await delay(200)
    return [...seedStudentDocs(studentId)].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  },
  upload: async (studentId: string, data: { type: string; file: File; validUntil?: string | null }) => {
    await delay(400)
    const doc: MockStudentDoc = {
      id: 'sdoc-' + uid(), type: data.type as MockStudentDoc['type'], fileName: data.file.name,
      contentType: data.file.type || 'application/octet-stream', sizeBytes: data.file.size,
      validUntil: data.validUntil ?? null, uploadedAt: new Date().toISOString(),
    }
    seedStudentDocs(studentId).unshift(doc)
    return doc
  },
  download: async (_studentId: string, docId: string) => {
    await delay(200)
    return new Blob([`Documento de demonstração (${docId}).`], { type: 'text/plain' })
  },
  remove: async (studentId: string, docId: string) => {
    await delay(200)
    const arr = seedStudentDocs(studentId)
    const i = arr.findIndex(d => d.id === docId)
    if (i >= 0) arr.splice(i, 1)
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
  // Drill-down: as sessões que compõem a faturação do PT no mês.
  sessions: async (ptId: string, month?: string) => {
    await delay(250)
    const currentMonth = month ?? new Date().toISOString().slice(0, 7)
    const pt = db.pts.find(p => p.id === ptId)
    const rows = db.bookings
      .filter(b =>
        b.personalTrainerId === ptId &&
        (b.status === 'CONFIRMED' || b.status === 'COMPLETED') &&
        b.startTime.slice(0, 7) === currentMonth,
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(b => {
        const durationHours = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 3_600_000
        return {
          bookingId: b.id, date: b.startTime.slice(0, 10),
          startTime: b.startTime, endTime: b.endTime, durationHours,
          studentName: b.alunoName ?? '—',
          status: b.status as 'CONFIRMED' | 'COMPLETED',
        }
      })
    return {
      ptId, ptName: pt?.name ?? '—', month: currentMonth,
      sessions: rows, totalSessions: rows.length,
      totalHours: rows.reduce((s, r) => s + r.durationHours, 0),
    }
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
  ...ptPaymentDelinquencyExtra, // week / delinquency / history / record (inadimplência)
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
