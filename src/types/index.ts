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
  type: 'HOURLY' | 'WEEKLY' | 'MONTHLY' | 'TIERED_HOURLY'
  priceHourly?: number
  priceWeekly?: number
  priceMonthly?: number
  description?: string
}

export interface PlanHourTier {
  id: string
  planId: string
  tierOrder: number
  hoursFrom: number
  hoursTo: number | null
  pricePerHour: number
  bonus: number
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

// PT-released studio slot (availability-like shape returned by ptSlots/mySlots)
export interface Availability {
  id: string                  // = slotKey "YYYY-MM-DD-HH:MM"
  personalTrainerId: string
  personalTrainerName: string
  startTime: string
  endTime: string
  maxAlunos: number           // always STUDIO_MAX_SPOTS (4)
  confirmedCount: number      // total studio bookings in this slot
  availableSlots: number
  isBooked?: boolean          // has this aluno already booked?
  sessionDuration?: 30 | 60  // from aluno's active pack
  packRemaining?: number
}

// Studio grid cell (returned by studioGrid)
export interface StudioSlot {
  date: string
  slotTime: string
  startTime: string
  endTime: string
  released: boolean
  releaseId?: string
  studioCount: number
  myBookings: number
  studioMax: number
  alunoNames?: string[]
}

// PT release record
export interface PTRelease {
  id: string
  ptId: string
  ptName: string
  date: string      // "YYYY-MM-DD"
  slotTime: string  // "HH:MM"
}

// Admin schedule slot (all PTs per cell)
export interface AdminScheduleSlot {
  date: string
  slotTime: string
  startTime: string
  endTime: string
  studioCount: number
  studioMax: number
  releases: Array<{ releaseId: string; ptId: string; ptName: string; confirmedCount: number }>
  blocked: boolean
  blockReason?: string
  blockId?: string
}

export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface Booking {
  id: string
  slotKey: string             // "YYYY-MM-DD-HH:MM"
  availabilityId: string      // alias of slotKey for compat
  alunoId: string
  alunoName: string
  personalTrainerId: string
  personalTrainerName: string
  startTime: string
  endTime: string
  sessionDuration: 30 | 60
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
  studioCount?: number
  alunosBooked?: string[]
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

export interface PackSummary {
  total: number
  used: number
  remaining: number
  sessionDuration: 30 | 60
  expiresAt?: string
}

export interface AlunoDashboard {
  nextSession?: NextSession
  upcomingCount: number
  completedCount: number
  ptName: string
  ptBillingCycleDay?: number
  recentSessions: RecentSession[]
  pack?: PackSummary
  inscricaoDate?: string
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
  sessionDuration: 30 | 60
  expiresAt?: string
  status: 'ACTIVE' | 'EXPIRED' | 'DEPLETED'
  createdAt: string
}

export type LeadStatus =
  | 'NOVO'
  | 'CONTACTADO'
  | 'VISITA_AGENDADA'
  | 'VISITOU'
  | 'INSCRITO'
  | 'PERDIDO'
  | 'NAO_DEU_FEEDBACK'
  | 'ARQUIVADO'

export interface Lead {
  id: string
  name: string
  email?: string
  phone?: string
  status: LeadStatus
  interesse?: string
  source?: string
  responsavel?: string
  visitaDate?: string
  observacoes?: string
  tags?: string[]
  planoInteresse?: string
  followUpDate?: string
  inscritoEm?: string
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
