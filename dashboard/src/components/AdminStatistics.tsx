import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils.ts'
import { useTranslation } from 'react-i18next'
import { Card, CardTitle } from '@/components/ui/card'
import { CountUp } from '@/components/ui/count-up'
import { type AdminDetails } from '@/service/api'
import { User, UserCheck, UserX } from 'lucide-react'
import React, { useEffect, useState } from 'react'

interface AdminsStatisticsProps {
  data: AdminDetails[]
}

export default function AdminStatisticsSection({ data }: AdminsStatisticsProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [prevStats, setPrevStats] = useState<{ total: number; active: number; disabled: number } | null>(null)
  const [isIncreased, setIsIncreased] = useState<Record<string, boolean>>({})

  const total = data.length
  const disabled = data.filter(a => a.is_disabled).length
  const active = total - disabled

  const currentStats = { total, active, disabled }

  useEffect(() => {
    if (prevStats) {
      setIsIncreased({
        total: currentStats.total > prevStats.total,
        active: currentStats.active > prevStats.active,
        disabled: currentStats.disabled > prevStats.disabled,
      })
    }
    setPrevStats(currentStats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const stats = [
    {
      icon: User,
      label: t('admins.total'),
      value: total,
      color: '',
      key: 'total',
    },
    {
      icon: UserCheck,
      label: t('admins.active'),
      value: active,
      color: '',
      key: 'active',
    },
    {
      icon: UserX,
      label: t('admins.disable'),
      value: disabled,
      color: '',
      key: 'disabled',
    },
  ]

  return (
    <div className={cn('flex flex-col items-center justify-between gap-x-4 gap-y-4 lg:flex-row', dir === 'rtl' && 'lg:flex-row-reverse')}>
      {stats.map((stat, idx) => (
        <Card
          key={stat.label}
          dir={dir}
          className={cn('group relative w-full animate-fade-in rounded-md transition-all duration-300 hover:shadow-lg')}
          style={{
            animationDuration: '600ms',
            animationDelay: `${(idx + 1) * 100}ms`,
            animationFillMode: 'both',
          }}
        >
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
              'dark:from-primary/5 dark:to-transparent',
              'group-hover:opacity-100',
            )}
          />
          <CardTitle className="relative z-10 flex items-center justify-between gap-x-4 p-5">
            <div className="flex items-center gap-x-4">
              {React.createElement(stat.icon, { className: 'h-6 w-6' })}
              <span>{stat.label}</span>
            </div>
            <span
              className={cn(
                'mx-2 text-3xl font-bold transition-all duration-500',
                isIncreased[stat.key] ? 'animate-zoom-out' : ''
              )}
              style={{ animationDuration: '400ms' }}
              dir="ltr"
            >
              <CountUp end={stat.value} />
            </span>
          </CardTitle>
        </Card>
      ))}
    </div>
  )
}
