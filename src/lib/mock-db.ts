import { addDays, addWeeks, startOfWeek } from 'date-fns'

// ── Stable IDs ──────────────────────────────────────────────────────────────
const P = { monthly: 'plan-01', hourly: 'plan-02', weekly: 'plan-03' }
const U = {
  admin: 'u-admin', joao: 'u-joao', ana: 'u-ana', pedro: 'u-pedro',
  carlos: 'u-carlos', maria: 'u-maria', sofia: 'u-sofia', rui: 'u-rui',
  helena: 'u-helena', tiago: 'u-tiago', paula: 'u-paula', miguel: 'u-miguel',
}
const PT = { joao: 'pt-joao', ana: 'pt-ana', pedro: 'pt-pedro' }
const AL = {
  carlos: 'al-carlos', maria: 'al-maria', sofia: 'al-sofia', rui: 'al-rui',
  helena: 'al-helena', tiago: 'al-tiago', paula: 'al-paula', miguel: 'al-miguel',
}

// ── Interfaces ──────────────────────────────────────────────────────────────
export interface MockUser {
  id: string; email: string; password: string; name: string
  role: 'ADMIN' | 'PERSONAL_TRAINER' | 'ALUNO'
}
export interface MockPlan {
  id: string; name: string; type: 'MONTHLY' | 'WEEKLY' | 'HOURLY'
  priceMonthly?: number; priceWeekly?: number; priceHourly?: number
  description?: string
}
export interface MockPT {
  id: string; userId: string; name: string; email: string; phone?: string
  specialty?: string; bio?: string; active: boolean; inadimplente: boolean
  planId?: string; alunoCount: number; hoursThisMonth: number
}
export interface MockAluno {
  id: string; userId: string; name: string; email: string
  personalTrainerId: string; personalTrainerName: string
  nextSession?: string; completedSessions?: number
}
export interface MockAvailability {
  id: string; personalTrainerId: string; personalTrainerName: string
  startTime: string; endTime: string; maxAlunos: number
  confirmedCount: number; availableSlots: number
}
export interface MockBooking {
  id: string; availabilityId: string; alunoId: string; alunoName: string
  personalTrainerId: string; personalTrainerName: string
  startTime: string; endTime: string
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'; createdAt: string
}
export interface MockModalidade {
  id: string; name: string; categoria?: string; descricao?: string
  cor: string; active: boolean; createdAt: string
}
export interface MockExercise {
  id: string; name: string; muscleGroup: string
  sets: number; reps: string; rest: string; notes?: string
}
export interface MockWorkoutPlan {
  id: string; alunoId: string; alunoName: string; ptId: string
  label: string; focus: string
  exercises: MockExercise[]; updatedAt: string
}

// ── Date helpers ─────────────────────────────────────────────────────────────
// Use LOCAL date string to match date-fns format() output (yyyy-MM-dd)
function localDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Store as "YYYY-MM-DDThh:00:00Z" — hour is "UTC hour label" matching admin schedule page
function makeSlotISO(d: Date, hour: number, endHour?: number): { start: string; end: string } {
  const date = localDate(d)
  const h = endHour ?? hour + 1
  return {
    start: `${date}T${String(hour).padStart(2, '0')}:00:00Z`,
    end:   `${date}T${String(h).padStart(2, '0')}:00:00Z`,
  }
}

// ── Slot generation ─────────────────────────────────────────────────────────
function genSlots(ptId: string, ptName: string): MockAvailability[] {
  const slots: MockAvailability[] = []
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  for (let w = 0; w < 3; w++) {
    const wk = addWeeks(monday, w)
    for (let d = 0; d < 6; d++) {
      const day = addDays(wk, d)
      const hours = d === 5 ? [9, 10, 11] : [7, 8, 9, 10, 11, 17, 18, 19]
      for (const h of hours) {
        const date = localDate(day)
        const id = `av-${ptId}-${date}-${h}`
        const { start, end } = makeSlotISO(day, h)
        slots.push({
          id, personalTrainerId: ptId, personalTrainerName: ptName,
          startTime: start, endTime: end,
          maxAlunos: 1, confirmedCount: 0, availableSlots: 1,
        })
      }
    }
  }
  return slots
}

