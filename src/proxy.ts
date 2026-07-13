import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  PERSONAL_TRAINER: '/pt',
  ALUNO: '/aluno',
  // O backend emite o papel do aluno como STUDENT; o resto do frontend usa
  // ALUNO. Aceitar ambos aqui evita que um cookie STUDENT caia no fallback e
  // faça /login → /login em loop (ERR_TOO_MANY_REDIRECTS).
  STUDENT: '/aluno',
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const role = request.cookies.get('fittrainly-role')?.value
  const refresh = request.cookies.get('fittrainly-refresh')?.value

  // Public routes. `/l/` é a captura pública de leads do estúdio (/l/{slug}) —
  // aberta a visitantes sem sessão, tal como o login.
  if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/api') || pathname.startsWith('/l/')) {
    if (refresh && role && pathname === '/login') {
      const home = ROLE_HOME[role]
      // Só redireciona se o papel for conhecido. Papel desconhecido/legado NÃO
      // pode redirecionar para /login (loop infinito) — deixa a página de login
      // carregar para o utilizador reautenticar.
      if (home) return NextResponse.redirect(new URL(home, request.url))
    }
    return NextResponse.next()
  }

  // Protected — no session
  if (!refresh || !role) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Wrong role trying to access another role's area
  const home = ROLE_HOME[role]
  if (home && !pathname.startsWith(home)) {
    return NextResponse.redirect(new URL(home, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
