'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileText, Upload, Download, Trash2, ShieldCheck, BadgeCheck, File as FileIcon, Eye, X, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { ptDocumentApi, type PtDocument } from '@/lib/api'

const TYPES = [
  { value: 'SEGURO', label: 'Seguro', icon: ShieldCheck },
  { value: 'TEEF', label: 'TEEF (cédula)', icon: BadgeCheck },
  { value: 'OUTRO', label: 'Outro', icon: FileIcon },
] as const

function typeMeta(t: string) { return TYPES.find(x => x.value === t) ?? TYPES[2] }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Estado de validade → cor. Alimenta o "vence em Xd / vencido".
function validity(validUntil: string | null): { label: string; cls: string } {
  if (!validUntil) return { label: 'Sem validade', cls: 'text-gray-400' }
  const days = Math.ceil((new Date(validUntil).getTime() - Date.now()) / 864e5)
  const d = format(parseISO(validUntil), "d 'de' MMM yyyy", { locale: ptBR })
  if (days < 0) return { label: `Vencido (${d})`, cls: 'text-red-600 font-semibold' }
  if (days <= 30) return { label: `Vence em ${days}d (${d})`, cls: 'text-amber-600 font-semibold' }
  return { label: `Válido até ${d}`, cls: 'text-gray-400' }
}

const MAX_MB = 10
const ACCEPT = 'application/pdf,image/jpeg,image/png'

