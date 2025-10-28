import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAllGoals } from '@/hooks/use-goal'
import { Target, TrendingUp, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useEffect, useState, useRef } from 'react'
import { useSidebar } from '@/components/ui/sidebar'

export function GoalProgress() {
  const { data: goalsData, isLoading, isError } = useAllGoals()
  const { t } = useTranslation()
  const { state, isMobile } = useSidebar()
  const [currentGoalIndex, setCurrentGoalIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Gesture refs
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const endX = useRef<number | null>(null)
  const endY = useRef<number | null>(null)
  const minSwipeDistance = 50

  const pendingGoals = goalsData?.next_pending || []

  useEffect(() => {
    if (pendingGoals.length <= 1) return

    const interval = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentGoalIndex((prev) => (prev + 1) % pendingGoals.length)
        setIsAnimating(false)
      }, 150)
    }, 8000)

    return () => clearInterval(interval)
  }, [pendingGoals.length])

  const navigateToGoal = (direction: 'next' | 'prev') => {
    if (pendingGoals.length <= 1) return

    setIsAnimating(true)
    setTimeout(() => {
      setCurrentGoalIndex((prev) => {
        if (direction === 'next') {
          return (prev + 1) % pendingGoals.length
        } else {
          return (prev - 1 + pendingGoals.length) % pendingGoals.length
        }
      })
      setIsAnimating(false)
    }, 150)
  }

  const handleStart = (clientX: number, clientY: number) => {
    startX.current = clientX
    startY.current = clientY
    endX.current = null
    endY.current = null
  }

  const handleMove = (clientX: number, clientY: number) => {
    endX.current = clientX
    endY.current = clientY
  }

  const handleEnd = () => {
    if (!startX.current || !endX.current || !startY.current || !endY.current) return

    const distanceX = startX.current - endX.current
    const distanceY = startY.current - endY.current
    const isLeftSwipe = distanceX > minSwipeDistance
    const isRightSwipe = distanceX < -minSwipeDistance
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX)

    // Only handle horizontal swipes/drags
    if (isVerticalSwipe) return

    if (isLeftSwipe) {
      navigateToGoal('next')
    } else if (isRightSwipe) {
      navigateToGoal('prev')
    }

    // Reset positions
    startX.current = null
    startY.current = null
    endX.current = null
    endY.current = null
  }

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY)
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (startX.current !== null) {
      handleMove(e.clientX, e.clientY)
    }
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
    )
  }

  if (isError || !goalsData || pendingGoals.length === 0) {
    return null
  }

  const currentGoal = pendingGoals[currentGoalIndex]
  const progress = Math.min((currentGoal.paid_amount / currentGoal.price) * 100, 100)
  const remaining = Math.max(currentGoal.price - currentGoal.paid_amount, 0)

  // Collapsed state (desktop only) - simple donate button with popover
  // On mobile, always use expanded UI since there's no collapsed sidebar concept
  if (state === 'collapsed' && !isMobile) {
    return (
      <div className="mx-2 mb-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
            >
              <Heart className="h-4 w-4 text-primary" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" side="right" align="start">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{currentGoal.name}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-primary">${currentGoal.paid_amount.toLocaleString()}</span>
                  <span className="text-muted-foreground">
                    {t('goal.of')} ${currentGoal.price.toLocaleString()}
                  </span>
                </div>
              </div>

              {remaining > 0 && (
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('goal.remaining')}</span>
                    <span className="font-semibold">${remaining.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <Button asChild className="w-full">
                <a
                  href="https://donate.pasarguard.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <Target className="h-4 w-4" />
                  {t('goal.contribute')}
                </a>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  // Expanded state - full card
  return (
    <Card
      className="mx-2 mb-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 cursor-grab active:cursor-grabbing select-none user-select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Handle mouse leaving the element
    >
      <CardContent className="p-3">
        {/* Goal Content */}
        <div
          className={cn(
            'space-y-2.5 transition-all duration-300 ease-in-out',
            isAnimating ? 'opacity-0 transform translate-y-2' : 'opacity-100 transform translate-y-0'
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('goal.currentGoal')} ({currentGoalIndex + 1}/{pendingGoals.length})
                </span>
                <span className="line-clamp-1 text-sm font-semibold leading-tight">{currentGoal.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <TrendingUp className="h-3 w-3" />
              {progress.toFixed(0)}%
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-primary">${currentGoal.paid_amount.toLocaleString()}</span>
              <span className="text-muted-foreground">
                {t('goal.of')} ${currentGoal.price.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Details */}
          {currentGoal.detail && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{currentGoal.detail}</p>}

          {/* Remaining */}
          {remaining > 0 && (
            <div className="flex items-center justify-between rounded-md bg-background/50 px-2 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t('goal.remaining')}</span>
              <span className="text-xs font-semibold text-foreground">${remaining.toLocaleString()}</span>
            </div>
          )}

          {/* CTA Button */}
          <a
            href="https://donate.pasarguard.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md"
          >
            <Target className="h-3.5 w-3.5" />
            {t('goal.contribute')}
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
