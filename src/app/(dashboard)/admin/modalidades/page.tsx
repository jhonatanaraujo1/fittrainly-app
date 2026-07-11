'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Layers, Loader2, Pencil, Trash2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CustomSelect } from '@/components/ui/custom-select'
import { ColorPicker } from '@/components/ui/color-picker'
import { modalidadeApi } from '@/lib/api'
import type { Modalidade } from '@/types'

const CATEGORIAS = ['Fitness', 'Artes Marciais', 'Dança', 'Bem-estar', 'Cardio', 'Outro']
const CATEGORIA_OPTIONS = [
  { value: '', label: 'Selecionar categoria' },
  ...CATEGORIAS.map(c => ({ value: c, label: c })),
]

type FormState = { name: string; categoria: string; descricao: string; cor: string }
const EMPTY_FORM: FormState = { name: '', categoria: '', descricao: '', cor: '#111111' }

export default function ModalidadesPage() {
  const qc = useQueryClient()
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Modalidade | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data: modalidades = [], isLoading } = useQuery<Modalidade[]>({
    queryKey: ['modalidades'],
    queryFn: modalidadeApi.list,
  })

  const create = useMutation({
    mutationFn: modalidadeApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modalidades'] })
      toast.success('Modalidade criada! 🎉')
      setOpenCreate(false)
      setForm(EMPTY_FORM)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao criar modalidade')
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => modalidadeApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modalidades'] })
      toast.success('Modalidade atualizada')
      setEditing(null)
      setForm(EMPTY_FORM)
    },
    onError: () => toast.error('Erro ao atualizar modalidade'),
  })

  const remove = useMutation({
    mutationFn: modalidadeApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modalidades'] })
      toast.success('Modalidade removida')
      setConfirmDelete(null)
    },
    onError: () => toast.error('Erro ao remover modalidade'),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      modalidadeApi.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modalidades'] }),
    onError: () => toast.error('Erro ao atualizar status'),
  })

  function openEdit(m: Modalidade) {
    setForm({ name: m.name, categoria: m.categoria ?? '', descricao: m.descricao ?? '', cor: m.cor })
    setEditing(m)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    const payload = {
      name: form.name.trim(),
      categoria: form.categoria || undefined,
      descricao: form.descricao || undefined,
      cor: form.cor,
    }
    if (editing) update.mutate({ id: editing.id, data: payload })
    else create.mutate(payload)
  }

  // Group by categoria
  const grouped = modalidades.reduce<Record<string, Modalidade[]>>((acc, m) => {
    const cat = m.categoria ?? 'Outro'
    ;(acc[cat] ??= []).push(m)
    return acc
  }, {})
  const categorias = Object.keys(grouped).sort()

  const activeCount = modalidades.filter(m => m.active).length

  const isPending = create.isPending || update.isPending

  return (
    <div className="p-5 lg:p-7 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Modalidades</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeCount} ativa{activeCount !== 1 ? 's' : ''} · {modalidades.length} total
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditing(null); setOpenCreate(true) }}
          className="inline-flex items-center gap-2 h-9 px-4 text-white text-sm font-medium rounded-lg transition-colors"
          style={{ background: '#111111' }}>
          <Plus className="w-4 h-4" /> Nova Modalidade
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : modalidades.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl led-gold">
          <Layers className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma modalidade cadastrada</p>
          <p className="text-sm text-gray-400 mt-0.5">Adiciona as atividades que o estúdio oferece</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categorias.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">{cat}</p>
              <div className="bg-white rounded-xl led-gold overflow-hidden">
                {grouped[cat].map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    {/* Color dot */}
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: m.cor }} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${m.active ? 'text-gray-900' : 'text-gray-400'}`}>
                          {m.name}
                        </p>
                        {!m.active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">
                            Inativa
                          </span>
                        )}
                      </div>
                      {m.descricao && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{m.descricao}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleActive.mutate({ id: m.id, active: !m.active })}
                        className={`h-7 px-2.5 text-[11px] font-medium rounded border transition-colors ${
                          m.active
                            ? 'text-gray-400 border-gray-200 hover:bg-gray-50'
                            : 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                        }`}>
                        {m.active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => openEdit(m)}
                        className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 transition-colors text-gray-400 hover:text-gray-700">
                        <Pencil className="w-3 h-3" />
                      </button>
                      {confirmDelete === m.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => remove.mutate(m.id)}
                            className="w-7 h-7 flex items-center justify-center rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-500 transition-colors">
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(m.id)}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors text-gray-300 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={openCreate || !!editing} onOpenChange={open => {
        if (!open) { setOpenCreate(false); setEditing(null); setForm(EMPTY_FORM) }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Modalidade' : 'Nova Modalidade'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input
                placeholder="Ex: Muay Thai"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <CustomSelect
                value={form.categoria}
                onChange={v => setForm(f => ({ ...f, categoria: v }))}
                options={CATEGORIA_OPTIONS}
                placeholder="Selecionar categoria"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input
                placeholder="Breve descrição da modalidade"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Cor de identificação</Label>
              <ColorPicker
                value={form.cor}
                onChange={c => setForm(f => ({ ...f, cor: c }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button"
                onClick={() => { setOpenCreate(false); setEditing(null); setForm(EMPTY_FORM) }}
                className="h-9 px-4 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isPending}
                className="h-9 px-4 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
                style={{ background: '#111111' }}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
