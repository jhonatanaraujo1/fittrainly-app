'use client'

import { useQuery } from '@tanstack/react-query'
import { ptApi } from '@/lib/api'
import { PtDocuments } from '@/components/pt-documents'
import { Skeleton } from '@/components/ui/skeleton'

export default function PtDocumentosPage() {
  // O PT precisa do seu próprio ptId (≠ user id) para o endpoint de documentos.
  const { data: me, isLoading } = useQuery<{ id: string }>({
    queryKey: ['pt-me'],
    queryFn: ptApi.me as () => Promise<{ id: string }>,
  })

  return (
    <div className="p-5 lg:p-7 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">Meus Documentos</h1>
        <p className="text-sm text-gray-400 mt-0.5">Seguro, cédula (TEEF) e outros. Só tu e o estúdio veem.</p>
      </div>
      {isLoading || !me ? <Skeleton className="h-48 rounded-xl" /> : <PtDocuments ptId={me.id} />}
    </div>
  )
}
