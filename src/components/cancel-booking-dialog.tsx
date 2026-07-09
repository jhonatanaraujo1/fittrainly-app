'use client'

import { Loader2, AlertTriangle, Clock, Phone } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDate, formatTime } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime: string
  endTime: string
  ptName?: string
  isPending: boolean
  onConfirm: () => void
}

// Cancellation windows (business rule, dono do estúdio):
//  > 24h  → o aluno cancela sozinho, sem fricção
//  12–24h → tarde demais para self-service; precisa falar com o estúdio,
//           que decide (e cancela pela agenda do admin) se ainda dá
//  < 12h  → em cima da hora, não dá para cancelar online
type Band = 'free' | 'contact' | 'locked'
function bandFor(startTime: string): Band {
  const hours = (new Date(startTime).getTime() - Date.now()) / (1000 * 60 * 60)
  if (hours >= 24) return 'free'
  if (hours >= 12) return 'contact'
  return 'locked'
}

export function CancelBookingDialog({ open, onOpenChange, startTime, endTime, ptName, isPending, onConfirm }: Props) {
  const band = bandFor(startTime)
  const when = `${formatDate(startTime)} · ${formatTime(startTime)} – ${formatTime(endTime)}${ptName ? ` com ${ptName}` : ''}`

  // Free window — self-service cancel, unchanged behaviour.
  if (band === 'free') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar esta sessão?</DialogTitle>
            <DialogDescription>{when}. Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sim, cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // 12–24h — cannot self-cancel; must contact the studio.
  if (band === 'contact') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Faltam menos de 24 horas
            </DialogTitle>
            <DialogDescription>{when}.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-3 text-sm text-amber-800 flex items-start gap-2.5">
            <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Já não é possível cancelar sozinho nesta janela. <strong>Contacta o estúdio diretamente</strong> para
              ver se ainda dá para cancelar esta sessão — a equipa resolve por ti.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // < 12h — locked.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Já não dá para cancelar
          </DialogTitle>
          <DialogDescription>{when}.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3.5 py-3 text-sm text-gray-600">
          Faltam menos de 12 horas para a sessão, por isso o cancelamento online está fechado. Se tiveres um
          imprevisto, fala com o estúdio — mas o horário pode já não ser reaproveitável.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
