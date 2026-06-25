import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/mock-db'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Body inválido. Envie um JSON válido.' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const { name, phone, email, interesse, source, message, observacoes } = body as Record<string, unknown>

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Campo "name" é obrigatório (mínimo 2 caracteres).' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Forneça pelo menos "phone" ou "email".' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const id = `lp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const now = new Date().toISOString()

    const lead = {
      id,
      name: (name as string).trim(),
      phone: phone ? String(phone).trim() : undefined,
      email: email ? String(email).trim().toLowerCase() : undefined,
      interesse: interesse ? String(interesse) : undefined,
      source: source ? String(source) : 'Landing Page',
      observacoes: observacoes
        ? String(observacoes)
        : message
        ? String(message)
        : undefined,
      responsavel: undefined,
      status: 'NOVO' as const,
      createdAt: now,
      updatedAt: now,
    }

    // In dev (persistent Node.js process), this lead appears in /admin/leads immediately.
    // On Vercel serverless, the module resets per request — real DB persistence comes with production backend.
    db.leads.unshift(lead)

    return NextResponse.json(
      {
        success: true,
        id,
        message: 'Lead registado com sucesso! A nossa equipa irá entrar em contacto em breve.',
      },
      { status: 201, headers: CORS_HEADERS }
    )
  } catch {
    return NextResponse.json(
      { error: 'Erro interno. Tente novamente em alguns instantes.' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
