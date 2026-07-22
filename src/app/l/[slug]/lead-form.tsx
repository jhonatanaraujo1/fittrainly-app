'use client'

import { useRef, useState } from 'react'

// Cores da marca do estúdio (verde + dourado do logo do MG). A página é DELES,
// então segue a identidade deles, não a do painel Fit Studio Now.
const GREEN = '#0C4A3A'
const GOLD = '#C9A227'

export type LeadFieldType = 'TEXT' | 'TEXTAREA' | 'RADIO' | 'CHECKBOX' | 'SELECT'
export interface PublicLeadField {
  id: string
  label: string
  type: LeadFieldType
  required: boolean
  options: string[]
  placeholder?: string | null
}

interface Props {
  slug: string
  studioName: string
  privacyPolicyUrl: string | null
  // Campos configurados pelo estúdio. Nome/telemóvel/email continuam fixos.
  fields?: PublicLeadField[]
}

export function LeadForm({ slug, studioName, privacyPolicyUrl, fields = [] }: Props) {
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
    // Escolha múltipla obrigatória: o HTML não sabe exprimir "pelo menos uma",
    // por isso valida-se aqui para o erro aparecer sem ida ao servidor.
    const semResposta = fields.find(
      f => f.required && f.type === 'CHECKBOX' && data.getAll(`custom_${f.id}`).length === 0
    )
    if (semResposta) {
      setStatus('error'); setErrorMsg(`Escolhe pelo menos uma opção em “${semResposta.label}”.`)
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
          // Respostas aos campos do estúdio, por id. getAll porque a escolha
          // múltipla envia vários valores com o mesmo nome.
          answers: Object.fromEntries(
            fields
              .map(f => [f.id, data.getAll(`custom_${f.id}`).map(v => String(v).trim()).filter(Boolean)] as const)
              .filter(([, vals]) => vals.length > 0)
          ),
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

      {/* Campos configurados pelo estúdio. `required` aqui é conveniência para
          quem preenche — a validação a sério é no servidor, que não confia
          neste HTML (ver LeadFormService.validateAnswers). */}
      {fields.map(f => {
        const nome = `custom_${f.id}`
        return (
          <div key={f.id} style={{ marginBottom: 16 }}>
            <label htmlFor={nome} style={labelStyle}>
              {f.label}
              {!f.required && <span style={{ color: '#999', fontWeight: 400 }}> (opcional)</span>}
            </label>

            {f.type === 'TEXT' && (
              <input id={nome} name={nome} required={f.required} maxLength={200}
                placeholder={f.placeholder ?? ''} style={inputStyle} />
            )}

            {f.type === 'TEXTAREA' && (
              <textarea id={nome} name={nome} required={f.required} maxLength={1000} rows={3}
                placeholder={f.placeholder ?? ''} style={{ ...inputStyle, resize: 'vertical', paddingTop: 10, paddingBottom: 10 }} />
            )}

            {f.type === 'SELECT' && (
              <select id={nome} name={nome} required={f.required} defaultValue="" style={inputStyle}>
                <option value="" disabled>Escolhe uma opção</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}

            {(f.type === 'RADIO' || f.type === 'CHECKBOX') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {f.options.map(o => (
                  <label key={o} style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    // 44px de alvo de toque — o formulário é maioritariamente mobile.
                    minHeight: 44, fontSize: 14, color: '#333',
                  }}>
                    <input
                      type={f.type === 'RADIO' ? 'radio' : 'checkbox'}
                      name={nome} value={o}
                      // Rádio: só o primeiro leva `required` — o browser trata
                      // o grupo como um só.
                      // Checkbox: NENHUM leva. Em HTML, `required` numa
                      // checkbox exige QUELA checkbox, não "pelo menos uma" —
                      // marcá-las todas obrigaria a ticar tudo. O "pelo menos
                      // uma" é validado no onSubmit e, a sério, no servidor.
                      required={f.required && f.type === 'RADIO' && o === f.options[0]}
                      style={{ width: 18, height: 18, flex: 'none', accentColor: GREEN }}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}

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
