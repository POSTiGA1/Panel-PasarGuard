import { useState } from 'react'
import { useFieldArray } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GripVertical, Trash2, Plus, ChevronDown, ChevronRight, Apple, Tv, Monitor, Laptop, Smartphone, Star } from 'lucide-react'
import useDirDetection from '@/hooks/use-dir-detection'

const platformOptions = [
    { value: 'android', label: 'settings.subscriptions.applications.platforms.android' },
    { value: 'ios', label: 'settings.subscriptions.applications.platforms.ios' },
    { value: 'windows', label: 'settings.subscriptions.applications.platforms.windows' },
    { value: 'macos', label: 'settings.subscriptions.applications.platforms.macos' },
    { value: 'linux', label: 'settings.subscriptions.applications.platforms.linux' },
    { value: 'appletv', label: 'settings.subscriptions.applications.platforms.appletv' },
    { value: 'androidtv', label: 'settings.subscriptions.applications.platforms.androidtv' },
]

const languageOptions = [
    { value: 'en', label: 'English', icon: '🇺🇸' },
    { value: 'fa', label: 'فارسی', icon: '🇮🇷' },
    { value: 'ru', label: 'Русский', icon: '🇷🇺' },
    { value: 'zh', label: '中文', icon: '🇨🇳' },
]

interface SortableApplicationProps {
    application: any
    index: number
    onRemove: (index: number) => void
    form: any
    id: string
}

