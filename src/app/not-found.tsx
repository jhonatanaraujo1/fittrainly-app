'use client'

import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export default function NotFound() {
  const { user } = useAuthStore()
  const home = user?.role === 'ADMIN' ? '/admin' : user?.role === 'PERSONAL_TRAINER' ? '/pt' : user ? '/aluno' : '/login'

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#F8F9FA] px-6 text-center">
      <div className="w-12 h-12 bg-[#111111] rounded-xl flex items-center justify-center mb-5">
        <Dumbbell className="w-6 h-6 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">404</h1>
      <p className="text-gray-500 text-sm mb-6">Esta página não existe</p>
      <Link
        href={home}
        className="bg-[#111111] hover:bg-gray-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
