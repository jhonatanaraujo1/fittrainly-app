'use client'

import { Loader2, CalendarCheck } from 'lucide-react'
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

// Confirmação antes de marcar — espelha o CancelBookingDialog (mesma altura de
// fricção para marcar e desmarcar, pedido do dono). Marcar debita 1 sessão do
// pack do aluno, então vale confirmar antes.
export function ConfirmBookingDialog({ open, onOpenChange, startTime, endTime, ptName, isPending, onConfirm }: Props) {
  const when = `${formatDate(startTime)} · ${formatTime(startTime)} – ${formatTime(endTime)}${ptName ? ` com ${ptName}` : ''}`
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-500" />
            Confirmar agendamento?
          </DialogTitle>
          <DialogDescription>{when}.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Voltar
          </Button>
          <Button onClick={onConfirm} disabled={isPending} className="text-white" style={{ background: '#111111' }}>
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sim, agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
