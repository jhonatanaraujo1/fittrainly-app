'use client'

import { Printer } from 'lucide-react'

interface ReportLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  backHref?: string
}

export function ReportLayout({ title, subtitle, children }: ReportLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors"
          style={{ background: '#111111' }}
        >
          <Printer className="w-4 h-4" />
          Guardar como PDF
        </button>
      </div>

      {/* A4 page */}
      <div
        className="mx-auto my-8 print:my-0 bg-white shadow-lg print:shadow-none"
        style={{ width: '210mm', minHeight: '297mm', padding: '18mm 20mm' }}
      >
        {children}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 20mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}

export function ReportHeader({ estudio = 'MG Estúdio Boutique', data }: { estudio?: string; data?: string }) {
  return (
    <div className="flex items-start justify-between pb-5 border-b-2 border-gray-900 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: '#111111' }}>
            <span className="text-white text-[9px] font-black">FT</span>
          </div>
          <span className="font-black text-lg tracking-tight text-gray-900">Fit Studio Now</span>
        </div>
        <p className="text-xs text-gray-400">{estudio}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-400">Gerado em</p>
        <p className="text-sm font-semibold text-gray-700">
          {data ?? new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        <p className="text-xs text-gray-400">
          {new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-px flex-1 bg-gray-200" />
        <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] whitespace-nowrap px-2">{title}</h2>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      {children}
    </div>
  )
}

export function ReportRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-800 font-medium flex-1">{value}</span>
    </div>
  )
}

export function ReportFooter() {
  return (
    <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between">
      <p className="text-[10px] text-gray-400">Fit Studio Now — Software de Gestão de Estúdios de Personal Training</p>
      <p className="text-[10px] text-gray-400">Documento gerado automaticamente · Não requer assinatura manual</p>
    </div>
  )
}
