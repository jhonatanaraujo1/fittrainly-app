import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  PERSONAL_TRAINER: '/pt',
  ALUNO: '/aluno',
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const role = request.cookies.get('fittrainly-role')?.value
  const refresh = request.cookies.get('fittrainly-refresh')?.value

  // Public routes. `/l/` é a captura pública de leads do estúdio (/l/{slug}) —
  // aberta a visitantes sem sessão, tal como o login.
  if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/api') || pathname.startsWith('/l/')) {
    if (refresh && role && pathname === '/login') {
      return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url))
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
