import { NextResponse } from 'next/server'

// Rota server-side — a RESEND_API_KEY nunca pode ser lida no bundle do
// browser (NEXT_PUBLIC_*), então qualquer envio real de email passa por aqui.
// Sem a env var configurada, responde sent:false em vez de erro — quem chama
// (notify.ts) trata isso como "cai para o fallback de WhatsApp/copiar senha",
// nunca como falha da aplicação.
export async function POST(req: Request) {
  const { to, subject, html } = (await req.json()) as { to?: string; subject?: string; html?: string }

  if (!to || !subject || !html) {
    return NextResponse.json({ sent: false, reason: 'invalid_request' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ sent: false, reason: 'not_configured' })
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Fit Studio Now <onboarding@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json({ sent: false, reason: 'provider_error', detail }, { status: 200 })
    }
    return NextResponse.json({ sent: true })
  } catch (e) {
    return NextResponse.json({ sent: false, reason: 'network_error', detail: (e as Error).message })
  }
}