// ── DB factory ──────────────────────────────────────────────────────────────
function createDB() {
  const plans: MockPlan[] = [
    { id: P.monthly, name: 'Plano Mensal',   type: 'MONTHLY', priceMonthly: 200, description: 'Acesso ilimitado ao espaço durante o mês' },
    { id: P.hourly,  name: 'Plano Por Hora', type: 'HOURLY',  priceHourly: 8,   description: 'Pague apenas as horas que usar — sem compromisso' },
    { id: P.weekly,  name: 'Plano Semanal',  type: 'WEEKLY',  priceWeekly: 55,  description: 'Pacote semanal com 10% de desconto' },
  ]

  const users: MockUser[] = [
    { id: U.admin,  email: 'admin@fittrainly.com',  password: 'demo123', name: 'Maicon Godoi',    role: 'ADMIN' },
    { id: U.joao,   email: 'joao@fittrainly.com',   password: 'demo123', name: 'João Silva',      role: 'PERSONAL_TRAINER' },
    { id: U.ana,    email: 'ana@fittrainly.com',     password: 'demo123', name: 'Ana Costa',       role: 'PERSONAL_TRAINER' },
    { id: U.pedro,  email: 'pedro@fittrainly.com',  password: 'demo123', name: 'Pedro Santos',    role: 'PERSONAL_TRAINER' },
    { id: U.carlos, email: 'carlos@fittrainly.com', password: 'demo123', name: 'Carlos Mendes',   role: 'ALUNO' },
    { id: U.maria,  email: 'maria@fittrainly.com',  password: 'demo123', name: 'Maria Fernandes', role: 'ALUNO' },
    { id: U.sofia,  email: 'sofia@fittrainly.com',  password: 'demo123', name: 'Sofia Rodrigues', role: 'ALUNO' },
    { id: U.rui,    email: 'rui@fittrainly.com',    password: 'demo123', name: 'Rui Oliveira',    role: 'ALUNO' },
    { id: U.helena, email: 'helena@fittrainly.com', password: 'demo123', name: 'Helena Martins',  role: 'ALUNO' },
    { id: U.tiago,  email: 'tiago@fittrainly.com',  password: 'demo123', name: 'Tiago Ferreira',  role: 'ALUNO' },
    { id: U.paula,  email: 'paula@fittrainly.com',  password: 'demo123', name: 'Paula Lima',      role: 'ALUNO' },
    { id: U.miguel, email: 'miguel@fittrainly.com', password: 'demo123', name: 'Miguel Sousa',    role: 'ALUNO' },
  ]

  const pts: MockPT[] = [
    {
      id: PT.joao, userId: U.joao, name: 'João Silva', email: 'joao@fittrainly.com',
      phone: '+351 912 345 678', specialty: 'Musculação e Força',
      bio: 'Especialista em hipertrofia com 8 anos de experiência. Certificado pela NSCA.',
      active: true, inadimplente: false, planId: P.monthly, alunoCount: 4, hoursThisMonth: 22,
    },
    {
      id: PT.ana, userId: U.ana, name: 'Ana Costa', email: 'ana@fittrainly.com',
      phone: '+351 913 456 789', specialty: 'Funcional e Mobilidade',
      bio: 'Certificada pela NSCA, foco em longevidade e qualidade de movimento.',
      active: true, inadimplente: false, planId: P.hourly, alunoCount: 2, hoursThisMonth: 14,
    },
    {
      id: PT.pedro, userId: U.pedro, name: 'Pedro Santos', email: 'pedro@fittrainly.com',
      phone: '+351 914 567 890', specialty: 'Emagrecimento e Saúde',
      bio: 'Nutricionista e personal trainer, abordagem holística do emagrecimento.',
      active: true, inadimplente: true, planId: P.weekly, alunoCount: 2, hoursThisMonth: 8,
    },
  ]

  const alunos: MockAluno[] = [
    { id: AL.carlos, userId: U.carlos, name: 'Carlos Mendes',   email: 'carlos@fittrainly.com', personalTrainerId: PT.joao,  personalTrainerName: 'João Silva',    completedSessions: 12 },
    { id: AL.maria,  userId: U.maria,  name: 'Maria Fernandes', email: 'maria@fittrainly.com',  personalTrainerId: PT.joao,  personalTrainerName: 'João Silva',    completedSessions: 8 },
    { id: AL.sofia,  userId: U.sofia,  name: 'Sofia Rodrigues', email: 'sofia@fittrainly.com',  personalTrainerId: PT.joao,  personalTrainerName: 'João Silva',    completedSessions: 5 },
    { id: AL.rui,    userId: U.rui,    name: 'Rui Oliveira',    email: 'rui@fittrainly.com',    personalTrainerId: PT.joao,  personalTrainerName: 'João Silva',    completedSessions: 3 },
    { id: AL.helena, userId: U.helena, name: 'Helena Martins',  email: 'helena@fittrainly.com', personalTrainerId: PT.ana,   personalTrainerName: 'Ana Costa',     completedSessions: 7 },
    { id: AL.tiago,  userId: U.tiago,  name: 'Tiago Ferreira',  email: 'tiago@fittrainly.com',  personalTrainerId: PT.ana,   personalTrainerName: 'Ana Costa',     completedSessions: 4 },
    { id: AL.paula,  userId: U.paula,  name: 'Paula Lima',      email: 'paula@fittrainly.com',  personalTrainerId: PT.pedro, personalTrainerName: 'Pedro Santos',  completedSessions: 2 },
    { id: AL.miguel, userId: U.miguel, name: 'Miguel Sousa',    email: 'miguel@fittrainly.com', personalTrainerId: PT.pedro, personalTrainerName: 'Pedro Santos',  completedSessions: 1 },
  ]

  // Generate slots for this week + 2 more weeks
  const availabilities: MockAvailability[] = [
    ...genSlots(PT.joao,  'João Silva'),
    ...genSlots(PT.ana,   'Ana Costa'),
    ...genSlots(PT.pedro, 'Pedro Santos'),
  ]

  const bookings: MockBooking[] = []
  const now = new Date()

  // ── Next-week CONFIRMED bookings ───────────────────────────────────────────
  // Always use next week so they're always in the future
  const nextMonday = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1)

  const batch = [
    { id: AL.carlos, name: 'Carlos Mendes' },
    { id: AL.maria,  name: 'Maria Fernandes' },
    { id: AL.sofia,  name: 'Sofia Rodrigues' },
  ]

  for (let d = 0; d < 4; d++) {
    const day = addDays(nextMonday, d)
    const date = localDate(day)

    // 9h slot — 3 alunos
    const slot9Id = `av-${PT.joao}-${date}-9`
    const { start: s9, end: e9 } = makeSlotISO(day, 9)
    batch.forEach(a => {
      bookings.push({
        id: `bk-${a.id}-${date}-9`,
        availabilityId: slot9Id, alunoId: a.id, alunoName: a.name,
        personalTrainerId: PT.joao, personalTrainerName: 'João Silva',
        startTime: s9, endTime: e9,
        status: 'CONFIRMED', createdAt: now.toISOString(),
      })
    })

    // 18h slot — Rui (first 2 days only)
    if (d < 2) {
      const slot18Id = `av-${PT.joao}-${date}-18`
      const { start: s18, end: e18 } = makeSlotISO(day, 18)
      bookings.push({
        id: `bk-${AL.rui}-${date}-18`,
        availabilityId: slot18Id, alunoId: AL.rui, alunoName: 'Rui Oliveira',
        personalTrainerId: PT.joao, personalTrainerName: 'João Silva',
        startTime: s18, endTime: e18,
        status: 'CONFIRMED', createdAt: now.toISOString(),
      })
    }
  }

  // Ana — Helena + Tiago next Tue + Thu
  for (const dOff of [1, 3]) {
    const day = addDays(nextMonday, dOff)
    const date = localDate(day)
    const slotId = `av-${PT.ana}-${date}-10`
    const { start, end } = makeSlotISO(day, 10)
    ;[{ id: AL.helena, name: 'Helena Martins' }, { id: AL.tiago, name: 'Tiago Ferreira' }].forEach(a => {
      bookings.push({
        id: `bk-${a.id}-${date}-10`,
        availabilityId: slotId, alunoId: a.id, alunoName: a.name,
        personalTrainerId: PT.ana, personalTrainerName: 'Ana Costa',
        startTime: start, endTime: end,
        status: 'CONFIRMED', createdAt: now.toISOString(),
      })
    })
  }

  // ── Past COMPLETED bookings (last week) ────────────────────────────────────
  const lastMonday = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), -1)
  for (let d = 0; d < 5; d++) {
    const day = addDays(lastMonday, d)
    const date = localDate(day)
    const { start, end } = makeSlotISO(day, 9)
    bookings.push({
      id: `bk-past-carlos-${date}-9`,
      availabilityId: `av-${PT.joao}-${date}-9`,
      alunoId: AL.carlos, alunoName: 'Carlos Mendes',
      personalTrainerId: PT.joao, personalTrainerName: 'João Silva',
      startTime: start, endTime: end,
      status: 'COMPLETED', createdAt: day.toISOString(),
    })
  }

  // One cancelled booking for history
  const cancelDay = addDays(lastMonday, 2)
  const cancelDate = localDate(cancelDay)
  const { start: sc, end: ec } = makeSlotISO(cancelDay, 17)
  bookings.push({
    id: `bk-cancel-carlos-${cancelDate}-17`,
    availabilityId: `av-${PT.joao}-${cancelDate}-17`,
    alunoId: AL.carlos, alunoName: 'Carlos Mendes',
    personalTrainerId: PT.joao, personalTrainerName: 'João Silva',
    startTime: sc, endTime: ec,
    status: 'CANCELLED', createdAt: cancelDay.toISOString(),
  })

  // ── Sync slot counts ────────────────────────────────────────────────────────
  for (const slot of availabilities) {
    const count = bookings.filter(b => b.availabilityId === slot.id && b.status === 'CONFIRMED').length
    slot.confirmedCount = count
    slot.availableSlots = slot.maxAlunos - count
  }

  // ── nextSession for alunos ──────────────────────────────────────────────────
  for (const aluno of alunos) {
    const next = bookings
      .filter(b => b.alunoId === aluno.id && b.status === 'CONFIRMED' && new Date(b.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
    if (next) aluno.nextSession = next.startTime
  }

  const modalidades: MockModalidade[] = [
    { id: 'mod-01', name: 'Musculação',   categoria: 'Fitness',        descricao: 'Treino de força com pesos livres e máquinas',  cor: '#2563EB', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-02', name: 'CrossFit',     categoria: 'Fitness',        descricao: 'Treino funcional de alta intensidade',          cor: '#EA580C', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-03', name: 'Funcional',    categoria: 'Fitness',        descricao: 'Treino com peso corporal e acessórios',          cor: '#111111', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-04', name: 'Muay Thai',    categoria: 'Artes Marciais', descricao: 'Arte marcial tailandesa — kickboxing',            cor: '#DC2626', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-05', name: 'Jiu-Jitsu',   categoria: 'Artes Marciais', descricao: 'Luta no chão, alavancas e estrangulamentos',     cor: '#7C3AED', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-06', name: 'Yoga',         categoria: 'Bem-estar',      descricao: 'Equilíbrio corpo-mente com posturas',             cor: '#0891B2', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-07', name: 'Pilates',      categoria: 'Bem-estar',      descricao: 'Fortalecimento do core e flexibilidade',          cor: '#16A34A', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-08', name: 'Dança Urbana', categoria: 'Dança',          descricao: 'Hip hop, street dance e estilos urbanos',         cor: '#DB2777', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-09', name: 'Spinning',     categoria: 'Cardio',         descricao: 'Ciclismo indoor de alta intensidade',              cor: '#475569', active: true,  createdAt: '2026-01-10T00:00:00Z' },
    { id: 'mod-10', name: 'Zumba',        categoria: 'Dança',          descricao: 'Aeróbico ao ritmo de música latina',              cor: '#B45309', active: false, createdAt: '2026-01-10T00:00:00Z' },
  ]

  const workoutPlans: MockWorkoutPlan[] = [
    // ── Carlos — Treino A (Superior) ──────────────────────────────────────────
    {
      id: 'wp-carlos-a', alunoId: AL.carlos, alunoName: 'Carlos Mendes', ptId: PT.joao,
      label: 'Treino A', focus: 'Superior — Peito, Ombros, Braços',
      updatedAt: '2026-06-15T10:00:00Z',
      exercises: [
        { id: 'ex-ca-1', name: 'Supino Reto com Barra',     muscleGroup: 'Peito',           sets: 4, reps: '8-10', rest: '90s' },
        { id: 'ex-ca-2', name: 'Voador Pec Deck',            muscleGroup: 'Peito',           sets: 3, reps: '12-15', rest: '60s' },
        { id: 'ex-ca-3', name: 'Desenvolvimento com Halteres', muscleGroup: 'Ombros',        sets: 3, reps: '10-12', rest: '90s' },
        { id: 'ex-ca-4', name: 'Elevação Lateral',           muscleGroup: 'Ombros',          sets: 4, reps: '15',    rest: '45s' },
        { id: 'ex-ca-5', name: 'Tríceps Polia Alta',         muscleGroup: 'Tríceps',         sets: 4, reps: '12',    rest: '60s' },
        { id: 'ex-ca-6', name: 'Rosca Scott com Barra',      muscleGroup: 'Bíceps',          sets: 3, reps: '12',    rest: '60s', notes: 'Controlar a descida — 3 segundos' },
      ],
    },
    // ── Carlos — Treino B (Inferior) ──────────────────────────────────────────
    {
      id: 'wp-carlos-b', alunoId: AL.carlos, alunoName: 'Carlos Mendes', ptId: PT.joao,
      label: 'Treino B', focus: 'Inferior — Quadríceps, Glúteos, Isquiotibiais',
      updatedAt: '2026-06-15T10:00:00Z',
      exercises: [
        { id: 'ex-cb-1', name: 'Agachamento Livre',          muscleGroup: 'Quadríceps',      sets: 4, reps: '6-8',   rest: '2min', notes: 'Descer até 90° — manter joelhos alinhados' },
        { id: 'ex-cb-2', name: 'Leg Press 45°',              muscleGroup: 'Quadríceps',      sets: 3, reps: '12',    rest: '90s' },
        { id: 'ex-cb-3', name: 'Cadeira Extensora',          muscleGroup: 'Quadríceps',      sets: 3, reps: '15',    rest: '60s' },
        { id: 'ex-cb-4', name: 'Mesa Flexora',               muscleGroup: 'Isquiotibiais',   sets: 3, reps: '12-15', rest: '60s' },
        { id: 'ex-cb-5', name: 'Stiff com Halteres',         muscleGroup: 'Isquiotibiais',   sets: 3, reps: '10-12', rest: '90s' },
        { id: 'ex-cb-6', name: 'Panturrilha em Pé no Smith', muscleGroup: 'Panturrilha',     sets: 5, reps: '20',    rest: '30s' },
      ],
    },
    // ── Carlos — Treino C (Core) ───────────────────────────────────────────────
    {
      id: 'wp-carlos-c', alunoId: AL.carlos, alunoName: 'Carlos Mendes', ptId: PT.joao,
      label: 'Treino C', focus: 'Core & Funcional',
      updatedAt: '2026-06-18T09:00:00Z',
      exercises: [
        { id: 'ex-cc-1', name: 'Prancha Frontal',            muscleGroup: 'Core',            sets: 4, reps: '45s',   rest: '30s' },
        { id: 'ex-cc-2', name: 'Crunch no Cabo',             muscleGroup: 'Abdômen',         sets: 3, reps: '15',    rest: '45s' },
        { id: 'ex-cc-3', name: 'Prancha Lateral',            muscleGroup: 'Oblíquos',        sets: 3, reps: '30s cada', rest: '30s' },
        { id: 'ex-cc-4', name: 'Remada Curvada com Barra',   muscleGroup: 'Costas',          sets: 3, reps: '10',    rest: '90s' },
        { id: 'ex-cc-5', name: 'Afundo com Halteres',        muscleGroup: 'Glúteos',         sets: 3, reps: '12 cada', rest: '60s' },
        { id: 'ex-cc-6', name: 'Burpee',                     muscleGroup: 'Full Body',       sets: 3, reps: '10',    rest: '90s', notes: 'Manter ritmo constante' },
      ],
    },
    // ── Maria — Treino A ─────────────────────────────────────────────────────
    {
      id: 'wp-maria-a', alunoId: AL.maria, alunoName: 'Maria Fernandes', ptId: PT.joao,
      label: 'Treino A', focus: 'Superior — Foco Postural',
      updatedAt: '2026-06-14T11:00:00Z',
      exercises: [
        { id: 'ex-ma-1', name: 'Supino Inclinado com Halteres', muscleGroup: 'Peito',        sets: 3, reps: '12',    rest: '90s' },
        { id: 'ex-ma-2', name: 'Remada Unilateral',           muscleGroup: 'Costas',          sets: 3, reps: '12 cada', rest: '60s' },
        { id: 'ex-ma-3', name: 'Desenvolvimento Arnold',       muscleGroup: 'Ombros',         sets: 3, reps: '12',    rest: '90s' },
        { id: 'ex-ma-4', name: 'Tríceps Francês',             muscleGroup: 'Tríceps',         sets: 3, reps: '15',    rest: '60s' },
        { id: 'ex-ma-5', name: 'Rosca Alternada com Halteres', muscleGroup: 'Bíceps',        sets: 3, reps: '12 cada', rest: '60s' },
      ],
    },
    // ── Maria — Treino B ─────────────────────────────────────────────────────
    {
      id: 'wp-maria-b', alunoId: AL.maria, alunoName: 'Maria Fernandes', ptId: PT.joao,
      label: 'Treino B', focus: 'Inferior — Glúteos e Pernas',
      updatedAt: '2026-06-14T11:00:00Z',
      exercises: [
        { id: 'ex-mb-1', name: 'Agachamento Sumô com Haltere', muscleGroup: 'Glúteos',       sets: 4, reps: '12',    rest: '90s' },
        { id: 'ex-mb-2', name: 'Stiff com Halteres',          muscleGroup: 'Isquiotibiais',   sets: 3, reps: '12',    rest: '90s' },
        { id: 'ex-mb-3', name: 'Extensão de Quadril no Cross', muscleGroup: 'Glúteos',        sets: 3, reps: '15 cada', rest: '45s' },
        { id: 'ex-mb-4', name: 'Abdução de Quadril',          muscleGroup: 'Glúteos',         sets: 3, reps: '20',    rest: '45s' },
        { id: 'ex-mb-5', name: 'Panturrilha Sentado',         muscleGroup: 'Panturrilha',     sets: 4, reps: '15',    rest: '30s' },
      ],
    },
    // ── Sofia — Treino A ─────────────────────────────────────────────────────
    {
      id: 'wp-sofia-a', alunoId: AL.sofia, alunoName: 'Sofia Rodrigues', ptId: PT.joao,
      label: 'Treino A', focus: 'Full Body — Funcional',
      updatedAt: '2026-06-12T09:30:00Z',
      exercises: [
        { id: 'ex-sa-1', name: 'Swing com Kettlebell',        muscleGroup: 'Full Body',       sets: 4, reps: '15',    rest: '60s' },
        { id: 'ex-sa-2', name: 'Flexão de Braços',            muscleGroup: 'Peito/Tríceps',   sets: 3, reps: '10-12', rest: '60s' },
        { id: 'ex-sa-3', name: 'Agachamento com Salto',       muscleGroup: 'Quadríceps',      sets: 3, reps: '10',    rest: '90s' },
        { id: 'ex-sa-4', name: 'Remada Invertida no TRX',     muscleGroup: 'Costas',          sets: 3, reps: '12',    rest: '60s' },
        { id: 'ex-sa-5', name: 'Prancha com Toque no Ombro',  muscleGroup: 'Core',            sets: 3, reps: '40s',   rest: '30s' },
      ],
    },
    // ── Helena (Ana's aluna) — Treino A ──────────────────────────────────────
    {
      id: 'wp-helena-a', alunoId: AL.helena, alunoName: 'Helena Martins', ptId: PT.ana,
      label: 'Treino A', focus: 'Mobilidade & Estabilidade',
      updatedAt: '2026-06-16T08:00:00Z',
      exercises: [
        { id: 'ex-ha-1', name: 'Cat-Cow',                     muscleGroup: 'Coluna',          sets: 2, reps: '10',    rest: '30s', notes: 'Respiração lenta e controlada' },
        { id: 'ex-ha-2', name: 'Bird Dog',                    muscleGroup: 'Core/Estabilidade', sets: 3, reps: '10 cada', rest: '30s' },
        { id: 'ex-ha-3', name: 'Dead Bug',                    muscleGroup: 'Core',            sets: 3, reps: '10',    rest: '45s' },
        { id: 'ex-ha-4', name: 'Hip Hinge com Bastão',        muscleGroup: 'Mobilidade',      sets: 3, reps: '12',    rest: '45s' },
        { id: 'ex-ha-5', name: 'Prancha com Elevação de Braço', muscleGroup: 'Core',          sets: 3, reps: '8 cada', rest: '60s' },
        { id: 'ex-ha-6', name: 'Agachamento Assistido',       muscleGroup: 'Quadríceps',      sets: 3, reps: '12',    rest: '60s', notes: 'Segurar apoio se necessário' },
      ],
    },
  ]

  return { users, plans, pts, alunos, availabilities, bookings, modalidades, workoutPlans }
}

// ── Module-level mutable state ──────────────────────────────────────────────
export const db = createDB()

// ── Utilities ───────────────────────────────────────────────────────────────
export const delay = (ms = 280): Promise<void> => new Promise(r => setTimeout(r, ms))

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function getCurrentUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('fittrainly-auth')
    return raw ? (JSON.parse(raw)?.state?.user ?? null) : null
  } catch { return null }
}

