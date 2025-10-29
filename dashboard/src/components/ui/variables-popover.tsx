import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useClipboard } from '@/hooks/use-clipboard'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

interface VariablesPopoverProps {
  /** Whether to show protocol and transport variables (default: false) */
  includeProtocolTransport?: boolean
  /** Popover side placement (default: "right") */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Popover alignment (default: "start") */
  align?: 'start' | 'center' | 'end'
  /** Side offset in pixels (default: 0) */
  sideOffset?: number
}

export function VariablesPopover({
  includeProtocolTransport = false,
  side = 'right',
  align = 'start',
  sideOffset = 0,
}: VariablesPopoverProps) {
  const { t } = useTranslation()
  const { copy } = useClipboard()

  const handleCopy = (text: string) => {
    copy(text)
    toast.success(t('usersTable.copied'))
  }

  const VariableItem = ({ variable, translationKey }: { variable: string; translationKey: string }) => (
    <div className="flex min-w-0 items-center gap-1.5">
      <code
        className="cursor-pointer shrink-0 rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted"
        onClick={() => handleCopy(variable)}
        title={t('copy')}
      >
        {variable}
      </code>
      <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={t(translationKey)}>
        {t(translationKey)}
      </span>
    </div>
  )

  const variablesList = (
    <div className="space-y-1">
      <VariableItem variable="{SERVER_IP}" translationKey="hostsDialog.variables.server_ip" />
      <VariableItem variable="{SERVER_IPV6}" translationKey="hostsDialog.variables.server_ipv6" />
      <VariableItem variable="{USERNAME}" translationKey="hostsDialog.variables.username" />
      <VariableItem variable="{DATA_USAGE}" translationKey="hostsDialog.variables.data_usage" />
      <VariableItem variable="{DATA_LEFT}" translationKey="hostsDialog.variables.data_left" />
      <VariableItem variable="{DATA_LIMIT}" translationKey="hostsDialog.variables.data_limit" />
      <VariableItem variable="{DAYS_LEFT}" translationKey="hostsDialog.variables.days_left" />
      <VariableItem variable="{EXPIRE_DATE}" translationKey="hostsDialog.variables.expire_date" />
      <VariableItem variable="{JALALI_EXPIRE_DATE}" translationKey="hostsDialog.variables.jalali_expire_date" />
      <VariableItem variable="{TIME_LEFT}" translationKey="hostsDialog.variables.time_left" />
      <VariableItem variable="{STATUS_EMOJI}" translationKey="hostsDialog.variables.status_emoji" />
      <VariableItem variable="{USAGE_PERCENTAGE}" translationKey="hostsDialog.variables.usage_percentage" />
      {includeProtocolTransport && (
        <>
          <VariableItem variable="{PROTOCOL}" translationKey="hostsDialog.variables.protocol" />
          <VariableItem variable="{TRANSPORT}" translationKey="hostsDialog.variables.transport" />
        </>
      )}
      <VariableItem variable="{ADMIN_USERNAME}" translationKey="hostsDialog.variables.admin_username" />
    </div>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent">
          <Info className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3 sm:w-[320px]" side={side} align={align} sideOffset={sideOffset}>
        <div className="space-y-1.5">
          <h4 className="mb-2 text-[12px] font-medium">{t('hostsDialog.variables.title')}</h4>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">{variablesList}</div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Component that renders just the variables list (without popover wrapper) - for use in ArrayInput */
export function VariablesList({
  includeProtocolTransport = false,
}: {
  includeProtocolTransport?: boolean
}) {
  const { t } = useTranslation()
  const { copy } = useClipboard()

  const handleCopy = (text: string) => {
    copy(text)
    toast.success(t('usersTable.copied'))
  }

  const VariableItem = ({ variable, translationKey }: { variable: string; translationKey: string }) => (
    <div className="flex min-w-0 items-center gap-1.5">
      <code
        className="cursor-pointer shrink-0 rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted"
        onClick={() => handleCopy(variable)}
        title={t('copy')}
      >
        {variable}
      </code>
      <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={t(translationKey)}>
        {t(translationKey)}
      </span>
    </div>
  )

  return (
    <div className="space-y-1">
      <VariableItem variable="{SERVER_IP}" translationKey="hostsDialog.variables.server_ip" />
      <VariableItem variable="{SERVER_IPV6}" translationKey="hostsDialog.variables.server_ipv6" />
      <VariableItem variable="{USERNAME}" translationKey="hostsDialog.variables.username" />
      <VariableItem variable="{DATA_USAGE}" translationKey="hostsDialog.variables.data_usage" />
      <VariableItem variable="{USAGE_PERCENTAGE}" translationKey="hostsDialog.variables.usage_percentage" />
      <VariableItem variable="{DATA_LEFT}" translationKey="hostsDialog.variables.data_left" />
      <VariableItem variable="{DATA_LIMIT}" translationKey="hostsDialog.variables.data_limit" />
      <VariableItem variable="{DAYS_LEFT}" translationKey="hostsDialog.variables.days_left" />
      <VariableItem variable="{EXPIRE_DATE}" translationKey="hostsDialog.variables.expire_date" />
      <VariableItem variable="{JALALI_EXPIRE_DATE}" translationKey="hostsDialog.variables.jalali_expire_date" />
      <VariableItem variable="{TIME_LEFT}" translationKey="hostsDialog.variables.time_left" />
      <VariableItem variable="{STATUS_EMOJI}" translationKey="hostsDialog.variables.status_emoji" />
      {includeProtocolTransport && (
        <>
          <VariableItem variable="{PROTOCOL}" translationKey="hostsDialog.variables.protocol" />
          <VariableItem variable="{TRANSPORT}" translationKey="hostsDialog.variables.transport" />
        </>
      )}
      <VariableItem variable="{ADMIN_USERNAME}" translationKey="hostsDialog.variables.admin_username" />
    </div>
  )
}

