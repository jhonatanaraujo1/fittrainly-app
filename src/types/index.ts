export type UserRole = 'ADMIN' | 'PERSONAL_TRAINER' | 'ALUNO'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface Modalidade {
  id: string
  name: string
  categoria?: string
  descricao?: string
  cor: string
  active: boolean
  createdAt: string
}

export interface RentalPlan {
  id: string
  name: string
  type: 'HOURLY' | 'WEEKLY' | 'MONTHLY'
  priceHourly?: number
  priceWeekly?: number
  priceMonthly?: number
  description?: string
}

export interface PlanSummary {
  id: string
  name: string
  type: string
}

export interface PersonalTrainer {
  id: string
  userId: string
  name: string
  email: string
  phone?: string
  specialty?: string
  bio?: string
  active: boolean
  inadimplente: boolean
  plan?: PlanSummary
  alunoCount: number
  hoursThisMonth: number
}

export interface Aluno {
  id: string
  userId: string
  name: string
  email: string
  phone?: string
  personalTrainerId: string
  personalTrainerName: string
  nextSession?: string
  completedSessions?: number
  status: 'ATIVO' | 'INATIVO' | 'SUSPENSO'
  dataNascimento?: string
  inscricaoDate: string
  objetivo?: string
}

export interface Availability {
  id: string
  personalTrainerId: string
  personalTrainerName: string
  startTime: string
  endTime: string
  maxAlunos: number
  confirmedCount: number
  availableSlots: number
}

export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface Booking {
  id: string
  availabilityId: string
  alunoId: string
  alunoName: string
  personalTrainerId: string
  personalTrainerName: string
  startTime: string
  endTime: string
  status: BookingStatus
  createdAt: string
}

export interface BillingEntry {
  ptId: string
  ptName: string
  planName: string
  planType: string
  sessionsCount: number
  value: number
}

// Dashboard shapes (from Kotlin backend)
export interface AdminStats {
  activePTs: number
  totalAlunos: number
  sessionsThisWeek: number
  sessionsThisMonth: number
  estimatedRevenue: number
  hoursThisMonth: number
  hoursLastMonth: number
}

export interface OccupationByDay {
  day: string
  occupied: number
  available: number
}

export interface AdminDashboard {
  stats: AdminStats
  occupationByDay: OccupationByDay[]
}

export interface PTStats {
  totalAlunos: number
  sessionsThisWeek: number
  hoursThisMonth: number
  amountDue: number
}

export interface NextSession {
  availabilityId: string
  startTime: string
  endTime: string
  confirmedAlunos: number
  maxAlunos: number
}

export interface PTDashboard {
  stats: PTStats
  nextSessions: NextSession[]
}

export interface RecentSession {
  bookingId: string
  startTime: string
  endTime: string
  status: string
  ptName: string
}

export interface AlunoDashboard {
  nextSession?: NextSession
  upcomingCount: number
  completedCount: number
  ptName: string
  recentSessions: RecentSession[]
}

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  sets: number
  reps: string
  rest: string
  notes?: string
}

export interface WorkoutPlan {
  id: string
  alunoId: string
  alunoName: string
  ptId: string
  label: string
  focus: string
  exercises: Exercise[]
  validUntil?: string
  updatedAt: string
}

export type AlunoStatus = 'ATIVO' | 'INATIVO' | 'SUSPENSO'

export interface Avaliacao {
  id: string
  alunoId: string
  alunoName: string
  ptId: string
  tipo: 'PRIMEIRA' | 'REAVALIACAO'
  data: string
  frequenciaSemanal?: number
  peso?: number
  altura?: number
  imc?: number
  percentualGordura?: number
  massaMuscular?: number
  objetivo?: string
  observacoes?: string
  proximaAvaliacao?: string
  createdAt: string
}

export interface Pack {
  id: string
  alunoId: string
  alunoName: string
  total: number
  used: number
  expiresAt?: string
  status: 'ACTIVE' | 'EXPIRED' | 'DEPLETED'
  createdAt: string
}

export interface Lead {
  id: string
  name: string
  email?: string
  phone?: string
  status: 'NOVO' | 'CONTACTADO' | 'VISITA_AGENDADA' | 'VISITOU' | 'INSCRITO' | 'PERDIDO'
  interesse?: string
  source?: string
  responsavel?: string
  visitaDate?: string
  observacoes?: string
  createdAt: string
  updatedAt: string
}

export interface NotificationConfig {
  id: string
  type: string
  label: string
  description: string
  enabled: boolean
  daysOffset?: number
  triggerLabel: string
}
