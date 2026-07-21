'use client'

import { ShieldCheck, BadgeCheck, File as FileIcon } from 'lucide-react'
import { ptDocumentApi } from '@/lib/api'
import { DocumentsPanel, type DocumentsApi, type DocumentTypeMeta } from '@/components/documents-panel'

const TYPES: DocumentTypeMeta[] = [
  { value: 'SEGURO', label: 'Seguro', icon: ShieldCheck },
  { value: 'TEEF', label: 'TEEF (cédula)', icon: BadgeCheck },
  { value: 'OUTRO', label: 'Outro', icon: FileIcon },
]

// O estúdio só pode deixar treinar quem tem seguro e cédula válidos.
const REQUIRED = ['SEGURO', 'TEEF']

// Documentos de UM PT. O backend garante que o PT só acede aos seus; o admin
// pode passar o ptId de qualquer PT do estúdio.
export function PtDocuments({ ptId, canManage = true }: { ptId: string; canManage?: boolean }) {
  return (
    <DocumentsPanel
      ownerId={ptId}
      api={ptDocumentApi as unknown as DocumentsApi}
      types={TYPES}
      required={REQUIRED}
      queryKeyPrefix="pt-documents"
      canManage={canManage}
      headerHint="Seguro · TEEF · outros"
      okLabel="Seguro e TEEF em dia."
      emptyHint={canManage
        ? 'Nenhum documento ainda. Envia o seguro e a cédula (TEEF).'
        : 'Nenhum documento enviado por este PT.'}
    />
  )
}
