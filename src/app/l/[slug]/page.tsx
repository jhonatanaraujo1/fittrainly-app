import { notFound } from 'next/navigation'
import { LeadForm } from './lead-form'

const GREEN = '#0C4A3A'
const GOLD = '#C9A227'

interface StudioInfo {
  name: string
  privacyPolicyUrl: string | null
  leadCaptureEnabled: boolean
}

async function getStudio(slug: string): Promise<StudioInfo | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
  try {
    const res = await fetch(`${base}/api/v1/public/studios/${encodeURIComponent(slug)}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as StudioInfo
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const studio = await getStudio(slug)
  const name = studio?.name ?? 'Estúdio'
  return {
    title: `Agendar visita · ${name}`,
    description: `Marca a tua visita ao ${name}. Treino personalizado, sem compromisso.`,
    robots: { index: false }, // página de captura, não deve indexar
  }
}

export default async function LeadCapturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const studio = await getStudio(slug)
  if (!studio) notFound()

  return (
    <main style={{ minHeight: '100vh', background: '#f4f4f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px 48px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          {/* Hero — oferta, não "bem-vindo" */}
          <div style={{ background: GREEN, padding: '26px 22px 22px', textAlign: 'center' }}>
            <p style={{ color: GOLD, fontSize: 12, letterSpacing: '0.16em', fontWeight: 600, margin: '0 0 12px', textTransform: 'uppercase' }}>
              {studio.name}
            </p>
            <h1 style={{ color: '#fff', fontSize: 25, lineHeight: 1.15, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              Agenda a tua visita.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              Conhece o espaço e fala com um personal trainer, sem compromisso. Deixa o teu contacto que ligamos-te.
            </p>
          </div>

          {/* Form */}
          <div style={{ padding: '20px 22px 22px' }}>
            {studio.leadCaptureEnabled ? (
              <LeadForm slug={slug} studioName={studio.name} privacyPolicyUrl={studio.privacyPolicyUrl} />
            ) : (
              <p style={{ textAlign: 'center', color: '#666', fontSize: 15, padding: '20px 0' }}>
                As marcações online estão temporariamente indisponíveis. Contacta o estúdio diretamente.
              </p>
            )}

            {/* Prova social — factos REAIS da landing do estúdio, nada inventado */}
            <div style={{ borderTop: '1px solid #eee', marginTop: 18, paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
              {[
                { b: 'Máx. 4', s: 'por horário' },
                { b: '1-a-1', s: 'o teu PT' },
                { b: 'Almada', s: 'Margem Sul' },
              ].map(({ b, s }) => (
                <div key={s}>
                  <div style={{ fontSize: 15, color: GREEN, fontWeight: 600 }}>{b}</div>
                  <div style={{ fontSize: 10.5, color: '#999' }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', margin: '16px 0 0' }}>
          Não é um ginásio — é um espaço de treino com critério.
        </p>
      </div>
    </main>
  )
}
