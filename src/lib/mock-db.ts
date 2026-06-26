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

// ── Studio Slot Configuration ─────────────────────────────────────────────────
// Fixed 40-min intervals. Mon-Fri: 7:00–19:40 (20 slots). Sat: 9:00–12:20 (6 slots). Sun: closed.
export const STUDIO_SLOTS_WEEKDAY: string[] = [
  '07:00','07:40','08:20','09:00','09:40','10:20',
  '11:00','11:40','12:20','13:00','13:40','14:20',
  '15:00','15:40','16:20','17:00','17:40','18:20',
  '19:00','19:40',
]
export const STUDIO_SLOTS_SAT: string[] = [
  '09:00','09:40','10:20','11:00','11:40','12:20',
]
export const STUDIO_MAX_SPOTS = 4

export function getSlotTimesForDay(date: Date): string[] {
  const dow = date.getDay()
  if (dow === 0) return []
  if (dow === 6) return [...STUDIO_SLOTS_SAT]
  return [...STUDIO_SLOTS_WEEKDAY]
}

export function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
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
  id: string; userId: string; name: string; email: string; phone?: string
  personalTrainerId: string; personalTrainerName: string
  nextSession?: string; completedSessions?: number
  status: 'ATIVO' | 'INATIVO' | 'SUSPENSO'
  dataNascimento?: string; inscricaoDate: string; objetivo?: string
}

// PT releases a studio slot for their alunos to book
export interface MockPTRelease {
  id: string
  ptId: string
  ptName: string
  date: string      // "YYYY-MM-DD"
  slotTime: string  // "HH:MM"
}

// Booking: aluno books a PT's released slot inside a studio slot
export interface MockBooking {
  id: string
  slotKey: string        // "YYYY-MM-DD-HH:MM"
  availabilityId: string // alias of slotKey for backward compat
  alunoId: string; alunoName: string
  personalTrainerId: string; personalTrainerName: string
  startTime: string; endTime: string  // ISO
  sessionDuration: 30 | 60
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  createdAt: string
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
  exercises: MockExercise[]
  validUntil?: string; updatedAt: string
}
export interface MockAvaliacao {
  id: string; alunoId: string; alunoName: string; ptId: string
  tipo: 'PRIMEIRA' | 'REAVALIACAO'; data: string
  frequenciaSemanal?: number; peso?: number; altura?: number; imc?: number
  percentualGordura?: number; massaMuscular?: number
  objetivo?: string; observacoes?: string; proximaAvaliacao?: string
  createdAt: string
}
export interface MockPack {
  id: string; alunoId: string; alunoName: string
  total: number; used: number
  sessionDuration: 30 | 60
  expiresAt?: string
  status: 'ACTIVE' | 'EXPIRED' | 'DEPLETED'
  createdAt: string
}
export interface MockLead {
  id: string; name: string; email?: string; phone?: string
  status: 'NOVO' | 'CONTACTADO' | 'VISITA_AGENDADA' | 'VISITOU' | 'INSCRITO' | 'PERDIDO' | 'NAO_DEU_FEEDBACK' | 'ARQUIVADO'
  interesse?: string; source?: string; responsavel?: string
  visitaDate?: string; observacoes?: string; tags?: string[]
  planoInteresse?: string; followUpDate?: string
  inscritoEm?: string
  createdAt: string; updatedAt: string
}
export interface MockNotificationConfig {
  id: string; type: string; label: string; description: string
  enabled: boolean; daysOffset?: number; triggerLabel: string
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function localDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function makeSlotKey(date: string, time: string): string {
  return `${date}-${time}`
}

function slotISO(date: string, time: string): { start: string; end: string } {
  return {
    start: `${date}T${time}:00Z`,
    end:   `${date}T${addMinutesToTime(time, 40)}:00Z`,
  }
}

// ── Seed generators ─────────────────────────────────────────────────────────
function genPTReleases(
  ptId: string, ptName: string,
  filter: (dow: number, time: string) => boolean,
  weeksAhead = 3,
): MockPTRelease[] {
  const releases: MockPTRelease[] = []
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  for (let w = 0; w < weeksAhead; w++) {
    const wk = addWeeks(monday, w)
    for (let d = 0; d < 7; d++) {
      const day = addDays(wk, d)
      const dow = day.getDay()
      const date = localDate(day)
      const times = getSlotTimesForDay(day)
      for (const time of times) {
        if (filter(dow, time)) {
          releases.push({ id: `rel-${ptId}-${date}-${time}`, ptId, ptName, date, slotTime: time })
        }
      }
    }
  }
  return releases
}

function makeBooking(
  id: string, date: string, time: string,
  ptId: string, ptName: string,
  alunoId: string, alunoName: string,
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
  sessionDuration: 30 | 60 = 60,
  createdAt?: string,
): MockBooking {
  const key = makeSlotKey(date, time)
  const { start, end } = slotISO(date, time)
  return {
    id, slotKey: key, availabilityId: key,
    alunoId, alunoName, personalTrainerId: ptId, personalTrainerName: ptName,
    startTime: start, endTime: end, sessionDuration,
    status, createdAt: createdAt ?? new Date().toISOString(),
  }
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
    { id: PT.joao, userId: U.joao, name: 'João Silva', email: 'joao@fittrainly.com', phone: '+351 912 345 678', specialty: 'Musculação e Força', bio: 'Especialista em hipertrofia com 8 anos de experiência. Certificado pela NSCA.', active: true, inadimplente: false, planId: P.monthly, alunoCount: 4, hoursThisMonth: 22 },
    { id: PT.ana,  userId: U.ana,  name: 'Ana Costa',  email: 'ana@fittrainly.com',  phone: '+351 913 456 789', specialty: 'Funcional e Mobilidade', bio: 'Certificada pela NSCA, foco em longevidade e qualidade de movimento.', active: true, inadimplente: false, planId: P.hourly, alunoCount: 2, hoursThisMonth: 14 },
    { id: PT.pedro,userId: U.pedro,name: 'Pedro Santos',email:'pedro@fittrainly.com',phone: '+351 914 567 890', specialty: 'Emagrecimento e Saúde', bio: 'Nutricionista e personal trainer, abordagem holística do emagrecimento.', active: true, inadimplente: true, planId: P.weekly, alunoCount: 2, hoursThisMonth: 8 },
  ]

