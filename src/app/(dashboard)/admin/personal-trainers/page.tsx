'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plus, Users, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ptApi, planApi } from '@/lib/api'
import { getInitials, avatarColor, planTypeLabel, planTypeBadge } from '@/lib/utils'
import type { PersonalTrainer, RentalPlan } from '@/types'

export default function PersonalTrainersPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', specialty: '', bio: '', planId: '' })

  const { data: pts = [], isLoading } = useQuery<PersonalTrainer[]>({
    queryKey: ['admin-pts'],
    queryFn: ptApi.list,
  })

  const { data: plans = [] } = useQuery<RentalPlan[]>({
    queryKey: ['plans'],
    queryFn: planApi.list,
  })

  const createPT = useMutation({
    mutationFn: ptApi.create,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin-pts'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success(`${created.name ?? 'PT'} adicionado com sucesso! 🎉`)
      setOpen(false)
      setForm({ name: '', email: '', password: '', phone: '', specialty: '', bio: '', planId: '' })
    },
    onError: () => toast.error('Erro ao criar Personal Trainer. Verifica os dados e tente novamente.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('Nome, email e password são obrigatórios')
      return
    }
    createPT.mutate({ ...form, planId: form.planId || undefined })
  }

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Personal Trainers</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestão dos PTs do estúdio</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            className="inline-flex items-center gap-2 h-9 px-4 bg-[#1F3864] hover:bg-[#162c52] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar PT
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Personal Trainer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Nome completo *</Label>
                  <Input placeholder="João Silva" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" placeholder="joao@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Password *</Label>
                  <Input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input placeholder="+351 912 000 000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Especialidade</Label>
                  <Input placeholder="Musculação e Força" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Plano de Aluguel</Label>
                  <Select value={form.planId} onValueChange={v => setForm(f => ({ ...f, planId: v ?? '' }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {planTypeLabel(p.type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Bio / Apresentação</Label>
                  <Input placeholder="Especialista em..." value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-9 text-sm">Cancelar</Button>
                <Button type="submit" disabled={createPT.isPending} className="bg-[#1F3864] hover:bg-[#162c52] text-white h-9 text-sm">
                  {createPT.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar PT'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : pts.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Ainda sem PTs cadastrados</p>
          <p className="text-sm text-gray-400">Adiciona o primeiro PT para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pts.map((pt, i) => (
            <motion.div
              key={pt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full ${avatarColor(pt.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                  {getInitials(pt.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{pt.name}</p>
                  <p className="text-xs text-gray-400 truncate">{pt.email}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0 ${pt.active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                  {pt.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              {pt.specialty && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{pt.specialty}</p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-50">
                <span>{pt.alunoCount} aluno{pt.alunoCount !== 1 ? 's' : ''}</span>
                {pt.plan && (
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] ${planTypeBadge(pt.plan.type)}`}>
                    {planTypeLabel(pt.plan.type)}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
