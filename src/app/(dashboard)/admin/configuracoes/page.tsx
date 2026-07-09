'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// A tela Configurações standalone foi descontinuada — a única coisa que
// vivia aqui (cobrança por hora progressiva) passou para dentro de Planos de
// Aluguel. Mantido só como redirect para não quebrar bookmarks/links antigos.
export default function ConfiguracoesPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/plans') }, [router])
  return null
}
