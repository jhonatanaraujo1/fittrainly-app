'use client'

import { useRef, useState } from 'react'

// Cores da marca do estúdio (verde + dourado do logo do MG). A página é DELES,
// então segue a identidade deles, não a do painel fitTrainly.
const GREEN = '#0C4A3A'
const GOLD = '#C9A227'

interface Props {
  slug: string
  studioName: string
  privacyPolicyUrl: string | null
}

export function LeadForm({ slug, studioName, privacyPolicyUrl }: Props) {
  const mountedAt = useRef(Date.now())
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    if (!data.get('consent')) {
      setStatus('error'); setErrorMsg('Precisas de aceitar o contacto para continuar.')
      return
    }
    const email = String(data.get('email') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()
    if (!email && !phone) {
      setStatus('error'); setErrorMsg('Deixa um telemóvel ou email para te contactarmos.')
      return
    }

    setStatus('loading'); setErrorMsg('')
    try {
      const res = await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          firstName: String(data.get('firstName') ?? '').trim(),
          email,
          phone,
          consent: true,
          website: String(data.get('website') ?? ''), // honeypot
          elapsedMs: Date.now() - mountedAt.current,
        }),
      })
      if (res.ok) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMsg('Não foi possível enviar agora. Tenta novamente daqui a pouco.')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Sem ligação. Verifica a internet e tenta de novo.')
    }
  }

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: GREEN, margin: '0 0 8px' }}>Pedido recebido!</h2>
        <p style={{ fontSize: 15, color: '#555', lineHeight: 1.5, margin: 0 }}>
          A equipa do {studioName} entra em contacto em breve para marcar a tua visita. Até já! 💪
        </p>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, borderRadius: 10, border: '1px solid #d8d8d2',
    padding: '0 14px', fontSize: 16, color: '#1a1a1a', outline: 'none', background: '#fff',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#444', margin: '0 0 6px' }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Honeypot — escondido de humanos, preenchido por bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Não preencher<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label htmlFor="firstName" style={labelStyle}>Nome</label>
        <input id="firstName" name="firstName" required maxLength={100} placeholder="Como te chamas?" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label htmlFor="phone" style={labelStyle}>Telemóvel</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" maxLength={30} placeholder="9XX XXX XXX" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="email" style={labelStyle}>Email <span style={{ color: '#999', fontWeight: 400 }}>(opcional)</span></label>
        <input id="email" name="email" type="email" maxLength={200} placeholder="o.teu@email.pt" style={inputStyle} />
      </div>

      <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, color: '#555', lineHeight: 1.45, marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" name="consent" required style={{ width: 17, height: 17, marginTop: 1, flex: 'none', accentColor: GREEN }} />
        <span>
          Autorizo o {studioName} a contactar-me sobre a minha visita e aceito a{' '}
          {privacyPolicyUrl
            ? <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer" style={{ color: GREEN, textDecoration: 'underline' }}>Política de Privacidade</a>
            : <span style={{ textDecoration: 'underline' }}>Política de Privacidade</span>}
          . (RGPD)
        </span>
      </label>

      {status === 'error' && (
        <p role="alert" style={{ fontSize: 13, color: '#b3261e', margin: '0 0 12px' }}>{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          width: '100%', height: 52, borderRadius: 10, border: 'none', cursor: status === 'loading' ? 'default' : 'pointer',
          background: GOLD, color: '#3a2f06', fontWeight: 600, fontSize: 16, opacity: status === 'loading' ? 0.7 : 1,
        }}
      >
        {status === 'loading' ? 'A enviar…' : 'Quero agendar a minha visita'}
      </button>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#999', margin: '10px 0 0' }}>
        Sem compromisso · Resposta em 24h
      </p>
    </form>
  )
}