export function SortableApplication({ index, onRemove, form, id }: SortableApplicationProps) {
    const { t } = useTranslation()
    const isRtl = useDirDetection() === "rtl"
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const [isExpanded, setIsExpanded] = useState(false)
    const [iconBroken, setIconBroken] = useState(false)
    const [selectedLanguage, setSelectedLanguage] = useState('en')


    const PlatformIcon = ({ platform }: { platform: string }) => {
        switch (platform) {
            case 'android':
            case 'ios':
                return <Smartphone className="h-3.5 w-3.5" />
            case 'macos':
                return <Apple className="h-3.5 w-3.5" />
            case 'windows':
                return <Laptop className="h-3.5 w-3.5" />
            case 'linux':
                return <Monitor className="h-3.5 w-3.5" />
            case 'appletv':
            case 'androidtv':
                return <Tv className="h-3.5 w-3.5" />
            default:
                return <Monitor className="h-3.5 w-3.5" />
        }
    }

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : 1,
        opacity: isDragging ? 0.8 : 1,
    }
    const cursor = isDragging ? 'grabbing' : 'grab'

    const {
        fields: downloadLinkFields,
        append: appendDownloadLink,
        remove: removeDownloadLink,
    } = useFieldArray({
        control: form.control,
        name: `applications.${index}.download_links`,
    })

    const addDownloadLink = () => {
        appendDownloadLink({ name: '', url: '', language: 'en' })
    }

    return (
        <div ref={setNodeRef} style={style} className="cursor-default">
            <div className="group relative rounded-md border bg-card transition-colors hover:bg-accent/20">
                {/* Header with drag handle, expand/collapse, and delete button */}
                <div className="flex items-center gap-3 p-4">
                    <button type="button" style={{ cursor: cursor }} className="touch-none opacity-50 transition-opacity group-hover:opacity-100" {...attributes} {...listeners}>
                        <GripVertical className="h-5 w-5" />
                        <span className="sr-only">Drag to reorder</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={"flex flex-1 items-center gap-2 hover:text-foreground flex-wrap sm:flex-nowrap"}
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {/* Icon preview with graceful fallback */}
                        {(() => {
                            const iconUrl = form.watch(`applications.${index}.icon_url`)
                            const name = (form.watch(`applications.${index}.name`) || '').trim()
                            const initial = name ? name.charAt(0).toUpperCase() : ''
                            const platform = form.watch(`applications.${index}.platform`)
                            if (iconUrl && !iconBroken) {
                                return (
                                    <img
                                        src={iconUrl}
                                        alt={name || 'icon'}
                                        className="h-5 w-5 rounded-sm object-cover"
                                        onError={() => setIconBroken(true)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                )
                            }
                            return (
                                <span
                                    aria-label="app-icon-fallback"
                                    className="h-5 w-5 overflow-hidden rounded-sm bg-muted text-muted-foreground/90 inline-flex items-center justify-center"
                                >
                                    {initial ? (
                                        <span className="text-[10px] leading-none font-medium">{initial}</span>
                                    ) : (
                                        <span className="text-[10px] leading-none">
                                            {/* small platform glyph fallback */}
                                            <PlatformIcon platform={platform} />
                                        </span>
                                    )}
                                </span>
                            )
                        })()}
                        <FormField
                            control={form.control}
                            name={`applications.${index}.platform`}
                            render={({ field }) => (
                                <span className="text-xs text-muted-foreground">
                                    {t(platformOptions.find(o => o.value === field.value)?.label || '')}
                                </span>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`applications.${index}.platform`}
                            render={({ field }) => (
                                <span className="text-muted-foreground/80">
                                    <PlatformIcon platform={field.value} />
                                </span>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`applications.${index}.name`}
                            render={({ field }) => (
                                <h4 className="text-sm font-medium min-w-0 truncate flex items-center gap-1.5">
                                    {field.value || t('settings.subscriptions.applications.application', { defaultValue: 'Application' })}
                                    {form.watch(`applications.${index}.recommended`) ? (
                                        <span title={t('settings.subscriptions.applications.recommended')} className="inline-flex items-center text-amber-500/90">
                                            <Star className="h-3.5 w-3.5 fill-amber-500/30" />
                                        </span>
                                    ) : null}
                                </h4>
                            )}
                        />
                    </button>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            onRemove(index)
                        }}
                        className="h-8 w-8 shrink-0 p-0 text-destructive opacity-70 transition-opacity hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Collapsible content */}
                {isExpanded && (
                    <div className="border-t bg-muted/20 p-4">
                        <div className="space-y-4">
                            {/* Application fields */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name={`applications.${index}.name`}
                                    render={({ field }) => (
                                        <FormItem className="space-y-1">
                                            <FormLabel className="text-xs text-muted-foreground/80">{t('settings.subscriptions.applications.name')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('settings.subscriptions.applications.namePlaceholder')}
                                                    {...field}
                                                    className="h-8 text-xs"
                                                />
                                            </FormControl>
                                            {((form.formState?.errors as any)?.applications?.[index]?.name) && (
                                                <p className="text-[0.8rem] font-medium text-destructive">
                                                    {t('validation.required', { field: t('settings.subscriptions.applications.name') })}
                                                </p>
                                            )}
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`applications.${index}.icon_url`}
                                    render={({ field }) => (
                                        <FormItem className="space-y-1">
                                            <FormLabel className="text-xs text-muted-foreground/80">{t('settings.subscriptions.applications.iconUrl', { defaultValue: 'Icon URL' })}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('settings.subscriptions.applications.iconUrlPlaceholder', { defaultValue: 'https://...' })}
                                                    {...field}
                                                    className="h-8 text-xs font-mono text-left"
                                                    dir="ltr"
                                                />
                                            </FormControl>
                                            <FormDescription className="text-xs text-muted-foreground">
                                                {t('settings.subscriptions.applications.iconUrlDescription', { defaultValue: 'Optional. Shown next to app name.' })}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`applications.${index}.platform`}
                                    render={({ field }) => (
                                        <FormItem className="space-y-1">
                                            <FormLabel className="text-xs text-muted-foreground/80">{t('settings.subscriptions.applications.platform')}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="scrollbar-thin z-[50]">
                                                    {platformOptions.map(option => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            <div className="flex items-center gap-1.5">
                                                                <PlatformIcon platform={option.value} />
                                                                <span className="text-xs">{t(option.label)}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`applications.${index}.import_url`}
                                    render={({ field }) => (
                                        <FormItem className="space-y-1 sm:col-span-2">
                                            <FormLabel className="text-xs text-muted-foreground/80">{t('settings.subscriptions.applications.importUrl')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t('settings.subscriptions.applications.importUrlPlaceholder')}
                                                    {...field}
                                                    className="h-8 text-xs font-mono text-left"
                                                    dir="ltr"
                                                />
                                            </FormControl>
                                            <FormDescription className="text-xs text-muted-foreground">
                                                {t('settings.subscriptions.applications.importUrlDescription')}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`applications.${index}.description`}
                                    render={({ field }) => (
                                        <FormItem className="space-y-1 sm:col-span-2">
                                            <FormLabel className="text-xs text-muted-foreground/80">{t('settings.subscriptions.applications.descriptionApp')}</FormLabel>
                                            <FormControl>
                                                <div className="flex gap-2">
                                                    <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                                                        <SelectTrigger className="w-32 h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="scrollbar-thin z-[50]">
                                                            {languageOptions.map(option => (
                                                                <SelectItem key={option.value} value={option.value}>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs">{option.icon}</span>
                                                                        <span className="text-xs">{option.label}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Textarea
                                                        placeholder={t('settings.subscriptions.applications.descriptionPlaceholder', {
                                                            lang: languageOptions.find(lang => lang.value === selectedLanguage)?.label || 'English'
                                                        })}
                                                        value={field.value?.[selectedLanguage] || ''}
                                                        onChange={e => {
                                                            const current = field.value || {}
                                                            field.onChange({
                                                                ...current,
                                                                [selectedLanguage]: e.target.value
                                                            })
                                                        }}
                                                        className={`min-h-[60px] text-xs flex-1 resize-none ${isRtl && selectedLanguage !== 'fa' ? 'text-left' : ''}`}
                                                        dir={isRtl && selectedLanguage !== 'fa' ? 'ltr' : undefined}
                                                        rows={2}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name={`applications.${index}.recommended`}
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between space-y-0 rounded-lg border bg-muted/30 p-3 sm:col-span-2">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-xs font-medium">{t('settings.subscriptions.applications.recommended')}</FormLabel>
                                                <FormDescription className="text-xs text-muted-foreground">{t('settings.subscriptions.applications.recommendedDescription')}</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Download Links */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <FormLabel className="text-xs font-medium text-muted-foreground/80">
                                        {t('settings.subscriptions.applications.downloadLinks')} ({downloadLinkFields.length})
                                    </FormLabel>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addDownloadLink}
                                        className="h-7 text-xs"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        {t('settings.subscriptions.applications.addDownloadLink')}
                                    </Button>
                                </div>

                                {((form.formState?.errors as any)?.applications?.[index]?.download_links?.message) && (
                                    <p className="px-1 text-[0.8rem] font-medium text-destructive">
                                        {t('settings.subscriptions.applications.downloadLinksRequired', { defaultValue: 'At least one download link is required' })}
                                    </p>
                                )}

                                {downloadLinkFields.length === 0 ? (
                                    <div className="py-4 text-center text-muted-foreground">
                                        <p className="text-xs">{t('settings.subscriptions.applications.noDownloadLinks')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {downloadLinkFields.map((linkField, linkIndex) => {
                                            const linkLang = form.watch(`applications.${index}.download_links.${linkIndex}.language`)
                                            const ltrForThis = isRtl && linkLang !== 'fa'
                                            return (
                                                <div key={linkField.id} className="flex gap-2 rounded-md border bg-muted/20 p-2">
                                                    <FormField
                                                        control={form.control}
                                                        name={`applications.${index}.download_links.${linkIndex}.name`}
                                                        render={({ field }) => (
                                                            <FormItem className="flex-1">
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder={t('settings.subscriptions.applications.downloadLinkNamePlaceholder')}
                                                                        {...field}
                                                                        className={`h-7 text-xs ${ltrForThis ? 'text-left' : ''}`}
                                                                        dir={ltrForThis ? 'ltr' : undefined}
                                                                    />
                                                                </FormControl>
                                                                {((form.formState?.errors as any)?.applications?.[index]?.download_links?.[linkIndex]?.name) && (
                                                                    <p className="text-[0.75rem] font-medium text-destructive">
                                                                        {t('validation.required', { field: t('settings.subscriptions.applications.downloadLinkName', { defaultValue: 'Download link name' }) })}
                                                                    </p>
                                                                )}
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`applications.${index}.download_links.${linkIndex}.url`}
                                                        render={({ field }) => (
                                                            <FormItem className="flex-1">
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder={t('settings.subscriptions.applications.downloadLinkUrlPlaceholder')}
                                                                        {...field}
                                                                        className="h-7 text-xs font-mono text-left"
                                                                        dir="ltr"
                                                                    />
                                                                </FormControl>
                                                                {((form.formState?.errors as any)?.applications?.[index]?.download_links?.[linkIndex]?.url) && (
                                                                    <p className="text-[0.75rem] font-medium text-destructive">
                                                                        {t('validation.url', { defaultValue: 'Please enter a valid URL' })}
                                                                    </p>
                                                                )}
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`applications.${index}.download_links.${linkIndex}.language`}
                                                        render={({ field }) => (
                                                            <FormItem className="w-24">
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-7 text-xs">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent className="scrollbar-thin z-[50]">
                                                                        {languageOptions.map(option => (
                                                                            <SelectItem key={option.value} value={option.value}>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="text-xs">{option.icon}</span>
                                                                                    <span className="text-xs">{option.label}</span>
                                                                                </div>
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeDownloadLink(linkIndex)}
                                                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Drag overlay */}
                {isDragging && <div className="pointer-events-none absolute inset-0 rounded-md border border-primary/20 bg-primary/5"></div>}
            </div>
        </div>
    )
}
