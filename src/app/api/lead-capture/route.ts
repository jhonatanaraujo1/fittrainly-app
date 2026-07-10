import { NextResponse } from 'next/server'

// Route handler server-side da captura de leads. O browser NUNCA fala com o
// backend público direto — fala com esta rota, que guarda a
// LEAD_CAPTURE_SERVER_KEY (nunca exposta no bundle) e a encaminha no header.
//
// Defesa em profundidade antes de gastar uma chamada ao backend:
//  - honeypot: campo `website` só é preenchido por bot;
//  - time-trap: submissão em < 3s desde o load da página é bot;
//  - o backend ainda revalida tudo (chave, consentimento, rate limit, dedupe).
//
// Resposta sempre genérica: { ok: true } mesmo em duplicado/honeypot, para não
// dar sinal a quem sonda. Só erros de validação de campo devolvem 400.

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
const MIN_FILL_MS = 3000

interface Body {
  slug?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  message?: string
  consent?: boolean
  website?: string // honeypot
  elapsedMs?: number // tempo desde o load
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_request' }, { status: 400 })
  }

  const slug = body.slug?.trim()
  const firstName = body.firstName?.trim()
  if (!slug || !firstName) {
    return NextResponse.json({ ok: false, reason: 'missing_fields' }, { status: 400 })
  }
  if (!body.consent) {
    return NextResponse.json({ ok: false, reason: 'consent_required' }, { status: 400 })
  }
  if (!body.email?.trim() && !body.phone?.trim()) {
    return NextResponse.json({ ok: false, reason: 'contact_required' }, { status: 400 })
  }

  // Bot? Responde sucesso genérico e descarta — não ensina o bot que caiu.
  const isBot = !!body.website?.trim() || (typeof body.elapsedMs === 'number' && body.elapsedMs < MIN_FILL_MS)
  if (isBot) {
    return NextResponse.json({ ok: true })
  }

  const key = process.env.LEAD_CAPTURE_SERVER_KEY
  if (!key) {
    // Fail-closed também deste lado: sem chave, não finge que enviou.
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 })
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/public/leads/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lead-Capture-Key': key,
      },
      body: JSON.stringify({
        firstName,
        lastName: body.lastName?.trim() || null,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        message: body.message?.trim() || null,
        consent: true,
      }),
    })

    // 204 = criado. 404 = estúdio inexistente/captura desligada. Em ambos os
    // casos devolvemos sucesso genérico ao browser (não revelar o estado do
    // tenant); só um erro real de servidor vira falha visível.
    if (res.status === 204 || res.status === 404 || res.status === 200) {
      return NextResponse.json({ ok: true })
    }
    if (res.status === 400) {
      return NextResponse.json({ ok: false, reason: 'invalid_request' }, { status: 400 })
    }
    return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 502 })
  } catch {
    return NextResponse.json({ ok: false, reason: 'network_error' }, { status: 502 })
  }
}