export function syncSlotCounts() {
  for (const slot of db.availabilities) {
    const count = db.bookings.filter(b => b.availabilityId === slot.id && b.status === 'CONFIRMED').length
    slot.confirmedCount = count
    slot.availableSlots = slot.maxAlunos - count
  }
}

export function getPlanById(id?: string) {
  return db.plans.find(p => p.id === id)
}

export function getPTById(id: string) {
  return db.pts.find(p => p.id === id)
}

export function getSlotsForPT(ptId: string, startDate: string, endDate: string) {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  return db.availabilities.filter(s =>
    s.personalTrainerId === ptId &&
    new Date(s.startTime).getTime() >= start &&
    new Date(s.startTime).getTime() <= end
  )
}

export function getSlotsInRange(startDate: string, endDate: string) {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  return db.availabilities.filter(s =>
    new Date(s.startTime).getTime() >= start &&
    new Date(s.startTime).getTime() <= end
  )
}

export function getOccupationByDay() {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  return days.map((day, i) => {
    const d = addDays(monday, i)
    const dateStr = (() => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    })()
    const slots = db.availabilities.filter(s => s.startTime.startsWith(dateStr))
    const occupied = slots.reduce((s, sl) => s + sl.confirmedCount, 0)
    const available = slots.reduce((s, sl) => s + sl.availableSlots, 0)
    return { day, occupied, available }
  })
}

export function sessionsThisWeek() {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const sunday = addDays(monday, 6)
  return db.bookings.filter(b =>
    b.status === 'CONFIRMED' &&
    new Date(b.startTime) >= monday &&
    new Date(b.startTime) <= sunday
  ).length
}

export function estimatedRevenue() {
  let total = 0
  for (const pt of db.pts) {
    const plan = getPlanById(pt.planId)
    if (!plan) continue
    if (plan.type === 'MONTHLY') total += plan.priceMonthly ?? 0
    if (plan.type === 'WEEKLY')  total += (plan.priceWeekly ?? 0) * 4
    if (plan.type === 'HOURLY')  total += (plan.priceHourly ?? 0) * pt.hoursThisMonth
  }
  return total
}
