'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserCog, Save, Receipt } from 'lucide-react'
import { ptApi } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'

type PtMe = {
  id: string; name?: string; email?: string; phone?: string; specialty?: string; bio?: string
  taxId?: string; address?: string
}

function Field({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[44px] px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
      />
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

export default function PTPerfilPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<PtMe>({
    queryKey: ['pt-me'],
    queryFn: () => ptApi.me() as Promise<PtMe>,
  })

  const [form, setForm] = useState<PtMe>({ id: '' })
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (data && !loaded) {
      setForm({
        id: data.id,
        name: data.name ?? '', email: data.email ?? '', phone: data.phone ?? '',
        specialty: data.specialty ?? '', bio: data.bio ?? '',
        taxId: data.taxId ?? '', address: data.address ?? '',
      })
      setLoaded(true)
    }
  }, [data, loaded])

  const set = (k: keyof PtMe) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: () => ptApi.updateOwnProfile({
      name: form.name, email: form.email, phone: form.phone,
      specialty: form.specialty, bio: form.bio,
      taxId: form.taxId, address: form.address,
    }),
    onSuccess: () => {
      toast.success('Perfil atualizado ✅')
      qc.invalidateQueries({ queryKey: ['pt-me'] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Erro ao atualizar o perfil'),
  })

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
        {[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#111111] flex items-center justify-center flex-shrink-0">
          <UserCog className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Meu Perfil</h1>
          <p className="text-sm text-gray-400 mt-0.5">Edita os teus dados de contacto e fiscais</p>
        </div>
      </div>

      {/* Contacto */}
      <section className="bg-white rounded-xl led-gold p-5 space-y-4">
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">Dados de contacto</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome completo" value={form.name ?? ''} onChange={set('name')} placeholder="O teu nome" />
          <Field label="Email (login)" value={form.email ?? ''} onChange={set('email')} placeholder="voce@email.com" type="email" hint="É o teu acesso à plataforma." />
          <Field label="Telefone" value={form.phone ?? ''} onChange={set('phone')} placeholder="+351 …" />
          <Field label="Especialidade" value={form.specialty ?? ''} onChange={set('specialty')} placeholder="Musculação, funcional…" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-700">Bio</label>
          <textarea
            value={form.bio ?? ''}
            onChange={e => set('bio')(e.target.value)}
            rows={3}
            placeholder="Uma linha sobre ti para os teus alunos."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 resize-none"
          />
        </div>
      </section>

      {/* Fiscal */}
      <section className="bg-white rounded-xl led-gold p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-500" />
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em]">Dados fiscais (para faturação)</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="NIF" value={form.taxId ?? ''} onChange={set('taxId')} placeholder="Número de contribuinte" />
          <Field label="Morada" value={form.address ?? ''} onChange={set('address')} placeholder="Morada fiscal" />
        </div>
      </section>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-[#111111] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Save className="w-4 h-4" />
        {save.isPending ? 'A guardar…' : 'Guardar alterações'}
      </button>
    </div>
  )
}