  const alunos: MockAluno[] = [
    { id: AL.carlos, userId: U.carlos, name: 'Carlos Mendes',   email: 'carlos@fittrainly.com', phone: '+351 913 001 001', personalTrainerId: PT.joao,  personalTrainerName: 'João Silva',   completedSessions: 12, status: 'ATIVO',    dataNascimento: '1991-03-14', inscricaoDate: '2026-01-10', objetivo: 'Hipertrofia e definição muscular' },
    { id: AL.maria,  userId: U.maria,  name: 'Maria Fernandes', email: 'maria@fittrainly.com',  phone: '+351 913 001 002', personalTrainerId: PT.joao,  personalTrainerName: 'João Silva',   completedSessions: 8,  status: 'ATIVO',    dataNascimento: '1988-07-22', inscricaoDate: '2026-02-03', objetivo: 'Emagrecimento e tonificação' },
    { id: AL.sofia,  userId: U.sofia,  name: 'Sofia Rodrigues', email: 'sofia@fittrainly.com',  phone: '+351 913 001 003', personalTrainerId: PT.joao,  personalTrainerName: 'João Silva',   completedSessions: 5,  status: 'ATIVO',    dataNascimento: '1995-11-05', inscricaoDate: '2026-03-15', objetivo: 'Condicionamento físico geral' },
    { id: AL.rui,    userId: U.rui,    name: 'Rui Oliveira',    email: 'rui@fittrainly.com',    phone: '+351 913 001 004', personalTrainerId: PT.joao,  personalTrainerName: 'João Silva',   completedSessions: 3,  status: 'INATIVO',  dataNascimento: '1983-05-30', inscricaoDate: '2026-04-01', objetivo: 'Reabilitação pós-lesão e força' },
    { id: AL.helena, userId: U.helena, name: 'Helena Martins',  email: 'helena@fittrainly.com', phone: '+351 913 001 005', personalTrainerId: PT.ana,   personalTrainerName: 'Ana Costa',    completedSessions: 7,  status: 'ATIVO',    dataNascimento: '1979-09-18', inscricaoDate: '2026-01-20', objetivo: 'Mobilidade e longevidade' },
    { id: AL.tiago,  userId: U.tiago,  name: 'Tiago Ferreira',  email: 'tiago@fittrainly.com',  phone: '+351 913 001 006', personalTrainerId: PT.ana,   personalTrainerName: 'Ana Costa',    completedSessions: 4,  status: 'ATIVO',    dataNascimento: '1999-02-14', inscricaoDate: '2026-02-28', objetivo: 'Performance desportiva' },
    { id: AL.paula,  userId: U.paula,  name: 'Paula Lima',      email: 'paula@fittrainly.com',  phone: '+351 913 001 007', personalTrainerId: PT.pedro, personalTrainerName: 'Pedro Santos', completedSessions: 2,  status: 'ATIVO',    dataNascimento: '1985-12-01', inscricaoDate: '2026-05-10', objetivo: 'Perda de peso e saúde metabólica' },
    { id: AL.miguel, userId: U.miguel, name: 'Miguel Sousa',    email: 'miguel@fittrainly.com', phone: '+351 913 001 008', personalTrainerId: PT.pedro, personalTrainerName: 'Pedro Santos', completedSessions: 1,  status: 'SUSPENSO', dataNascimento: '1992-08-09', inscricaoDate: '2026-05-20', objetivo: 'Ganho de massa muscular' },
  ]

  // ── PT Releases — each PT releases their preferred studio slots ──────────────
  // dow: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const MORNINGS  = (t: string) => t <= '11:40'
  const AFTERNOONS = (t: string) => t >= '17:00'
  const MID_AM = (t: string) => t >= '09:00' && t <= '11:00'
  const MID_LATE = (t: string) => t >= '10:20' && t <= '12:20'
  const EVES = (t: string) => t >= '18:20'

