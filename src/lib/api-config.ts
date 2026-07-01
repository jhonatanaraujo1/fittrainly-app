// Interruptor mock/real por domínio. TUDO por defeito é 'mock' — quem está
// a usar/ver a aplicação hoje nunca é afetado. Ligar o backend real é uma
// decisão explícita por deployment (env var), nunca automática.
//
// Para ligar um domínio ao backend real numa Vercel preview/produção,
// definir a env var correspondente como "true" e apontar NEXT_PUBLIC_API_URL
// para o backend Railway. Sem essas envs, o comportamento é idêntico ao atual.
//
// IMPORTANT: process.env.NEXT_PUBLIC_* tem de ser acedido de forma literal
// (nunca via process.env[nomeDinamico]) para o Next.js conseguir substituir
// o valor em build-time no bundle do browser.

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export const USE_REAL = {
  auth: process.env.NEXT_PUBLIC_REAL_AUTH === 'true',
  plans: process.env.NEXT_PUBLIC_REAL_PLANS === 'true',
  modalidades: process.env.NEXT_PUBLIC_REAL_MODALIDADES === 'true',
  personalTrainers: process.env.NEXT_PUBLIC_REAL_PERSONAL_TRAINERS === 'true',
  billing: process.env.NEXT_PUBLIC_REAL_BILLING === 'true',
  // Backend já cobre estes domínios (auditoria de 01/jul), mas continuam
  // desligados por defeito — produção não tem backend plugado ainda.
  // Ligar exige NEXT_PUBLIC_API_URL apontado + a env var correspondente
  // "true" NUM DEPLOYMENT SEPARADO, nunca na produção atual.
  leads: process.env.NEXT_PUBLIC_REAL_LEADS === 'true',
  packs: process.env.NEXT_PUBLIC_REAL_PACKS === 'true',
  avaliacoes: process.env.NEXT_PUBLIC_REAL_AVALIACOES === 'true',
} as const

// Domínios que o backend ainda não implementa (ver auditoria):
// workout plans, notificações reais (disparo de email), disponibilidade/
// agendamento (grid de slots), dashboards combinados. Continuam SEMPRE em
// mock até existir contrato real — não têm flag porque não há para onde
// apontar ainda.
