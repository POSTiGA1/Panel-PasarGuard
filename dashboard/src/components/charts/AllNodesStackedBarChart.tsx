import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { DateRange } from 'react-day-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { useTranslation } from 'react-i18next'
import useDirDetection from '@/hooks/use-dir-detection'
import { getUsage, Period, type NodeUsageStat } from '@/service/api'
import { formatBytes } from '@/utils/formatByte'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeRangeSelector } from '@/components/common/TimeRangeSelector'
import { EmptyState } from './EmptyState'
import { TrendingUp, Upload, Download, Calendar, Info } from 'lucide-react'
import { dateUtils } from '@/utils/dateFormatter'
import { TooltipProps } from 'recharts'
import { useGetNodes, NodeResponse } from '@/service/api'
import { useTheme } from '@/components/theme-provider'
import TimeSelector from './TimeSelector'
import NodeStatsModal from '@/components/dialogs/NodeStatsModal'

// Helper function to determine period (copied from CostumeBarChart)
const getPeriodFromDateRange = (range?: DateRange): Period => {
  if (!range?.from || !range?.to) {
    return Period.hour // Default to hour if no range
  }
  const diffTime = Math.abs(range.to.getTime() - range.from.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays <= 2) {
    return Period.hour
  }
  return Period.day
}

