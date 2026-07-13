'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Calendar, AlertTriangle, Gift, BarChart2,
  Star, RefreshCw, ShoppingBag, Clock, MessageSquare,
  ClipboardCheck, Zap, TrendingUp, Inbox,
} from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { notificationApi, notificationInboxApi } from '@/lib/api'
import type { MockNotificationConfig } from '@/lib/mock-db'

// ── Sino do estúdio: caixa de entrada in-app (novos leads, PT liberou horário) ──
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

function StudioInboxFeed() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['notif-inbox'], queryFn: notificationInboxApi.inbox })
  const items = data?.items ?? []

  // Ao abrir o sino: marca tudo como lido e zera o badge da sidebar.
  useEffect(() => {
    let cancelled = false
    notificationInboxApi.markAllRead()
      .then(() => { if (!cancelled) qc.invalidateQueries({ queryKey: ['notif-unread'] }) })
      .catch(() => { /* best-effort — não bloqueia a leitura do feed */ })
    return () => { cancelled = true }
  }, [qc])

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <Inbox className="w-4 h-4 text-[#C9A84C]" />
        <h2 className="text-sm font-bold text-gray-900">Caixa de entrada</h2>
      </div>
      {isLoading ? (
        <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-gray-400">
          <Inbox className="w-6 h-6 mx-auto mb-2 text-gray-300" />
          Nenhuma notificação por agora.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((n) => {
            const Icon = n.type === 'NEW_LEAD' ? TrendingUp : Calendar
            const inner = (
              <div className={cn('flex items-start gap-3 px-4 py-3 transition-colors', !n.read ? 'bg-[#C9A84C]/[0.07]' : 'hover:bg-gray-50')}>
                <span className="mt-0.5 w-7 h-7 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#C9A84C]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{n.title}</p>
                  {n.body && <p className="text-xs text-gray-400 mt-0.5 truncate">{n.body}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-gray-300 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                  {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#C9A84C' }} />}
                </div>
              </div>
            )
            return (
              <li key={n.id}>
                {n.link ? <Link href={n.link} className="block">{inner}</Link> : inner}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICONS: Record<string, React.ElementType> = {
  'nc-01': Calendar,
  'nc-02': Bell,
  'nc-03': ClipboardCheck,
  'nc-04': AlertTriangle,
  'nc-05': Clock,
  'nc-06': AlertTriangle,
  'nc-07': Gift,
  'nc-08': Star,
  'nc-09': BarChart2,
  'nc-10': ShoppingBag,
  'nc-11': RefreshCw,
  'nc-12': MessageSquare,
}

// Agrupamento por `type` (estável entre mock e backend real) — antes era por
// `id` fixo do mock ('nc-01'…), mas o backend gera UUIDs aleatórios, então as
// secções ficavam vazias em produção.
const SECTION_1_TYPES = ['BOOKING_CONFIRMATION', 'BOOKING_REMINDER', 'FIRST_EVAL_CONFIRM', 'FIRST_EVAL_REMINDER', 'PLAN_EXPIRING', 'EVAL_AFTER']
const SECTION_2_TYPES = ['ABSENCE_7_DAYS', 'ABSENCE_15_DAYS', 'BIRTHDAY', 'MOTIVATIONAL_30', 'NPS_SURVEY', 'PACK_LOW']

// ── Single notification card ──────────────────────────────────────────────────
function NotificationCard({
  config,
  onToggle,
  isPending,
}: {
  config: MockNotificationConfig
  onToggle: (id: string, enabled: boolean) => void
  isPending: boolean
}) {
  const Icon = ICONS[config.id] ?? Zap

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={[
        'relative bg-white rounded-xl p-5 flex flex-col gap-3 transition-opacity duration-300',
        config.enabled ? 'led-gold' : 'led-gold opacity-60',
      ].join(' ')}
    >
      {/* Toggle — top right */}
      <div className="absolute top-4 right-4">
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked: boolean) => onToggle(config.id, checked)}
          disabled={isPending}
          aria-label={`Toggle ${config.label}`}
        />
      </div>

      {/* Icon + Label */}
      <div className="flex items-start gap-3 pr-12">
        <div
          className={[
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300',
            config.enabled
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-400',
          ].join(' ')}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{config.label}</p>
          <p className="text-xs text-gray-400 mt-1 leading-snug">{config.description}</p>
        </div>
      </div>

      {/* Trigger badge */}
      <div className="pt-1 border-t border-gray-50">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
          <Zap className="w-3 h-3 text-gray-400" />
          {config.triggerLabel}
        </span>
      </div>
    </motion.div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({
  title,
  items,
  onToggle,
  pendingId,
}: {
  title: string
  items: MockNotificationConfig[]
  onToggle: (id: string, enabled: boolean) => void
  pendingId: string | null
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((cfg) => (
          <NotificationCard
            key={cfg.id}
            config={cfg}
            onToggle={onToggle}
            isPending={pendingId === cfg.id}
          />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NotificacoesPage() {
  const qc = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { data: configs = [], isLoading } = useQuery<MockNotificationConfig[]>({
    queryKey: ['notification-configs'],
    queryFn: notificationApi.list,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      notificationApi.toggle(id, enabled),
    onMutate: ({ id }) => setPendingId(id),
    onSuccess: (updated) => {
      qc.setQueryData<MockNotificationConfig[]>(['notification-configs'], (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)) ?? prev
      )
      toast.success(updated.enabled ? 'Notificação activada' : 'Notificação desactivada')
    },
    onError: () => toast.error('Erro ao actualizar notificação'),
    onSettled: () => setPendingId(null),
  })

  const bulkToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      for (const cfg of configs) {
        await notificationApi.toggle(cfg.id, enabled)
      }
      return enabled
    },
    onSuccess: (enabled) => {
      qc.invalidateQueries({ queryKey: ['notification-configs'] })
      toast.success(enabled ? 'Todas as notificações activadas' : 'Todas as notificações desactivadas')
    },
    onError: () => toast.error('Erro ao actualizar notificações'),
  })

  function handleToggle(id: string, enabled: boolean) {
    toggleMutation.mutate({ id, enabled })
  }

  const activeCount = configs.filter((c) => c.enabled).length
  const totalCount = configs.length
  const allActive = activeCount === totalCount && totalCount > 0
  const isBulkPending = bulkToggleMutation.isPending

  const section1 = configs.filter((c) => SECTION_1_TYPES.includes(c.type))
  const section2 = configs.filter((c) => SECTION_2_TYPES.includes(c.type))

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-6xl mx-auto">

      {/* Caixa de entrada in-app (o sino) */}
      <StudioInboxFeed />

      {/* Automation banner */}
      <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl px-4 py-3 flex items-start gap-3">
        <Zap className="w-4 h-4 text-[#C9A84C] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[#7D6229]">Motor de automação configurado</p>
          <p className="text-xs text-[#7D6229]/80 mt-0.5 leading-relaxed">
            As notificações activadas são enviadas automaticamente pelo sistema com base em eventos do estúdio —
            reservas, avaliações, aniversários e alertas de retenção. Configure aqui o que é disparado.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Notificações</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Configure as mensagens automáticas enviadas aos alunos e PTs
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Counter */}
          {!isLoading && (
            <span className="text-sm font-medium text-gray-500">
              <span className="text-gray-900 font-bold">{activeCount}</span>
              {' '}de{' '}
              <span className="text-gray-900 font-bold">{totalCount}</span>
              {' '}activas
            </span>
          )}

          {/* Bulk toggle */}
          <button
            onClick={() => bulkToggleMutation.mutate(!allActive)}
            disabled={isBulkPending || isLoading}
            className={[
              'h-9 px-4 text-sm font-medium rounded-lg transition-all flex items-center gap-2',
              allActive
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'text-white hover:opacity-90',
              isBulkPending ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
            style={!allActive ? { background: '#111111' } : undefined}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={allActive ? 'off' : 'on'}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                {isBulkPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                {allActive ? 'Desactivar todas' : 'Activar todas'}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-5 w-48 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
          <Skeleton className="h-5 w-48 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            title="Agendamento & Treino"
            items={section1}
            onToggle={handleToggle}
            pendingId={pendingId}
          />
          <Section
            title="Retenção & Comercial"
            items={section2}
            onToggle={handleToggle}
            pendingId={pendingId}
          />
        </div>
      )}
    </div>
  )
}
