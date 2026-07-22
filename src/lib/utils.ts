import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value ?? 0)
}

// Standard Portuguese VAT rate for services (taxa normal, Portugal
// continental). Values calculated by the billing engine (aluguel do PT ao
// estúdio) are net of IVA — this adds it on top for display only, never
// changes what's stored or billed internally.
export const IVA_RATE = 0.23

export function withIVA(value: number): { base: number; iva: number; total: number } {
  const base = value ?? 0
  const iva = base * IVA_RATE
  return { base, iva, total: base + iva }
}

// REGRA DE OURO DO TEMPO NESTE SISTEMA
// O backend trata hora-de-parede como UTC de ponta a ponta: guarda os slots
// como `${data}T${hora}:00Z` e valida horários de funcionamento com
// LocalDateTime.ofInstant(..., ZoneOffset.UTC). Não há conversão de fuso em
// lado nenhum do domínio — "09:00" significa 09:00 no relógio do estúdio.
//
// Logo, renderizar com o fuso do browser está ERRADO: em Portugal no verão
// (WEST, UTC+1) o aluno via TODOS os horários +1h em relação ao que o PT
// libertou — 07:30 aparecia como 08:30, e surgiam linhas de horário que o PT
// nunca abriu. A grelha do PT já lia por fatia da string ISO e por isso estava
// certa; era a agenda do aluno que divergia.
//
// toDate desloca o instante pelo offset local para que os componentes LOCAIS
// da Date passem a valer exatamente os componentes UTC — assim o date-fns
// (que formata sempre em local) imprime a hora-de-parede do estúdio,
// independentemente de onde o browser está.
function toDate(d: Date | string): Date {
  const raw = typeof d === 'string'
    ? (isValid(parseISO(d)) ? parseISO(d) : new Date(d))
    : d
  if (!isValid(raw)) return raw
  return new Date(raw.getTime() + raw.getTimezoneOffset() * 60_000)
}

export function formatDate(d: Date | string): string {
  return format(toDate(d), "d 'de' MMM yyyy", { locale: ptBR })
}

export function formatDateShort(d: Date | string): string {
  return format(toDate(d), 'd MMM', { locale: ptBR })
}

export function formatTime(d: Date | string): string {
  return format(toDate(d), 'HH:mm')
}

// Chaves de grelha (data / hora) na hora-de-parede do estúdio. Fatiam a string
// ISO tal como a grelha do PT faz — nunca `new Date(...)` seguido de format(),
// que reinterpreta no fuso do browser. Ver a nota em toDate.
export function slotDateKey(iso: string): string {
  return iso.slice(0, 10)
}
export function slotTimeKey(iso: string): string {
  return iso.slice(11, 16)
}

export function formatWeekday(d: Date | string): string {
  return format(toDate(d), "EEEE, d 'de' MMM", { locale: ptBR })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

export function avatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-amber-500',
  ]
  const idx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[idx % colors.length]
}

export function planTypeLabel(type: string): string {
  return ({ HOURLY: 'Por Hora', WEEKLY: 'Semanal', MONTHLY: 'Mensal', TIERED_HOURLY: 'Por Hora (Faixas)' } as Record<string, string>)[type] ?? type
}

export function planTypeBadge(type: string): string {
  return ({
    HOURLY: 'bg-green-100 text-green-700 border-green-200',
    WEEKLY: 'bg-orange-100 text-orange-700 border-orange-200',
    MONTHLY: 'bg-blue-100 text-blue-700 border-blue-200',
    TIERED_HOURLY: 'bg-violet-100 text-violet-700 border-violet-200',
  } as Record<string, string>)[type] ?? 'bg-gray-100 text-gray-600'
}

export function bookingStatusLabel(status: string): string {
  return ({ CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada', COMPLETED: 'Realizada' } as Record<string, string>)[status] ?? status
}

export function bookingStatusColor(status: string): string {
  return ({
    CONFIRMED: 'bg-blue-100 text-blue-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
  } as Record<string, string>)[status] ?? 'bg-gray-100 text-gray-500'
}

// Shared status for any "validade" field (TEEF, seguro, etc.) — one place
// deciding what counts as "perto do fim", so the PT list, PT profile, and
// the admin dashboard alert never disagree about it.
const DOC_WARNING_DAYS = 30

export interface DocStatus {
  status: 'ok' | 'warning' | 'expired'
  daysLeft: number
}

export function docStatus(validUntil: string | undefined, warningDays = DOC_WARNING_DAYS): DocStatus | null {
  if (!validUntil) return null
  const daysLeft = Math.ceil((new Date(validUntil + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { status: 'expired', daysLeft }
  if (daysLeft <= warningDays) return { status: 'warning', daysLeft }
  return { status: 'ok', daysLeft }
}
