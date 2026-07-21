'use client'

import { FileSignature } from 'lucide-react'
import { studentDocumentApi } from '@/lib/api'
import { DocumentsPanel, type DocumentsApi, type DocumentTypeMeta } from '@/components/documents-panel'

// Por agora o aluno só tem um documento: o contrato de anamnese assinado.
// Com um único tipo, o painel esconde o seletor de tipo automaticamente.
const TYPES: DocumentTypeMeta[] = [
  { value: 'CONTRATO_ANAMNESE', label: 'Contrato de anamnese', icon: FileSignature },
]

const REQUIRED = ['CONTRATO_ANAMNESE']

// Documentos de UM aluno. O backend garante o acesso: o aluno só vê os seus,
// o PT só os dos seus alunos, o admin os de todo o estúdio.
export function StudentDocuments({ studentId, canManage = true }: { studentId: string; canManage?: boolean }) {
  return (
    <DocumentsPanel
      ownerId={studentId}
      api={studentDocumentApi as unknown as DocumentsApi}
      types={TYPES}
      required={REQUIRED}
      queryKeyPrefix="student-documents"
      canManage={canManage}
      headerHint="Contrato de anamnese"
      okLabel="Contrato de anamnese entregue."
      emptyHint={canManage
        ? 'Sem contrato de anamnese. Envia o contrato assinado (PDF ou foto).'
        : 'Contrato de anamnese ainda não entregue.'}
    />
  )
}
