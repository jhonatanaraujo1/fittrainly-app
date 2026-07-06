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

function toDate(d: Date | string): Date {
  if (typeof d === 'string') {
    const parsed = parseISO(d)
    return isValid(parsed) ? parsed : new Date(d)
  }
  return d
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
