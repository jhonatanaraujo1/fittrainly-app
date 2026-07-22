'use client'

import { cn } from '@/lib/utils'

// Lista canónica das especialidades do estúdio. Um só sítio — antes estava
// duplicada no dialog de criar PT e ausente no de editar (que era texto livre,
// portanto cada PT escrevia à sua maneira e a etiqueta na grelha ficava
// inconsistente).
export const SPECIALTIES = [
  'Musculação e Força', 'Funcional e Mobilidade', 'Emagrecimento e Saúde',
  'Pilates', 'CrossFit', 'Cardio e Resistência', 'Nutrição e PT', 'Reabilitação',
] as const

// Um PT acumula especialidades (ex.: Musculação + Emagrecimento + Reabilitação)
// — o formulário só deixava escolher uma. Seleção múltipla, com o valor a sair
// como lista para o backend (ver V16__pt_specialties.sql).
export function SpecialtyPicker({
  value, onChange, max = 12, className,
}: {
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  className?: string
}) {
  const toggle = (s: string) =>
    onChange(value.includes(s) ? value.filter(v => v !== s) : [...value, s])

  // Especialidades que o PT já tem mas não estão na lista canónica (dados
  // antigos, escritos à mão). Mostradas na mesma para não desaparecerem
  // silenciosamente ao guardar.
  const extras = value.filter(v => !SPECIALTIES.includes(v as typeof SPECIALTIES[number]))
  const atLimit = value.length >= max

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {[...SPECIALTIES, ...extras].map(s => {
          const on = value.includes(s)
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              disabled={!on && atLimit}
              onClick={() => toggle(s)}
              className={cn(
                'px-3 py-2 min-h-[44px] rounded-xl border text-sm transition-colors',
                on
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
                !on && atLimit && 'opacity-40 cursor-not-allowed hover:border-gray-200',
              )}
            >
              {s}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] text-emerald-600 font-medium min-h-[16px]">
        {value.length === 0
          ? <span className="text-gray-400">Podes escolher mais do que uma.</span>
          : `✓ ${value.length} seleccionada${value.length !== 1 ? 's' : ''}: ${value.join(', ')}`}
      </p>
    </div>
  )
}