function CustomTooltip({ active, payload, chartConfig, dir, period }: TooltipProps<any, any> & { chartConfig?: ChartConfig; dir: string; period?: string }) {
  const { t, i18n } = useTranslation()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  const d = dateUtils.toDayjs(data._period_start)

  // Check if this is today's data
  const today = dateUtils.toDayjs(new Date())
  const isToday = d.isSame(today, 'day')

  let formattedDate
  if (i18n.language === 'fa') {
    // Use Persian (Jalali) calendar and Persian locale
    try {
      // If you have dayjs with jalali plugin, use it:
      // formattedDate = d.locale('fa').format('YYYY/MM/DD HH:mm')
      // Otherwise, fallback to toLocaleString
      if (period === 'day' && isToday) {
        formattedDate = new Date()
          .toLocaleString('fa-IR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          .replace(',', '')
      } else if (period === 'day') {
        const localDate = new Date(d.year(), d.month(), d.date(), 0, 0, 0)
        formattedDate = localDate
          .toLocaleString('fa-IR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          .replace(',', '')
      } else {
        // hourly or other: use actual time from data
        formattedDate = d
          .toDate()
          .toLocaleString('fa-IR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
          .replace(',', '')
      }
    } catch {
      formattedDate = d.format('YYYY/MM/DD HH:mm')
    }
  } else {
    if (period === 'day' && isToday) {
      const now = new Date()
      formattedDate = now
        .toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .replace(',', '')
    } else if (period === 'day') {
      const localDate = new Date(d.year(), d.month(), d.date(), 0, 0, 0)
      formattedDate = localDate
        .toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .replace(',', '')
    } else {
      // hourly or other: use actual time from data
      formattedDate = d
        .toDate()
        .toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .replace(',', '')
    }
  }

  // Get node color from chart config
  const getNodeColor = (nodeName: string) => {
    return chartConfig?.[nodeName]?.color || 'hsl(var(--chart-1))'
  }

  const isRTL = dir === 'rtl'

  // Get active nodes with usage > 0, sorted by usage descending
  const activeNodes = Object.keys(data)
    .filter(key => !key.startsWith('_') && key !== 'time' && key !== '_period_start' && (data[key] || 0) > 0)
    .map(nodeName => ({
      name: nodeName,
      usage: data[nodeName] || 0,
      uplink: data[`_uplink_${nodeName}`] || 0,
      downlink: data[`_downlink_${nodeName}`] || 0
    }))
    .sort((a, b) => b.usage - a.usage)

  // Determine how many nodes to show based on screen size
  const maxNodesToShow = isMobile ? 3 : 6
  const nodesToShow = activeNodes.slice(0, maxNodesToShow)
  const hasMoreNodes = activeNodes.length > maxNodesToShow

  return (
    <div className={`min-w-[120px] max-w-[280px] sm:min-w-[140px] sm:max-w-[300px] rounded border border-border bg-background p-1.5 sm:p-2 text-[10px] sm:text-xs shadow ${isRTL ? 'text-right' : 'text-left'} ${isMobile ? 'max-h-[200px] overflow-y-auto' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={`mb-1 text-[10px] sm:text-xs font-semibold opacity-70 text-center`}>
        <span dir="ltr" className="inline-block truncate">
          {formattedDate}
        </span>
      </div>
      <div className={`mb-1.5 text-[10px] flex items-center justify-center gap-1.5 sm:text-xs text-muted-foreground text-center`}>
        <span>{t('statistics.totalUsage', { defaultValue: 'Total' })}: </span>
        <span dir="ltr" className="inline-block font-mono truncate">
          {nodesToShow
            .reduce((sum, node) => sum + node.usage, 0)
            .toFixed(2)}
          GB
        </span>
      </div>
      <div className={`grid gap-1 sm:gap-1.5 ${nodesToShow.length > (isMobile ? 2 : 3) ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {nodesToShow.map(node => (
          <div key={node.name} className={`flex flex-col gap-0.5 ${isRTL ? 'items-end' : 'items-start'}`}>
            <span className={`flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: getNodeColor(node.name) }} />
              <span className="truncate max-w-[60px] sm:max-w-[80px] overflow-hidden text-ellipsis" title={node.name}>{node.name}</span>
            </span>
            <span className={`flex items-center gap-0.5 text-[9px] sm:text-[10px] text-muted-foreground ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <Upload className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
              <span dir="ltr" className="inline-block font-mono truncate max-w-[40px] sm:max-w-[50px] overflow-hidden text-ellipsis" title={String(formatBytes(node.uplink))}>
                {formatBytes(node.uplink)}
              </span>
              <span className={`opacity-60 ${isRTL ? 'mx-0.5' : 'mx-0.5'} text-[8px] sm:text-[10px]`}>|</span>
              <Download className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
              <span dir="ltr" className="inline-block font-mono truncate max-w-[40px] sm:max-w-[50px] overflow-hidden text-ellipsis" title={String(formatBytes(node.downlink))}>
                {formatBytes(node.downlink)}
              </span>
            </span>
          </div>
        ))}
        {hasMoreNodes && (
          <div className={`flex items-center justify-center gap-0.5 text-[9px] sm:text-[10px] text-muted-foreground mt-1 w-full col-span-full`}>
            <Info className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
            <span className="text-center">{t('statistics.clickForMore', { defaultValue: 'Click for more details' })}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function AllNodesStackedBarChart() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string>('1w')
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [chartData, setChartData] = useState<any[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [totalUsage, setTotalUsage] = useState('0')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedData, setSelectedData] = useState<any>(null)
  const [currentDataIndex, setCurrentDataIndex] = useState(0)
  const [chartKey, setChartKey] = useState(0)

  const chartContainerRef = useRef<HTMLDivElement>(null)

  const { t } = useTranslation()
  const dir = useDirDetection()
  const { data: nodesData } = useGetNodes(undefined, { query: { enabled: true } })
  const { resolvedTheme } = useTheme()

  // Improved resize handling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(timeoutId)
      // Debounce to avoid excessive re-renders
      timeoutId = setTimeout(() => {
        setChartKey(prev => prev + 1)
      }, 150)
    }

    // Listen to window resize
    window.addEventListener('resize', handleResize)

    // Use ResizeObserver on the chart container and its parent
    const resizeObserver = new ResizeObserver(handleResize)

    // Observe the chart container
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current)
    }

    // Observe main content area (catches sidebar changes)
    const mainContent = document.querySelector('main') || document.querySelector('[role="main"]') || document.getElementById('main-content')
    if (mainContent) {
      resizeObserver.observe(mainContent)
    }

    // Observe body for class/attribute changes (sidebar state)
    const mutationObserver = new MutationObserver(handleResize)
    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-sidebar-state', 'data-state'],
      childList: false,
      subtree: false
    })

    // Also observe the sidebar element itself if it exists
    const sidebar = document.querySelector('[data-sidebar]') || document.querySelector('aside')
    if (sidebar) {
      mutationObserver.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class', 'data-state'],
      })
    }

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  // Navigation handler for modal
  const handleModalNavigate = (index: number) => {
    if (chartData && chartData[index]) {
      setCurrentDataIndex(index)
      setSelectedData(chartData[index])
    }
  }

  // Build color palette for nodes
  const nodeList: NodeResponse[] = useMemo(() => (Array.isArray(nodesData) ? nodesData : []), [nodesData])

  // Function to generate distinct colors based on theme
  const generateDistinctColor = useCallback((index: number, _totalNodes: number, isDark: boolean): string => {
    // Define a more distinct color palette with better contrast
    const distinctHues = [
      0, // Red
      30, // Orange
      60, // Yellow
      120, // Green
      180, // Cyan
      210, // Blue
      240, // Indigo
      270, // Purple
      300, // Magenta
      330, // Pink
      15, // Red-orange
      45, // Yellow-orange
      75, // Yellow-green
      150, // Green-cyan
      200, // Cyan-blue
      225, // Blue-indigo
      255, // Indigo-purple
      285, // Purple-magenta
      315, // Magenta-pink
      345, // Pink-red
    ]

    const hue = distinctHues[index % distinctHues.length]

    // Create more distinct saturation and lightness values
    const saturationVariations = [65, 75, 85, 70, 80, 60, 90, 55, 95, 50]
    const lightnessVariations = isDark ? [45, 55, 35, 50, 40, 60, 30, 65, 25, 70] : [40, 50, 30, 45, 35, 55, 25, 60, 20, 65]

    const saturation = saturationVariations[index % saturationVariations.length]
    const lightness = lightnessVariations[index % lightnessVariations.length]

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }, [])

  // Build chart config dynamically based on nodes
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    const isDark = resolvedTheme === 'dark'
    nodeList.forEach((node, idx) => {
      let color
      if (idx === 0) {
        // First node uses primary color like CostumeBarChart
        color = 'hsl(var(--primary))'
      } else if (idx < 5) {
        // Use palette colors for nodes 2-5: --chart-2, --chart-3, ...
        color = `hsl(var(--chart-${idx + 1}))`
      } else {
        // Generate distinct colors for nodes beyond palette
        color = generateDistinctColor(idx, nodeList.length, isDark)
      }
      config[node.name] = {
        label: node.name,
        color: color,
      }
    })
    return config
  }, [nodeList, resolvedTheme, generateDistinctColor])

  useEffect(() => {
    let isCancelled = false
    let timeoutId: NodeJS.Timeout

    const fetchUsageData = async () => {
      if (!dateRange?.from || !dateRange?.to) {
        setChartData(null)
        setTotalUsage('0')
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const startDate = dateRange.from
        const endDate = dateRange.to
        const period = getPeriodFromDateRange(dateRange)

        // Always use end of day for daily period to avoid extra bars
        const endTime = period === Period.day ? dateUtils.toDayjs(endDate).endOf('day').toISOString() : new Date().toISOString()

        const params: Parameters<typeof getUsage>[0] = {
          period: period,
          start: startDate.toISOString(),
          end: endTime,
          group_by_node: true,
        }
        const response = await getUsage(params)

        // Check if component is still mounted
        if (isCancelled) return

        // API response and nodes list logged

        // Handle the response format exactly like CostumeBarChart
        let statsByNode: Record<string, NodeUsageStat[]> = {}
        if (response && response.stats) {
          if (typeof response.stats === 'object' && !Array.isArray(response.stats)) {
            // This is the expected format when no node_id is provided
            statsByNode = response.stats
          } else if (Array.isArray(response.stats)) {
            // fallback: old format - not expected for all nodes
            console.warn('Unexpected array format for all nodes usage')
          }
        }

        // Stats by node processed

        // Build a map from node id to node name for quick lookup
        const nodeIdToName = nodeList.reduce(
          (acc, node) => {
            acc[node.id] = node.name
            return acc
          },
          {} as Record<string, string>,
        )

        // Node ID to name mapping created

        // Check if we have data for individual nodes or aggregated data
        const hasIndividualNodeData = Object.keys(statsByNode).some(key => key !== '-1')

        if (!hasIndividualNodeData && statsByNode['-1']) {
          // API returned aggregated data for all nodes combined
          // Using aggregated data for all nodes
          const aggregatedStats = statsByNode['-1']

          if (aggregatedStats.length > 0) {
            const data = aggregatedStats.map((point: NodeUsageStat) => {
              const d = dateUtils.toDayjs(point.period_start)
              let timeFormat
              if (period === Period.hour) {
                timeFormat = d.format('HH:mm')
              } else {
                timeFormat = d.format('MM/DD')
              }
              const usageInGB = (point.uplink + point.downlink) / (1024 * 1024 * 1024)

              // Create entry with all nodes having the same usage (aggregated)
              const entry: any = {
                time: timeFormat,
                _period_start: point.period_start,
              }
              nodeList.forEach(node => {
                // Distribute usage equally among nodes or show as total
                const nodeUsage = parseFloat((usageInGB / nodeList.length).toFixed(2))
                entry[node.name] = nodeUsage
                // Store uplink and downlink for tooltip (distributed equally)
                entry[`_uplink_${node.name}`] = point.uplink / nodeList.length
                entry[`_downlink_${node.name}`] = point.downlink / nodeList.length
              })
              return entry
            })

            // Final chart data (aggregated) processed
            if (!isCancelled) {
              setChartData(data)

              // Calculate total usage
              const total = aggregatedStats.reduce((sum: number, point: NodeUsageStat) => sum + point.uplink + point.downlink, 0)
              const formattedTotal = formatBytes(total, 2)
              if (typeof formattedTotal === 'string') setTotalUsage(formattedTotal)
            }
          } else {
            setChartData(null)
            setTotalUsage('0')
          }
        } else {
          // Handle individual node data (existing logic)
          // Build a set of all period_start values
          const allPeriods = new Set<string>()
          Object.values(statsByNode).forEach(arr => arr.forEach(stat => allPeriods.add(stat.period_start)))
          // Sort periods
          const sortedPeriods = Array.from(allPeriods).sort()

          // All periods and period type processed

          if (sortedPeriods.length > 0) {
            // Build chart data: [{ time, [nodeName]: usage, ... }]
            const data = sortedPeriods.map(periodStart => {
              const d = dateUtils.toDayjs(periodStart)
              let timeFormat
              if (period === Period.hour) {
                timeFormat = d.format('HH:mm')
              } else {
                timeFormat = d.format('MM/DD')
              }
              const entry: any = {
                time: timeFormat,
                _period_start: periodStart,
              }

              Object.entries(statsByNode).forEach(([nodeId, statsArr]) => {
                if (nodeId === '-1') return // Skip aggregated data
                const nodeName = nodeIdToName[nodeId]
                if (!nodeName) {
                  console.warn('No node name found for ID:', nodeId)
                  return
                }
                const nodeStats = statsArr.find(s => s.period_start === periodStart)
                if (nodeStats) {
                  const usageInGB = (nodeStats.uplink + nodeStats.downlink) / (1024 * 1024 * 1024)
                  entry[nodeName] = parseFloat(usageInGB.toFixed(2))
                  // Store uplink and downlink for tooltip
                  entry[`_uplink_${nodeName}`] = nodeStats.uplink
                  entry[`_downlink_${nodeName}`] = nodeStats.downlink
                  // Node usage processed
                } else {
                  entry[nodeName] = 0
                  entry[`_uplink_${nodeName}`] = 0
                  entry[`_downlink_${nodeName}`] = 0
                }
              })
              return entry
            })

            // Final chart data processed
            if (!isCancelled) {
              setChartData(data)

              // Calculate total usage
              let total = 0
              Object.values(statsByNode).forEach(arr =>
                arr.forEach(stat => {
                  total += stat.uplink + stat.downlink
                }),
              )
              const formattedTotal = formatBytes(total, 2)
              if (typeof formattedTotal === 'string') setTotalUsage(formattedTotal)
            }
          } else {
            // No periods found, setting empty data
            setChartData(null)
            setTotalUsage('0')
          }
        }
      } catch (err) {
        setError(err as Error)
        setChartData(null)
        setTotalUsage('0')
        console.error('Error fetching usage data:', err)
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    // Debounce the API call to prevent excessive requests during zoom
    timeoutId = setTimeout(() => {
      fetchUsageData()
    }, 300)

    return () => {
      isCancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [dateRange, nodeList])

  // Add effect to update dateRange when selectedTime changes
  useEffect(() => {
    if (!showCustomRange) {
      const now = new Date()
      let from: Date | undefined
      if (selectedTime === '12h') {
        from = new Date(now.getTime() - 12 * 60 * 60 * 1000)
      } else if (selectedTime === '24h') {
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      } else if (selectedTime === '3d') {
        from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      } else if (selectedTime === '1w') {
        from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      }
      if (from) {
        // For 1w and 3d, set to end of current day to avoid extra bar
        const to = selectedTime === '1w' || selectedTime === '3d' ? dateUtils.toDayjs(now).endOf('day').toDate() : now
        setDateRange({ from, to })
      }
    }
  }, [selectedTime, showCustomRange])

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1 border-b px-6 py-6 sm:flex-row sm:py-6">
            <div className="flex flex-1 flex-col justify-center gap-1 px-1 py-1 align-middle">
              <CardTitle>{t('statistics.trafficUsage')}</CardTitle>
              <CardDescription>{t('statistics.trafficUsageDescription')}</CardDescription>
            </div>
            <div className="flex flex-col justify-center gap-2 px-1 py-1 align-middle">
              <div className="flex items-center gap-2">
                {showCustomRange ? (
                  <TimeRangeSelector
                    onRangeChange={range => {
                      setDateRange(range)
                      setShowCustomRange(true)
                    }}
                    initialRange={dateRange}
                  />
                ) : (
                  <TimeSelector
                    selectedTime={selectedTime}
                    setSelectedTime={v => {
                      setSelectedTime(v)
                      setShowCustomRange(false)
                    }}
                  />
                )}
                <button type="button" aria-label="Custom Range" className={`rounded border p-1 ${showCustomRange ? 'bg-muted' : ''}`} onClick={() => setShowCustomRange(v => !v)}>
                  <Calendar className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="m-0 flex flex-col justify-center p-6 px-4 sm:border-l">
            <span className="text-xs text-muted-foreground sm:text-sm">{t('statistics.usageDuringPeriod')}</span>
            <span dir="ltr" className="flex justify-center text-lg text-foreground">
              {isLoading ? <Skeleton className="h-5 w-20" /> : totalUsage}
            </span>
          </div>
        </CardHeader>
        <CardContent ref={chartContainerRef} dir={dir} className="pt-8">
          {isLoading ? (
            <div className="flex max-h-[400px] min-h-[200px] w-full items-center justify-center">
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : error ? (
            <EmptyState type="error" className="max-h-[400px] min-h-[200px]" />
          ) : !dateRange ? (
            <EmptyState
              type="no-data"
              title={t('statistics.selectTimeRange')}
              description={t('statistics.selectTimeRangeDescription')}
              icon={<TrendingUp className="h-12 w-12 text-muted-foreground/50" />}
              className="max-h-[400px] min-h-[200px]"
            />
          ) : (
            <div className="mx-auto w-full max-w-7xl">
              <ChartContainer
                key={chartKey}
                dir={'ltr'}
                config={chartConfig}
                className="max-h-[400px] min-h-[200px] w-full"
                style={{
                  marginBottom: navigator.userAgent.includes('Safari') && navigator.platform.includes('Mac') ? `${0.18 * window.innerWidth}px` : '0',
                }}
              >
                {chartData && chartData.length > 0 ? (
                  <BarChart
                    accessibilityLayer
                    data={chartData}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    onClick={(data) => {
                      if (data && data.activePayload && data.activePayload.length > 0 && chartData) {
                        const clickedData = data.activePayload[0].payload
                        const activeNodesCount = Object.keys(clickedData).filter(key =>
                          !key.startsWith('_') && key !== 'time' && key !== '_period_start' && (clickedData[key] || 0) > 0
                        ).length
                        // Open modal if there are more nodes than shown in tooltip
                        const maxShown = window.innerWidth < 768 ? 3 : 6
                        if (activeNodesCount > maxShown) {
                          // Find the index of the clicked data point
                          const clickedIndex = chartData.findIndex(item => item._period_start === clickedData._period_start)
                          setCurrentDataIndex(clickedIndex >= 0 ? clickedIndex : 0)
                          setSelectedData(clickedData)
                          setModalOpen(true)
                        }
                      }
                    }}
                  >
                    <CartesianGrid direction={'ltr'} vertical={false} />
                    <XAxis direction={'ltr'} dataKey="time" tickLine={false} tickMargin={10} axisLine={false} minTickGap={5} />
                    <YAxis
                      direction={'ltr'}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={value => `${value.toFixed(2)} GB`}
                      tick={{
                        fill: 'hsl(var(--muted-foreground))',
                        fontSize: 9,
                        fontWeight: 500,
                      }}
                      width={32}
                      tickMargin={2}
                    />
                    {/* When using ChartTooltip, pass period as a prop */}
                    <ChartTooltip cursor={false} content={<CustomTooltip chartConfig={chartConfig} dir={dir} period={getPeriodFromDateRange(dateRange)} />} />
                    {nodeList.map((node, idx) => (
                      <Bar
                        key={node.id}
                        dataKey={node.name}
                        stackId="a"
                        fill={chartConfig[node.name]?.color || `hsl(var(--chart-${(idx % 5) + 1}))`}
                        radius={nodeList.length === 1 ? [4, 4, 4, 4] : idx === 0 ? [0, 0, 4, 4] : idx === nodeList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        cursor="pointer"
                      />
                    ))}
                  </BarChart>
                ) : (
                  <EmptyState type="no-data" title={t('statistics.noDataInRange')} description={t('statistics.noDataInRangeDescription')} className="max-h-[400px] min-h-[200px]" />
                )}
              </ChartContainer>
              {/* Separate scrollable legend */}
              {chartData && chartData.length > 0 && (
                <div className="overflow-x-auto pt-3">
                  <div className="flex min-w-max items-center justify-center gap-4">
                    {nodeList.map(node => {
                      const itemConfig = chartConfig[node.name]
                      return (
                        <div dir='ltr' key={node.id} className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground">
                          <div
                            className="h-2 w-2 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: itemConfig?.color || 'hsl(var(--chart-1))',
                            }}
                          />
                          <span className="whitespace-nowrap text-xs">{node.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Node Stats Modal */}
      <NodeStatsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={selectedData}
        chartConfig={chartConfig}
        period={getPeriodFromDateRange(dateRange)}
        allChartData={chartData || []}
        currentIndex={currentDataIndex}
        onNavigate={handleModalNavigate}
      />
    </>
  )
}
