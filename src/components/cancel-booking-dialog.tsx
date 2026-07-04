'use client'

import { Loader2 } from 'lucide-react'
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

export function CancelBookingDialog({ open, onOpenChange, startTime, endTime, ptName, isPending, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar esta sessão?</DialogTitle>
          <DialogDescription>
            {formatDate(startTime)} · {formatTime(startTime)} – {formatTime(endTime)}
            {ptName ? ` com ${ptName}` : ''}. Esta ação não pode ser desfeita.
          </DialogDescription>
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