// Lista + upload de documentos de UM PT. O backend garante que o PT só acede
// aos seus; o admin pode passar o ptId de qualquer PT do estúdio.
export function PtDocuments({ ptId, canManage = true }: { ptId: string; canManage?: boolean }) {
  const qc = useQueryClient()
  const key = ['pt-documents', ptId]
  const { data: docs = [], isLoading } = useQuery<PtDocument[]>({ queryKey: key, queryFn: () => ptDocumentApi.list(ptId) })

  const [type, setType] = useState<string>('SEGURO')
  const [validUntil, setValidUntil] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: (file: File) => ptDocumentApi.upload(ptId, { type, file, validUntil: validUntil || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      setValidUntil('')
      if (fileRef.current) fileRef.current.value = ''
      toast.success('Documento enviado')
    },
    onError: (e: Error) => toast.error(e.message || 'Não foi possível enviar'),
  })

  const remove = useMutation({
    mutationFn: (docId: string) => ptDocumentApi.remove(ptId, docId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success('Documento removido') },
    onError: () => toast.error('Não foi possível remover'),
  })

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Máx. ${MAX_MB} MB`); e.target.value = ''; return }
    upload.mutate(file)
  }

  async function download(doc: PtDocument) {
    try {
      const blob = await ptDocumentApi.download(ptId, doc.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = doc.fileName; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Não foi possível abrir o documento') }
  }

  // ── Pré-visualização ────────────────────────────────────────────────────
  // O endpoint de download manda Content-Disposition: attachment, mas como
  // buscamos o ficheiro como blob e criamos a nossa própria object URL, dá
  // para mostrar inline (imagem ou PDF) sem obrigar a guardar no disco.
  const [preview, setPreview] = useState<{ doc: PtDocument; url: string; kind: 'image' | 'pdf' | 'other' } | null>(null)
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)

  function kindOf(contentType: string): 'image' | 'pdf' | 'other' {
    if (contentType.startsWith('image/')) return 'image'
    if (contentType === 'application/pdf') return 'pdf'
    return 'other'
  }

  async function openPreview(doc: PtDocument) {
    setPreviewLoading(doc.id)
    try {
      const blob = await ptDocumentApi.download(ptId, doc.id)
      // Força o content-type do documento — alguns storages devolvem
      // octet-stream, o que impediria o <img>/<iframe> de renderizar.
      const typed = blob.type && blob.type !== 'application/octet-stream'
        ? blob
        : new Blob([blob], { type: doc.contentType })
      setPreview({ doc, url: URL.createObjectURL(typed), kind: kindOf(doc.contentType) })
    } catch {
      toast.error('Não foi possível pré-visualizar o documento')
    } finally {
      setPreviewLoading(null)
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url) // evita fuga de memória
    setPreview(null)
  }

  // Escape fecha a pré-visualização; garante que a object URL é libertada
  // mesmo se o componente desmontar com o modal aberto.
  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePreview() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      URL.revokeObjectURL(preview.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview])

  const inp = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-800 outline-none focus:border-gray-400'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <FileText className="w-4 h-4 text-[#C9A84C]" />
        <h2 className="text-sm font-bold text-gray-900">Documentos</h2>
        <span className="text-[11px] text-gray-300 ml-auto">Seguro · TEEF · outros — PDF/JPG/PNG, máx. {MAX_MB} MB</span>
      </div>

      {canManage && (
        <div className="px-4 py-3 border-b border-gray-50 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-400">Tipo</span>
            <select value={type} onChange={e => setType(e.target.value)} className={inp}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-1 min-w-[190px]">
            <span className="text-[11px] text-gray-400">Validade (opcional)</span>
            <DatePicker value={validUntil} onChange={setValidUntil} placeholder="Sem validade" />
          </div>
          <input ref={fileRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={upload.isPending}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-3.5 text-[13px] font-semibold text-black hover:brightness-95 disabled:opacity-50 transition">
            <Upload className="w-4 h-4" /> {upload.isPending ? 'A enviar…' : 'Enviar documento'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : docs.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-gray-400">
          <FileText className="w-6 h-6 mx-auto mb-2 text-gray-300" />
          Nenhum documento {canManage ? 'ainda. Envia o seguro e a cédula (TEEF).' : 'enviado por este PT.'}
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {docs.map(doc => {
            const m = typeMeta(doc.type); const Icon = m.icon; const v = validity(doc.validUntil)
            return (
              <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-8 h-8 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#C9A84C]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{doc.fileName}</p>
                  <p className="text-[11px] text-gray-400">
                    <span className="font-medium text-gray-500">{m.label}</span> · {formatSize(doc.sizeBytes)} · <span className={v.cls}>{v.label}</span>
                  </p>
                </div>
                <button type="button" onClick={() => openPreview(doc)} aria-label={`Pré-visualizar ${doc.fileName}`}
                  disabled={previewLoading === doc.id}
                  className="p-2 rounded-md text-gray-400 hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition flex-shrink-0 disabled:opacity-50">
                  {previewLoading === doc.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Eye className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => download(doc)} aria-label="Baixar"
                  className="p-2 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition flex-shrink-0">
                  <Download className="w-4 h-4" />
                </button>
                {canManage && (
                  <button type="button" onClick={() => { if (confirm(`Remover "${doc.fileName}"?`)) remove.mutate(doc.id) }}
                    aria-label="Remover" className="p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* ── Modal de pré-visualização ──────────────────────────────────── */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label={`Pré-visualização de ${preview.doc.fileName}`}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="w-8 h-8 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
                {(() => { const Icon = typeMeta(preview.doc.type).icon; return <Icon className="w-4 h-4 text-[#C9A84C]" /> })()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{preview.doc.fileName}</p>
                <p className="text-[11px] text-gray-400">
                  <span className="font-medium text-gray-500">{typeMeta(preview.doc.type).label}</span>
                  {' · '}{formatSize(preview.doc.sizeBytes)}
                  {' · '}<span className={validity(preview.doc.validUntil).cls}>{validity(preview.doc.validUntil).label}</span>
                </p>
              </div>
              <button type="button" onClick={() => download(preview.doc)} aria-label="Baixar"
                className="p-2 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition flex-shrink-0">
                <Download className="w-4 h-4" />
              </button>
              <button type="button" onClick={closePreview} aria-label="Fechar"
                className="p-2 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-h-0 overflow-auto bg-gray-50 flex items-center justify-center">
              {preview.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.doc.fileName} className="max-w-full max-h-[70vh] object-contain" />
              ) : preview.kind === 'pdf' ? (
                <iframe src={preview.url} title={preview.doc.fileName} className="w-full h-[70vh] border-0 bg-white" />
              ) : (
                <div className="text-center py-16 px-6">
                  <FileIcon className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500 font-medium">Sem pré-visualização para este formato</p>
                  <button type="button" onClick={() => download(preview.doc)}
                    className="mt-3 h-9 inline-flex items-center gap-1.5 rounded-lg bg-[#C9A84C] px-3.5 text-[13px] font-semibold text-black hover:brightness-95 transition">
                    <Download className="w-4 h-4" /> Baixar ficheiro
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
