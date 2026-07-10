'use client'

import { useState } from 'react'
import { Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'

// Acessível a partir da sidebar por qualquer role — é o único caminho de
// self-service para trocar a password depois de já ter entrado (o
// "Esqueceu a password?" no login cobre o caso de não conseguir entrar).
export function ChangePasswordDialog({ userId, open, onOpenChange }: {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)

  function reset() {
    setCurrent(''); setNext(''); setConfirm('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 6) { toast.error('A nova senha precisa de pelo menos 6 caracteres'); return }
    if (next !== confirm) { toast.error('As senhas não coincidem'); return }
    setPending(true)
    try {
      await authApi.changePassword(userId, current, next)
      toast.success('Senha alterada com sucesso')
      reset()
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível alterar a senha')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Alterar senha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Senha atual</Label>
            <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="min-h-[44px] text-base" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Nova senha</Label>
            <Input type="password" value={next} onChange={e => setNext(e.target.value)} className="min-h-[44px] text-base" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Confirmar nova senha</Label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="min-h-[44px] text-base" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-[44px]" disabled={pending || !current || !next || !confirm}>
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Alterar senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
