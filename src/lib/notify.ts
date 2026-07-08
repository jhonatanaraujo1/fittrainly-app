'use client'

// Envio de credenciais (senha inicial / reset) — tenta email real primeiro
// (rota server-side /api/send-email, que só funciona se RESEND_API_KEY
// estiver configurada no deployment), e diz ao chamador se conseguiu, para a
// UI cair no fallback de WhatsApp/copiar senha sem nunca travar o fluxo.

export function generateTempPassword(): string {
  // Sem caracteres ambíguos (0/O, 1/l/I) — vai ser lida/digitada por um humano.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function sendCredentialsEmail(opts: {
  to: string
  name: string
  password: string
  isReset?: boolean
}): Promise<{ sent: boolean }> {
  const subject = opts.isReset
    ? 'A tua nova password — fitTrainly'
    : 'Acesso à tua conta fitTrainly'
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Olá, ${opts.name}</h2>
      <p>${opts.isReset ? 'A tua password foi alterada pelo administrador do estúdio.' : 'A tua conta na plataforma fitTrainly foi criada.'}</p>
      <p><strong>Email:</strong> ${opts.to}<br/><strong>Password:</strong> ${opts.password}</p>
      <p>Recomendamos alterar esta password assim que entrares, em Definições → Alterar password.</p>
    </div>
  `
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: opts.to, subject, html }),
    })
    const data = await res.json()
    return { sent: !!data.sent }
  } catch {
    return { sent: false }
  }
}

export function whatsappCredentialsUrl(phone: string | undefined, name: string, email: string, password: string, isReset?: boolean): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return null
  const msg = isReset
    ? `Olá ${name}! A tua nova password de acesso ao fitTrainly é: ${password}\nEmail de login: ${email}`
    : `Olá ${name}! O teu acesso ao fitTrainly foi criado.\nEmail: ${email}\nPassword: ${password}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}
