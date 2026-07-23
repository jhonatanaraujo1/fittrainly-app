import { notFound } from 'next/navigation'
import { LeadForm, type PublicLeadField } from './lead-form'

const GREEN = '#0C4A3A'
const GOLD = '#C9A227'

// O logo vem do backend (bucket privado, servido por endpoint público), por
// isso a URL relativa que a API devolve tem de ser prefixada com a origem dela.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

interface StudioInfo {
  name: string
  privacyPolicyUrl: string | null
  leadCaptureEnabled: boolean
  logoUrl: string | null
  headline: string | null
  subheadline: string | null
  fields: PublicLeadField[]
}

async function getStudio(slug: string): Promise<StudioInfo | null> {
  const base = API_BASE
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
            {/* Logo carregado pelo estúdio. Servido pelo backend (bucket
                privado) — por isso <img> cru, sem o loader do next/image. */}
            {/* Com logo, é a logo que identifica o estúdio (como qualquer marca
                faz) — o nome em texto é só o fallback de quem não carregou logo. */}
            {studio.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_BASE}${studio.logoUrl}`}
                alt={studio.name}
                style={{ maxHeight: 88, maxWidth: '78%', objectFit: 'contain', margin: '0 auto 16px', display: 'block' }}
              />
            ) : (
              <p style={{ color: GOLD, fontSize: 12, letterSpacing: '0.16em', fontWeight: 600, margin: '0 0 12px', textTransform: 'uppercase' }}>
                {studio.name}
              </p>
            )}
            <h1 style={{ color: '#fff', fontSize: 25, lineHeight: 1.15, fontWeight: 600, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              {studio.headline || 'Agenda a tua visita.'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>
              {studio.subheadline || 'Conhece o espaço e fala com um personal trainer, sem compromisso. Deixa o teu contacto que ligamos-te.'}
            </p>
          </div>

          {/* Form */}
          <div style={{ padding: '20px 22px 22px' }}>
            {studio.leadCaptureEnabled ? (
              <LeadForm slug={slug} studioName={studio.name} privacyPolicyUrl={studio.privacyPolicyUrl} fields={studio.fields ?? []} />
            ) : (
              <p style={{ textAlign: 'center', color: '#666', fontSize: 15, padding: '20px 0' }}>
                As marcações online estão temporariamente indisponíveis. Contacta o estúdio diretamente.
              </p>
            )}

            {/* A "prova social" que estava aqui era hardcoded com os factos de
                UM estúdio ("Máx. 4", "Almada, Margem Sul") — errados para
                qualquer outro. Removida: o estúdio diz o que quiser na
                mensagem, que agora é dele. */}
          </div>
        </div>


      </div>
    </main>
  )
}
