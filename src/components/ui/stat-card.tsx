'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string }
  delay?: number
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor = '#C9A84C', trend, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className="bg-white rounded-lg p-5 border border-gray-100 flex flex-col gap-3"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">{title}</p>
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${iconColor}18` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: iconColor }} />
        </div>
      </div>
      <div>
        <p className="text-[1.75rem] font-black text-gray-900 leading-none tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {trend && (
        <div className={cn('text-[11px] font-semibold flex items-center gap-1')}>
          {trend.value >= 0 ? (
            <span style={{ color: '#C9A84C' }}>↑ {Math.abs(trend.value)}%</span>
          ) : (
            <span className="text-red-500">↓ {Math.abs(trend.value)}%</span>
          )}
          <span className="text-gray-400 font-normal">{trend.label}</span>
        </div>
      )}
    </motion.div>
  )
}