  const ptReleases: MockPTRelease[] = [
    // João: weekday mornings + afternoons + Sat 9h-10:20
    ...genPTReleases(PT.joao, 'João Silva', (dow, t) =>
      dow >= 1 && dow <= 5 && (MORNINGS(t) || AFTERNOONS(t)) ||
      dow === 6 && t <= '10:20'
    ),
    // Ana: weekday mid-mornings + afternoon block
    ...genPTReleases(PT.ana, 'Ana Costa', (dow, t) =>
      dow >= 1 && dow <= 5 && (MID_AM(t) || (t >= '17:00' && t <= '18:20'))
    ),
    // Pedro: weekday mid-late morning + evenings + Sat 11h-12:20
    ...genPTReleases(PT.pedro, 'Pedro Santos', (dow, t) =>
      dow >= 1 && dow <= 5 && (MID_LATE(t) || EVES(t)) ||
      dow === 6 && t >= '11:00'
    ),
  ]

  // ── Bookings seed ─────────────────────────────────────────────────────────────
  const bookings: MockBooking[] = []
  const now = new Date()
  const nextMonday = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1)
  const lastMonday = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), -1)

  // Next week CONFIRMED — João's alunos at 09:00
  for (let d = 0; d < 4; d++) {
    const day = addDays(nextMonday, d)
    const date = localDate(day)
    ;[
      { id: AL.carlos, name: 'Carlos Mendes' },
      { id: AL.maria,  name: 'Maria Fernandes' },
      { id: AL.sofia,  name: 'Sofia Rodrigues' },
    ].forEach(a => {
      bookings.push(makeBooking(`bk-${a.id}-${date}-09:00`, date, '09:00', PT.joao, 'João Silva', a.id, a.name, 'CONFIRMED', 60))
    })
    // Rui at 18:20 (first 2 days)
    if (d < 2) {
      bookings.push(makeBooking(`bk-${AL.rui}-${date}-18:20`, date, '18:20', PT.joao, 'João Silva', AL.rui, 'Rui Oliveira', 'CONFIRMED', 60))
    }
  }

  // Ana's alunos at 10:20 on Tue + Thu next week
  for (const dOff of [1, 3]) {
    const day = addDays(nextMonday, dOff)
    const date = localDate(day)
    ;[
      { id: AL.helena, name: 'Helena Martins' },
      { id: AL.tiago,  name: 'Tiago Ferreira' },
    ].forEach(a => {
      bookings.push(makeBooking(`bk-${a.id}-${date}-10:20`, date, '10:20', PT.ana, 'Ana Costa', a.id, a.name, 'CONFIRMED', 60))
    })
  }

  // Pedro's aluno at 11:00 on Wed next week
  const pedWed = addDays(nextMonday, 2)
  const pedDate = localDate(pedWed)
  bookings.push(makeBooking(`bk-${AL.paula}-${pedDate}-11:00`, pedDate, '11:00', PT.pedro, 'Pedro Santos', AL.paula, 'Paula Lima', 'CONFIRMED', 60))

  // Last week COMPLETED — Carlos daily at 09:00
  for (let d = 0; d < 5; d++) {
    const day = addDays(lastMonday, d)
    const date = localDate(day)
    bookings.push(makeBooking(`bk-past-carlos-${date}-09:00`, date, '09:00', PT.joao, 'João Silva', AL.carlos, 'Carlos Mendes', 'COMPLETED', 60, day.toISOString()))
  }

  // One cancelled booking for history
  const cancelDay = addDays(lastMonday, 2)
  const cancelDate = localDate(cancelDay)
  bookings.push(makeBooking(`bk-cancel-carlos-${cancelDate}-17:00`, cancelDate, '17:00', PT.joao, 'João Silva', AL.carlos, 'Carlos Mendes', 'CANCELLED', 60, cancelDay.toISOString()))

  // ── Sync nextSession for alunos ──────────────────────────────────────────────
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
    { id: 'wp-carlos-a', alunoId: AL.carlos, alunoName: 'Carlos Mendes', ptId: PT.joao, label: 'Treino A', focus: 'Superior — Peito, Ombros, Braços', updatedAt: '2026-06-15T10:00:00Z', validUntil: '2026-07-15', exercises: [
      { id: 'ex-ca-1', name: 'Supino Reto com Barra', muscleGroup: 'Peito', sets: 4, reps: '8-10', rest: '90s' },
      { id: 'ex-ca-2', name: 'Voador Pec Deck', muscleGroup: 'Peito', sets: 3, reps: '12-15', rest: '60s' },
      { id: 'ex-ca-3', name: 'Desenvolvimento com Halteres', muscleGroup: 'Ombros', sets: 3, reps: '10-12', rest: '90s' },
      { id: 'ex-ca-4', name: 'Elevação Lateral', muscleGroup: 'Ombros', sets: 4, reps: '15', rest: '45s' },
      { id: 'ex-ca-5', name: 'Tríceps Polia Alta', muscleGroup: 'Tríceps', sets: 4, reps: '12', rest: '60s' },
      { id: 'ex-ca-6', name: 'Rosca Scott com Barra', muscleGroup: 'Bíceps', sets: 3, reps: '12', rest: '60s', notes: 'Controlar a descida — 3 segundos' },
    ]},
    { id: 'wp-carlos-b', alunoId: AL.carlos, alunoName: 'Carlos Mendes', ptId: PT.joao, label: 'Treino B', focus: 'Inferior — Quadríceps, Glúteos, Isquiotibiais', updatedAt: '2026-06-15T10:00:00Z', validUntil: '2026-07-15', exercises: [
      { id: 'ex-cb-1', name: 'Agachamento Livre', muscleGroup: 'Quadríceps', sets: 4, reps: '6-8', rest: '2min', notes: 'Descer até 90° — manter joelhos alinhados' },
      { id: 'ex-cb-2', name: 'Leg Press 45°', muscleGroup: 'Quadríceps', sets: 3, reps: '12', rest: '90s' },
      { id: 'ex-cb-3', name: 'Cadeira Extensora', muscleGroup: 'Quadríceps', sets: 3, reps: '15', rest: '60s' },
      { id: 'ex-cb-4', name: 'Mesa Flexora', muscleGroup: 'Isquiotibiais', sets: 3, reps: '12-15', rest: '60s' },
      { id: 'ex-cb-5', name: 'Stiff com Halteres', muscleGroup: 'Isquiotibiais', sets: 3, reps: '10-12', rest: '90s' },
      { id: 'ex-cb-6', name: 'Panturrilha em Pé no Smith', muscleGroup: 'Panturrilha', sets: 5, reps: '20', rest: '30s' },
    ]},
    { id: 'wp-carlos-c', alunoId: AL.carlos, alunoName: 'Carlos Mendes', ptId: PT.joao, label: 'Treino C', focus: 'Core & Funcional', updatedAt: '2026-06-18T09:00:00Z', validUntil: '2026-07-15', exercises: [
      { id: 'ex-cc-1', name: 'Prancha Frontal', muscleGroup: 'Core', sets: 4, reps: '45s', rest: '30s' },
      { id: 'ex-cc-2', name: 'Crunch no Cabo', muscleGroup: 'Abdômen', sets: 3, reps: '15', rest: '45s' },
      { id: 'ex-cc-3', name: 'Prancha Lateral', muscleGroup: 'Oblíquos', sets: 3, reps: '30s cada', rest: '30s' },
      { id: 'ex-cc-4', name: 'Remada Curvada com Barra', muscleGroup: 'Costas', sets: 3, reps: '10', rest: '90s' },
      { id: 'ex-cc-5', name: 'Afundo com Halteres', muscleGroup: 'Glúteos', sets: 3, reps: '12 cada', rest: '60s' },
      { id: 'ex-cc-6', name: 'Burpee', muscleGroup: 'Full Body', sets: 3, reps: '10', rest: '90s', notes: 'Manter ritmo constante' },
    ]},
    { id: 'wp-maria-a', alunoId: AL.maria, alunoName: 'Maria Fernandes', ptId: PT.joao, label: 'Treino A', focus: 'Superior — Foco Postural', updatedAt: '2026-06-14T11:00:00Z', validUntil: '2026-08-01', exercises: [
      { id: 'ex-ma-1', name: 'Supino Inclinado com Halteres', muscleGroup: 'Peito', sets: 3, reps: '12', rest: '90s' },
      { id: 'ex-ma-2', name: 'Remada Unilateral', muscleGroup: 'Costas', sets: 3, reps: '12 cada', rest: '60s' },
      { id: 'ex-ma-3', name: 'Desenvolvimento Arnold', muscleGroup: 'Ombros', sets: 3, reps: '12', rest: '90s' },
      { id: 'ex-ma-4', name: 'Tríceps Francês', muscleGroup: 'Tríceps', sets: 3, reps: '15', rest: '60s' },
      { id: 'ex-ma-5', name: 'Rosca Alternada com Halteres', muscleGroup: 'Bíceps', sets: 3, reps: '12 cada', rest: '60s' },
    ]},
    { id: 'wp-maria-b', alunoId: AL.maria, alunoName: 'Maria Fernandes', ptId: PT.joao, label: 'Treino B', focus: 'Inferior — Glúteos e Pernas', updatedAt: '2026-06-14T11:00:00Z', validUntil: '2026-08-01', exercises: [
      { id: 'ex-mb-1', name: 'Agachamento Sumô com Haltere', muscleGroup: 'Glúteos', sets: 4, reps: '12', rest: '90s' },
      { id: 'ex-mb-2', name: 'Stiff com Halteres', muscleGroup: 'Isquiotibiais', sets: 3, reps: '12', rest: '90s' },
      { id: 'ex-mb-3', name: 'Extensão de Quadril no Cross', muscleGroup: 'Glúteos', sets: 3, reps: '15 cada', rest: '45s' },
      { id: 'ex-mb-4', name: 'Abdução de Quadril', muscleGroup: 'Glúteos', sets: 3, reps: '20', rest: '45s' },
      { id: 'ex-mb-5', name: 'Panturrilha Sentado', muscleGroup: 'Panturrilha', sets: 4, reps: '15', rest: '30s' },
    ]},
    { id: 'wp-sofia-a', alunoId: AL.sofia, alunoName: 'Sofia Rodrigues', ptId: PT.joao, label: 'Treino A', focus: 'Full Body — Funcional', updatedAt: '2026-06-12T09:30:00Z', validUntil: '2026-07-20', exercises: [
      { id: 'ex-sa-1', name: 'Swing com Kettlebell', muscleGroup: 'Full Body', sets: 4, reps: '15', rest: '60s' },
      { id: 'ex-sa-2', name: 'Flexão de Braços', muscleGroup: 'Peito/Tríceps', sets: 3, reps: '10-12', rest: '60s' },
      { id: 'ex-sa-3', name: 'Agachamento com Salto', muscleGroup: 'Quadríceps', sets: 3, reps: '10', rest: '90s' },
      { id: 'ex-sa-4', name: 'Remada Invertida no TRX', muscleGroup: 'Costas', sets: 3, reps: '12', rest: '60s' },
      { id: 'ex-sa-5', name: 'Prancha com Toque no Ombro', muscleGroup: 'Core', sets: 3, reps: '40s', rest: '30s' },
    ]},
    { id: 'wp-helena-a', alunoId: AL.helena, alunoName: 'Helena Martins', ptId: PT.ana, label: 'Treino A', focus: 'Mobilidade & Estabilidade', updatedAt: '2026-06-16T08:00:00Z', validUntil: '2026-09-01', exercises: [
      { id: 'ex-ha-1', name: 'Cat-Cow', muscleGroup: 'Coluna', sets: 2, reps: '10', rest: '30s', notes: 'Respiração lenta e controlada' },
      { id: 'ex-ha-2', name: 'Bird Dog', muscleGroup: 'Core/Estabilidade', sets: 3, reps: '10 cada', rest: '30s' },
      { id: 'ex-ha-3', name: 'Dead Bug', muscleGroup: 'Core', sets: 3, reps: '10', rest: '45s' },
      { id: 'ex-ha-4', name: 'Hip Hinge com Bastão', muscleGroup: 'Mobilidade', sets: 3, reps: '12', rest: '45s' },
      { id: 'ex-ha-5', name: 'Prancha com Elevação de Braço', muscleGroup: 'Core', sets: 3, reps: '8 cada', rest: '60s' },
      { id: 'ex-ha-6', name: 'Agachamento Assistido', muscleGroup: 'Quadríceps', sets: 3, reps: '12', rest: '60s', notes: 'Segurar apoio se necessário' },
    ]},
  ]

  const avaliacoes: MockAvaliacao[] = [
    { id: 'av-eval-01', alunoId: AL.carlos, alunoName: 'Carlos Mendes', ptId: PT.joao, tipo: 'PRIMEIRA',    data: '2026-01-12', frequenciaSemanal: 3, peso: 84.5, altura: 178, imc: 26.7, percentualGordura: 22.1, massaMuscular: 38.4, objetivo: 'Hipertrofia e definição', observacoes: 'Boa mobilidade. Histórico de dor lombar leve.', proximaAvaliacao: '2026-04-12', createdAt: '2026-01-12T10:00:00Z' },
    { id: 'av-eval-02', alunoId: AL.carlos, alunoName: 'Carlos Mendes', ptId: PT.joao, tipo: 'REAVALIACAO', data: '2026-04-14', frequenciaSemanal: 3, peso: 81.2, altura: 178, imc: 25.6, percentualGordura: 18.3, massaMuscular: 40.1, objetivo: 'Hipertrofia e definição', observacoes: 'Ótima evolução. Redução de 3.8% gordura em 3 meses.', proximaAvaliacao: '2026-07-14', createdAt: '2026-04-14T10:00:00Z' },
    { id: 'av-eval-03', alunoId: AL.maria,  alunoName: 'Maria Fernandes', ptId: PT.joao, tipo: 'PRIMEIRA',    data: '2026-02-05', frequenciaSemanal: 2, peso: 68.0, altura: 163, imc: 25.6, percentualGordura: 31.2, massaMuscular: 27.8, objetivo: 'Emagrecimento e tonificação', observacoes: 'Sem lesões. Foco em glúteos e abdômen.', proximaAvaliacao: '2026-05-05', createdAt: '2026-02-05T11:00:00Z' },
    { id: 'av-eval-04', alunoId: AL.maria,  alunoName: 'Maria Fernandes', ptId: PT.joao, tipo: 'REAVALIACAO', data: '2026-05-07', frequenciaSemanal: 3, peso: 65.4, altura: 163, imc: 24.6, percentualGordura: 28.7, massaMuscular: 28.9, objetivo: 'Emagrecimento e tonificação', observacoes: 'Perdeu 2.6kg e ganhou 1.1kg de massa. Excelente.', proximaAvaliacao: '2026-08-07', createdAt: '2026-05-07T11:00:00Z' },
    { id: 'av-eval-05', alunoId: AL.helena, alunoName: 'Helena Martins',  ptId: PT.ana,  tipo: 'PRIMEIRA',    data: '2026-01-22', frequenciaSemanal: 2, peso: 61.0, altura: 165, imc: 22.4, percentualGordura: 28.5, massaMuscular: 24.2, objetivo: 'Mobilidade e longevidade', observacoes: 'Hipermobilidade nos ombros. Cuidado com exercícios de impacto.', proximaAvaliacao: '2026-04-22', createdAt: '2026-01-22T09:00:00Z' },
    { id: 'av-eval-06', alunoId: AL.sofia,  alunoName: 'Sofia Rodrigues', ptId: PT.joao, tipo: 'PRIMEIRA',    data: '2026-03-17', frequenciaSemanal: 3, peso: 56.2, altura: 161, imc: 21.7, percentualGordura: 24.8, massaMuscular: 23.5, objetivo: 'Condicionamento físico', observacoes: 'Atleta amadora. Boa capacidade cardiorrespiratória.', proximaAvaliacao: '2026-06-17', createdAt: '2026-03-17T14:00:00Z' },
  ]

  const packs: MockPack[] = [
    { id: 'pack-01', alunoId: AL.carlos, alunoName: 'Carlos Mendes',   total: 20, used: 12, sessionDuration: 60, expiresAt: '2026-08-10', status: 'ACTIVE',   createdAt: '2026-01-10T00:00:00Z' },
    { id: 'pack-02', alunoId: AL.maria,  alunoName: 'Maria Fernandes', total: 10, used: 8,  sessionDuration: 60, expiresAt: '2026-07-03', status: 'ACTIVE',   createdAt: '2026-02-03T00:00:00Z' },
    { id: 'pack-03', alunoId: AL.sofia,  alunoName: 'Sofia Rodrigues', total: 10, used: 5,  sessionDuration: 60, expiresAt: '2026-07-15', status: 'ACTIVE',   createdAt: '2026-03-15T00:00:00Z' },
    { id: 'pack-04', alunoId: AL.helena, alunoName: 'Helena Martins',  total: 10, used: 7,  sessionDuration: 60, expiresAt: '2026-07-20', status: 'ACTIVE',   createdAt: '2026-01-20T00:00:00Z' },
    { id: 'pack-05', alunoId: AL.tiago,  alunoName: 'Tiago Ferreira',  total: 10, used: 4,  sessionDuration: 60, expiresAt: '2026-08-28', status: 'ACTIVE',   createdAt: '2026-02-28T00:00:00Z' },
    { id: 'pack-06', alunoId: AL.rui,    alunoName: 'Rui Oliveira',    total: 10, used: 10, sessionDuration: 60, expiresAt: '2026-05-01', status: 'DEPLETED', createdAt: '2025-12-01T00:00:00Z' },
  ]

  const leads: MockLead[] = [
    // ── Pipeline ativo (junho 2026) ──────────────────────────────────────────
    { id: 'lead-01', name: 'André Pereira',    phone: '+351 916 111 001', email: 'andre.p@email.com',   status: 'NOVO',            interesse: 'Musculação',     source: 'Instagram',  responsavel: 'Úrsula', followUpDate: '2026-06-27', createdAt: '2026-06-22T10:00:00Z', updatedAt: '2026-06-22T10:00:00Z' },
    { id: 'lead-08', name: 'Luísa Ferreira',   phone: '+351 916 111 008', email: 'luisa.f@email.com',   status: 'NOVO',            interesse: 'Yoga',           source: 'Referência', responsavel: 'João',   followUpDate: '2026-06-26', createdAt: '2026-06-24T08:00:00Z', updatedAt: '2026-06-24T08:00:00Z' },
    { id: 'lead-02', name: 'Beatriz Costa',    phone: '+351 916 111 002', email: 'bea.costa@email.com', status: 'CONTACTADO',      interesse: 'Yoga e Pilates', source: 'Referência', responsavel: 'Úrsula', planoInteresse: 'Pack Mensal', observacoes: 'Ligou 23/06 — interesse confirmado', followUpDate: '2026-06-26', createdAt: '2026-06-20T14:00:00Z', updatedAt: '2026-06-23T09:00:00Z' },
    { id: 'lead-09', name: 'Ricardo Santos',   phone: '+351 916 111 009',                               status: 'CONTACTADO',      interesse: 'Emagrecimento',  source: 'Google',     responsavel: 'João',   planoInteresse: '10 sessões', observacoes: '2ª tentativa de contacto', followUpDate: '2026-06-25', createdAt: '2026-06-21T11:00:00Z', updatedAt: '2026-06-24T10:00:00Z' },
    { id: 'lead-03', name: 'Diogo Lopes',      phone: '+351 916 111 003',                               status: 'VISITA_AGENDADA', interesse: 'Funcional',      source: 'Google',     responsavel: 'Úrsula', planoInteresse: 'Pack Mensal', visitaDate: '2026-06-26T10:00:00Z', createdAt: '2026-06-18T11:00:00Z', updatedAt: '2026-06-24T08:00:00Z' },
    { id: 'lead-04', name: 'Filipa Nunes',     phone: '+351 916 111 004', email: 'filipa@email.com',    status: 'VISITA_AGENDADA', interesse: 'Emagrecimento',  source: 'Instagram',  responsavel: 'Úrsula', visitaDate: '2026-06-25T11:00:00Z', createdAt: '2026-06-19T15:00:00Z', updatedAt: '2026-06-23T17:00:00Z' },
    { id: 'lead-05', name: 'Gonçalo Ribeiro',  phone: '+351 916 111 005',                               status: 'VISITOU',         interesse: 'Musculação',     source: 'Amigo',      responsavel: 'João',   planoInteresse: 'Pack Mensal', visitaDate: '2026-06-21T10:00:00Z', observacoes: 'Gostou muito. Quer pensar no preço.', followUpDate: '2026-06-26', tags: ['segue-preco', 'alta-intencao'], createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-06-21T12:00:00Z' },
    { id: 'lead-06', name: 'Isabel Martins',   phone: '+351 916 111 006', email: 'isabel.m@email.com',  status: 'INSCRITO',        interesse: 'Funcional',      source: 'Instagram',  responsavel: 'Úrsula', planoInteresse: 'Pack Mensal', inscritoEm: '2026-06-17T10:00:00Z', createdAt: '2026-06-10T10:00:00Z', updatedAt: '2026-06-17T10:00:00Z' },
    { id: 'lead-10', name: 'Mariana Vieira',   phone: '+351 916 111 010', email: 'mariana.v@email.com', status: 'INSCRITO',        interesse: 'Musculação',     source: 'Referência', responsavel: 'Úrsula', planoInteresse: '10 sessões', inscritoEm: '2026-06-20T14:00:00Z', createdAt: '2026-06-12T09:00:00Z', updatedAt: '2026-06-20T14:00:00Z' },
    // ── Sem feedback (visitou mas não respondeu) ────────────────────────────
    { id: 'lead-11', name: 'Nuno Figueiredo',  phone: '+351 916 111 011',                               status: 'NAO_DEU_FEEDBACK', interesse: 'Funcional',     source: 'Google',     responsavel: 'Úrsula', visitaDate: '2026-06-18T10:00:00Z', observacoes: 'Visitou, pareceu interessado. Não atendeu chamadas.', followUpDate: '2026-06-28', createdAt: '2026-06-14T10:00:00Z', updatedAt: '2026-06-19T11:00:00Z' },
    { id: 'lead-12', name: 'Catarina Pinto',   phone: '+351 916 111 012', email: 'cata.p@email.com',    status: 'NAO_DEU_FEEDBACK', interesse: 'Yoga',          source: 'Instagram',  responsavel: 'João',   visitaDate: '2026-06-16T14:00:00Z', createdAt: '2026-06-11T10:00:00Z', updatedAt: '2026-06-17T10:00:00Z' },
    // ── Perdidos ─────────────────────────────────────────────────────────────
    { id: 'lead-07', name: 'Jorge Almeida',    phone: '+351 916 111 007',                               status: 'PERDIDO',          interesse: 'Musculação',     source: 'Google',     responsavel: 'Úrsula', observacoes: 'Escolheu outro ginásio — preço.', createdAt: '2026-06-05T10:00:00Z', updatedAt: '2026-06-12T10:00:00Z' },
    { id: 'lead-13', name: 'Paulo Esteves',    phone: '+351 916 111 013',                               status: 'PERDIDO',          interesse: 'Emagrecimento',  source: 'Referência', responsavel: 'João',   observacoes: 'Localização muito longe.', createdAt: '2026-06-03T10:00:00Z', updatedAt: '2026-06-08T10:00:00Z' },
    // ── Arquivados (inscritos de meses anteriores) ──────────────────────────
    { id: 'lead-14', name: 'Sara Oliveira',    phone: '+351 916 111 014', email: 'sara.o@email.com',    status: 'ARQUIVADO',        interesse: 'Funcional',      source: 'Instagram',  responsavel: 'Úrsula', inscritoEm: '2026-05-20T10:00:00Z', createdAt: '2026-05-10T10:00:00Z', updatedAt: '2026-05-20T10:00:00Z' },
    { id: 'lead-15', name: 'Bruno Carvalho',   phone: '+351 916 111 015',                               status: 'ARQUIVADO',        interesse: 'Musculação',     source: 'Amigo',      responsavel: 'Úrsula', inscritoEm: '2026-05-15T10:00:00Z', createdAt: '2026-05-05T10:00:00Z', updatedAt: '2026-05-15T10:00:00Z' },
    { id: 'lead-16', name: 'Teresa Morais',    phone: '+351 916 111 016', email: 'teresa.m@email.com',  status: 'ARQUIVADO',        interesse: 'Emagrecimento',  source: 'Google',     responsavel: 'João',   inscritoEm: '2026-04-22T10:00:00Z', createdAt: '2026-04-10T10:00:00Z', updatedAt: '2026-04-22T10:00:00Z' },
  ]

  const notificationConfigs: MockNotificationConfig[] = [
    { id: 'nc-01', type: 'BOOKING_CONFIRMATION', label: 'Confirmação de marcação',      description: 'Enviada quando o aluno faz uma nova marcação',                  enabled: true,  triggerLabel: 'No momento da marcação' },
    { id: 'nc-02', type: 'BOOKING_REMINDER',     label: 'Lembrete de treino (D-1)',     description: 'Lembrete no dia anterior ao treino marcado',                   enabled: true,  daysOffset: 1,  triggerLabel: '1 dia antes do treino' },
    { id: 'nc-03', type: 'FIRST_EVAL_CONFIRM',   label: 'Confirmação 1ª Avaliação',     description: 'Enviada quando a 1ª avaliação física é agendada',              enabled: true,  triggerLabel: 'No momento do agendamento' },
    { id: 'nc-04', type: 'FIRST_EVAL_REMINDER',  label: 'Lembrete 1ª Avaliação (D-1)', description: 'Lembrete no dia anterior à avaliação física',                  enabled: true,  daysOffset: 1,  triggerLabel: '1 dia antes da avaliação' },
    { id: 'nc-05', type: 'ABSENCE_7_DAYS',       label: 'Aluno inativo 7 dias',         description: 'Alerta quando o aluno não tem marcações há 7 dias',            enabled: true,  daysOffset: 7,  triggerLabel: '7 dias sem marcações' },
    { id: 'nc-06', type: 'ABSENCE_15_DAYS',      label: 'Aluno inativo 15 dias',        description: 'Alerta ao PT responsável quando aluno está 15 dias inativo',   enabled: true,  daysOffset: 15, triggerLabel: '15 dias sem marcações' },
    { id: 'nc-07', type: 'BIRTHDAY',             label: 'Feliz aniversário',            description: 'Mensagem personalizada no dia de aniversário do aluno',        enabled: true,  triggerLabel: 'No dia do aniversário' },
    { id: 'nc-08', type: 'MOTIVATIONAL_30',      label: 'Motivação 30 dias',            description: 'Mensagem motivacional enviada 30 dias após a inscrição',       enabled: true,  daysOffset: 30, triggerLabel: '30 dias após inscrição' },
    { id: 'nc-09', type: 'NPS_SURVEY',           label: 'Inquérito NPS',                description: 'Questionário de satisfação enviado a cada 3 meses',            enabled: false, daysOffset: 90, triggerLabel: 'A cada 3 meses' },
    { id: 'nc-10', type: 'PACK_LOW',             label: 'Pack quase a acabar',          description: 'Alerta quando resta 1 sessão no pack do aluno',                enabled: true,  triggerLabel: 'Quando restar 1 sessão' },
    { id: 'nc-11', type: 'PLAN_EXPIRING',        label: 'Plano de treino a expirar',    description: 'Aviso 5 dias antes do plano de treino expirar',                enabled: true,  daysOffset: 5,  triggerLabel: '5 dias antes da validade' },
    { id: 'nc-12', type: 'EVAL_AFTER',           label: 'Questionário pós-avaliação',   description: 'Enquête de satisfação enviada no dia seguinte à avaliação',    enabled: false, triggerLabel: '1 dia após a avaliação' },
  ]

  return { users, plans, pts, alunos, ptReleases, bookings, modalidades, workoutPlans, avaliacoes, packs, leads, notificationConfigs }
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

// Count confirmed bookings for a studio slot (across ALL PTs)
export function getStudioSlotCount(date: string, slotTime: string): number {
  const key = `${date}-${slotTime}`
  return db.bookings.filter(b => b.slotKey === key && b.status === 'CONFIRMED').length
}

// Count confirmed bookings for a specific PT in a studio slot
export function getPTSlotCount(ptId: string, date: string, slotTime: string): number {
  const key = `${date}-${slotTime}`
  return db.bookings.filter(b => b.slotKey === key && b.personalTrainerId === ptId && b.status === 'CONFIRMED').length
}

export function syncSlotCounts(): void {
  // no-op: counts now computed on-the-fly from bookings
}

export function getPlanById(id?: string) {
  return db.plans.find(p => p.id === id)
}

export function getPTById(id: string) {
  return db.pts.find(p => p.id === id)
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
    const dayBookings = db.bookings.filter(b => b.status === 'CONFIRMED' && b.startTime.startsWith(dateStr))
    const occupied = dayBookings.length
    const times = getSlotTimesForDay(d)
    const totalSlots = times.length * STUDIO_MAX_SPOTS
    const available = Math.max(0, totalSlots - occupied)
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
