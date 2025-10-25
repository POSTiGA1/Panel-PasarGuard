import { CopyButton } from '@/components/CopyButton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { LoaderButton } from '@/components/ui/loader-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { useCreateCoreConfig, useModifyCoreConfig } from '@/service/api'
import { isEmptyObject } from '@/utils/isEmptyObject.ts'
import { generateMldsa65 } from '@/utils/mldsa65'
import { queryClient } from '@/utils/query-client'
import Editor from '@monaco-editor/react'
import { encodeURLSafe } from '@stablelib/base64'
import { generateKeyPair } from '@stablelib/x25519'
import { debounce } from 'es-toolkit'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { MlKem768 } from 'mlkem'
import { useCallback, useEffect, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useTheme } from '../../components/theme-provider'

export const coreConfigFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  config: z.string().min(1, 'Configuration is required'),
  fallback_id: z.array(z.string()).optional(),
  excluded_inbound_ids: z.array(z.string()).optional(),
  public_key: z.string().optional(),
  private_key: z.string().optional(),
  restart_nodes: z.boolean().default(true),
})

export type CoreConfigFormValues = z.infer<typeof coreConfigFormSchema>

interface CoreConfigModalProps {
  isDialogOpen: boolean
  onOpenChange: (open: boolean) => void
  form: UseFormReturn<CoreConfigFormValues>
  editingCore: boolean
  editingCoreId?: number
}

interface ValidationResult {
  isValid: boolean
  error?: string
}
// Add encryption methods enum
const SHADOWSOCKS_ENCRYPTION_METHODS = [
  { value: '2022-blanke3-aes-128-gcm', label: '2022-blanke3-aes-128-gcm', length: 16 },
  { value: '2022-blake3-aes-256-gcm', label: '2022-blake3-aes-256-gcm', length: 32 },
] as const
type VlessVariant = 'x25519' | 'mlkem768'

export default function CoreConfigModal({ isDialogOpen, onOpenChange, form, editingCore, editingCoreId }: CoreConfigModalProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const { resolvedTheme } = useTheme()
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true })
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [generatedShortId, setGeneratedShortId] = useState<string | null>(null)
  const [keyPair, setKeyPair] = useState<{ publicKey: string; privateKey: string } | null>(null)
  const createCoreMutation = useCreateCoreConfig()
  const modifyCoreMutation = useModifyCoreConfig()
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false)
  const [inboundTags, setInboundTags] = useState<string[]>([])
  const [isGeneratingKeyPair, setIsGeneratingKeyPair] = useState(false)
  const [isGeneratingShortId, setIsGeneratingShortId] = useState(false)
  const [isGeneratingVLESSEncryption, setIsGeneratingVLESSEncryption] = useState(false)
  const [generatedShadowsocksPassword, setGeneratedShadowsocksPassword] = useState<string | null>(null)
  const [selectedEncryptionMethod, setSelectedEncryptionMethod] = useState<string>(SHADOWSOCKS_ENCRYPTION_METHODS[0].value)
  const [isGeneratingShadowsocksPassword, setIsGeneratingShadowsocksPassword] = useState(false)
  const [isGeneratingMldsa65, setIsGeneratingMldsa65] = useState(false)
  const [mldsa65Keys, setMldsa65Keys] = useState<{ seed: string; verify: string } | null>(null)
  const [vlessEncryption, setVlessEncryption] = useState<{
    x25519: { decryption: string; encryption: string } | null
    mlkem768: { decryption: string; encryption: string } | null
  }>({ x25519: null, mlkem768: null })
  const [selectedVlessVariant, setSelectedVlessVariant] = useState<VlessVariant>('x25519')
  const handleVlessVariantChange = useCallback(
    (value: string) => {
      if (value === 'x25519' || value === 'mlkem768') {
        setSelectedVlessVariant(value)
      }
    },
    [setSelectedVlessVariant],
  )

  // Get current encryption values based on selected variant
  const getCurrentVlessValues = useCallback(() => {
    const encryptionData = selectedVlessVariant === 'x25519' ? vlessEncryption.x25519 : vlessEncryption.mlkem768
    return encryptionData
  }, [selectedVlessVariant, vlessEncryption])

  const currentVlessValues = getCurrentVlessValues()

  const handleEditorValidation = useCallback(
    (markers: any[]) => {
      // Monaco editor provides validation markers
      const hasErrors = markers.length > 0
      if (hasErrors) {
        setValidation({
          isValid: false,
          error: markers[0].message,
        })
        toast.error(markers[0].message, {
          duration: 3000,
          position: 'bottom-right',
        })
      } else {
        try {
          // Additional validation - try parsing the JSON
          JSON.parse(form.getValues().config)
          setValidation({ isValid: true })
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : 'Invalid JSON'
          setValidation({
            isValid: false,
            error: errorMessage,
          })
          toast.error(errorMessage, {
            duration: 3000,
            position: 'bottom-right',
          })
        }
      }
    },
    [form],
  )

  // Debounce config changes to improve performance
  const debouncedConfigChange = useCallback(
    debounce((value: string) => {
      try {
        const parsedConfig = JSON.parse(value)
        if (parsedConfig.inbounds && Array.isArray(parsedConfig.inbounds)) {
          const tags = parsedConfig.inbounds.filter((inbound: any) => typeof inbound.tag === 'string' && inbound.tag.trim() !== '').map((inbound: any) => inbound.tag)
          setInboundTags(tags)
        } else {
          setInboundTags([])
        }
      } catch {
        setInboundTags([])
      }
    }, 300),
    [],
  )

  // Extract inbound tags from config JSON whenever config changes
  useEffect(() => {
    const configValue = form.getValues().config
    if (configValue) {
      debouncedConfigChange(configValue)
    }
  }, [form.watch('config'), debouncedConfigChange])

  const handleEditorDidMount = useCallback(() => {
    setIsEditorReady(true)
  }, [])

  const generatePrivateAndPublicKey = async () => {
    try {
      setIsGeneratingKeyPair(true)
      const keyPair = generateKeyPair()
      const formattedKeyPair = {
        privateKey: encodeURLSafe(keyPair.secretKey).replace(/=/g, '').replace(/\n/g, ''),
        publicKey: encodeURLSafe(keyPair.publicKey).replace(/=/g, '').replace(/\n/g, ''),
      }
      setKeyPair(formattedKeyPair)
      toast.success(t('coreConfigModal.keyPairGenerated'))
    } catch (error) {
      toast.error(t('coreConfigModal.keyPairGenerationFailed'))
    } finally {
      setIsGeneratingKeyPair(false)
    }
  }

  const generateShortId = async () => {
    try {
      setIsGeneratingShortId(true)
      const randomBytes = new Uint8Array(8)
      crypto.getRandomValues(randomBytes)
      const shortId = Array.from(randomBytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
      setGeneratedShortId(shortId)
      toast.success(t('coreConfigModal.shortIdGenerated'))
    } catch (error) {
      toast.error(t('coreConfigModal.shortIdGenerationFailed'))
    } finally {
      setIsGeneratingShortId(false)
    }
  }
  const generateShadowsocksPassword = async (value: string) => {
    try {
      setIsGeneratingShadowsocksPassword(true)
      const method = SHADOWSOCKS_ENCRYPTION_METHODS.find(m => m.value === value)
      if (!method) return

      const randomBytes = new Uint8Array(method.length)
      crypto.getRandomValues(randomBytes)
      const password = btoa(String.fromCharCode(...randomBytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
      setGeneratedShadowsocksPassword(password)
      toast.success(t('coreConfigModal.shadowsocksPasswordGenerated'))
    } catch (error) {
      toast.error(t('coreConfigModal.shadowsocksPasswordGenerationFailed'))
    } finally {
      setIsGeneratingShadowsocksPassword(false)
    }
  }
  const handleGenerateMldsa65 = async () => {
    try {
      setIsGeneratingMldsa65(true)
      const result = await generateMldsa65()
      setMldsa65Keys(result)
      toast.success(t('coreConfigModal.mldsa65Generated'))
    } catch (error) {
      const message = error instanceof Error ? error.message : t('coreConfigModal.mldsa65GenerationFailed', { defaultValue: 'Failed to generate ML-DSA-65 keys' })
      toast.error(message)
    } finally {
      setIsGeneratingMldsa65(false)
    }
  }
  const generateVLESSEncryption = async () => {
    try {
      setIsGeneratingVLESSEncryption(true)

      // Generate X25519 key pair
      const x25519KeyPair = generateKeyPair()
      const x25519ServerKey = encodeURLSafe(x25519KeyPair.secretKey).replace(/=/g, '')
      const x25519ClientKey = encodeURLSafe(x25519KeyPair.publicKey).replace(/=/g, '')

      // Generate ML-KEM-768 key pair based on upstream implementation
      const mlkem768Seed = new Uint8Array(64)
      crypto.getRandomValues(mlkem768Seed)
      const mlkem768 = new MlKem768()
      const [mlkem768Client] = await mlkem768.deriveKeyPair(mlkem768Seed)
      const mlkem768ServerKey = encodeURLSafe(mlkem768Seed).replace(/=/g, '')
      const mlkem768ClientKey = encodeURLSafe(mlkem768Client).replace(/=/g, '')

      // Match upstream dot config format:
      // {handshake_method}.{encryption_type}.{session_resume}.{auth_parameter}
      const generateDotConfig = (handshake: string, encryption: string, sessionResume: string, authParam: string) => `${handshake}.${encryption}.${sessionResume}.${authParam}`

      const x25519Decryption = generateDotConfig('mlkem768x25519plus', 'native', '600s', x25519ServerKey)
      const x25519Encryption = generateDotConfig('mlkem768x25519plus', 'native', '0rtt', x25519ClientKey)
      const mlkem768Decryption = generateDotConfig('mlkem768x25519plus', 'native', '600s', mlkem768ServerKey)
      const mlkem768Encryption = generateDotConfig('mlkem768x25519plus', 'native', '0rtt', mlkem768ClientKey)

      setVlessEncryption({
        x25519: {
          decryption: x25519Decryption,
          encryption: x25519Encryption,
        },
        mlkem768: {
          decryption: mlkem768Decryption,
          encryption: mlkem768Encryption,
        },
      })

      toast.success(t('coreConfigModal.vlessEncryptionGenerated'))
    } catch (error) {
      toast.error(t('coreConfigModal.vlessEncryptionGenerationFailed'))
    } finally {
      setIsGeneratingVLESSEncryption(false)
    }
  }

  const defaultConfig = JSON.stringify(
    {
      log: {
        loglevel: 'info',
      },
      inbounds: [
        {
          tag: 'Shadowsocks TCP',
          listen: '0.0.0.0',
          port: 1080,
          protocol: 'shadowsocks',
          settings: {
            clients: [],
            network: 'tcp,udp',
          },
        },
      ],
      outbounds: [
        {
          protocol: 'freedom',
          tag: 'DIRECT',
        },
        {
          protocol: 'blackhole',
          tag: 'BLOCK',
        },
      ],
      routing: {
        rules: [
          {
            ip: ['geoip:private'],
            outboundTag: 'BLOCK',
            type: 'field',
          },
        ],
      },
    },
    null,
    2,
  )

  const onSubmit = async (values: CoreConfigFormValues) => {
    try {
      // Validate JSON first
      let configObj
      try {
        configObj = JSON.parse(values.config)
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Invalid JSON'
        form.setError('config', {
          type: 'manual',
          message: errorMessage,
        })
        toast.error(errorMessage)
        return
      }

      const fallbackTags = values.fallback_id || []
      const excludeInboundTags = values.excluded_inbound_ids || []

      if (editingCore && editingCoreId) {
        // Update existing core
        await modifyCoreMutation.mutateAsync({
          coreId: editingCoreId,
          data: {
            name: values.name,
            config: configObj,
            fallbacks_inbound_tags: fallbackTags,
            exclude_inbound_tags: excludeInboundTags,
          },
          params: {
            restart_nodes: values.restart_nodes,
          },
        })
      } else {
        // Create new core
        await createCoreMutation.mutateAsync({
          data: {
            name: values.name,
            config: configObj,
            fallbacks_inbound_tags: fallbackTags,
            exclude_inbound_tags: excludeInboundTags,
          },
        })
      }

      toast.success(
        t(editingCore ? 'coreConfigModal.editSuccess' : 'coreConfigModal.createSuccess', {
          name: values.name,
        }),
      )

      // Invalidate core config queries after successful action
      queryClient.invalidateQueries({ queryKey: ['/api/cores'] })
      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      console.error('Core config operation failed:', error)
      console.error('Error response:', error?.response)
      // Error data logging removed

      // Reset all previous errors first
      form.clearErrors()

      // Handle validation errors
      if (error?.response?._data && !isEmptyObject(error?.response?._data)) {
        // For zod validation errors
        const fields = ['name', 'config', 'fallback_id', 'excluded_inbound_ids']

        // Show first error in a toast
        if (error?.response?._data?.detail) {
          const detail = error?.response?._data?.detail
          // If detail is an object with field errors (e.g., { status: "some error" })
          if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
            // Set errors for all fields in the object
            const firstField = Object.keys(detail)[0]
            const firstMessage = detail[firstField]

            Object.entries(detail).forEach(([field, message]) => {
              if (fields.includes(field)) {
                form.setError(field as any, {
                  type: 'manual',
                  message:
                    typeof message === 'string'
                      ? message
                      : t('validation.invalid', {
                          field: t(`coreConfigModal.${field}`, { defaultValue: field }),
                          defaultValue: `${field} is invalid`,
                        }),
                })
              }
            })

            toast.error(
              firstMessage ||
                t('validation.invalid', {
                  field: t(`coreConfigModal.${firstField}`, { defaultValue: firstField }),
                  defaultValue: `${firstField} is invalid`,
                }),
            )
          } else if (typeof detail === 'string' && !Array.isArray(detail)) {
            toast.error(detail)
          }
        }
      } else if (error?.response?.data) {
        // Handle API errors
        const apiError = error.response?.data
        let errorMessage = ''

        if (typeof apiError === 'string') {
          errorMessage = apiError
        } else if (apiError?.detail) {
          if (Array.isArray(apiError.detail)) {
            // Handle array of field errors
            apiError.detail.forEach((err: any) => {
              if (err.loc && err.loc[1]) {
                const fieldName = err.loc[1]
                form.setError(fieldName as any, {
                  type: 'manual',
                  message: err.msg,
                })
              }
            })
            errorMessage = apiError.detail[0]?.msg || 'Validation error'
          } else if (typeof apiError.detail === 'string') {
            errorMessage = apiError.detail
          } else {
            errorMessage = 'Validation error'
          }
        } else if (apiError?.message) {
          errorMessage = apiError.message
        } else {
          errorMessage = 'An unexpected error occurred'
        }

        toast.error(errorMessage)
      } else {
        // Generic error handling
        toast.error(error?.message || t('coreConfigModal.genericError', { defaultValue: 'An error occurred' }))
      }
    }
  }

  // Initialize form fields when modal opens
  useEffect(() => {
    if (isDialogOpen) {
      if (!editingCore) {
        // Reset form for new core
        form.reset({
          name: '',
          config: defaultConfig,
          excluded_inbound_ids: [],
          fallback_id: [],
          restart_nodes: true,
        })
      } else {
        // Set restart_nodes to true for editing
        form.setValue('restart_nodes', true)
      }
    }
  }, [isDialogOpen, editingCore, form, defaultConfig])

  // Cleanup on modal close
  useEffect(() => {
    if (!isDialogOpen) {
      setIsEditorFullscreen(false)
      setKeyPair(null)
      setGeneratedShortId(null)
      setVlessEncryption({ x25519: null, mlkem768: null })
      setSelectedVlessVariant('x25519')
      setMldsa65Keys(null)
      setValidation({ isValid: true })
    }
  }, [isDialogOpen])

  // Add this CSS somewhere in your styles (you might need to create a new CSS file or add to existing one)
  const styles = `
    .monaco-editor-mobile .monaco-menu {
        background-color: var(--background) !important;
    }

    .monaco-editor-mobile .monaco-menu .action-item {
        background-color: var(--background) !important;
    }

    .monaco-editor-mobile .monaco-menu .action-item:hover {
        background-color: var(--muted) !important;
    }

    .monaco-editor-mobile .monaco-menu .action-item.disabled {
        opacity: 0.5;
    }

    .monaco-editor-mobile .monaco-menu .action-item .action-label {
        color: var(--foreground) !important;
    }

    .monaco-editor-mobile .monaco-menu .action-item:hover .action-label {
        color: var(--foreground) !important;
    }
    `

  // Add this useEffect to inject the styles
  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.textContent = styles
    document.head.appendChild(styleElement)
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  // Handle Monaco Editor web component registration errors
  useEffect(() => {
    const originalError = console.error
    console.error = (...args) => {
      // Suppress the specific web component registration error
      if (args[0]?.message?.includes('custom element with name') && args[0]?.message?.includes('has already been defined')) {
        return
      }
      originalError.apply(console, args)
    }

    return () => {
      console.error = originalError
    }
  }, [])

  return (
    <Dialog open={isDialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="h-full max-w-full px-4 py-6 sm:h-auto sm:max-w-[1000px]" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className={cn('text-start text-xl font-semibold', dir === 'rtl' && 'sm:text-right')}>{editingCore ? t('coreConfigModal.editCore') : t('coreConfigModal.addConfig')}</DialogTitle>
          <p className={cn('text-start text-sm text-muted-foreground', dir === 'rtl' && 'sm:text-right')}>{t('coreConfigModal.createNewConfig')}</p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="-mr-4 max-h-[69dvh] overflow-y-auto px-2 pr-4 sm:max-h-[72dvh]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="space-y-4">
                    {/* Form: Core configuration JSON */}
                    <FormField
                      control={form.control}
                      name="config"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div
                              className={cn(
                                'relative h-[450px] rounded-lg border sm:h-[500px] md:h-[550px]',
                                isEditorFullscreen && 'fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none flex-col bg-background p-0',
                              )}
                              dir="ltr"
                            >
                              {!isEditorReady && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">
                                  <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></span>
                                </div>
                              )}
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className={cn('absolute right-2 top-2 z-50', isEditorFullscreen ? 'bg-muted' : '')}
                                onClick={() => setIsEditorFullscreen(v => !v)}
                                aria-label={isEditorFullscreen ? t('exitFullscreen') : t('fullscreen')}
                              >
                                {isEditorFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                              </Button>
                              <Editor
                                height={isEditorFullscreen ? '100vh' : '100%'}
                                defaultLanguage="json"
                                value={field.value}
                                theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                                onChange={field.onChange}
                                onValidate={handleEditorValidation}
                                onMount={handleEditorDidMount}
                                options={{
                                  minimap: { enabled: false },
                                  fontSize: 14,
                                  lineNumbers: 'on',
                                  roundedSelection: true,
                                  scrollBeyondLastLine: false,
                                  automaticLayout: true,
                                  formatOnPaste: true,
                                  formatOnType: true,
                                  renderWhitespace: 'none',
                                  wordWrap: 'on',
                                  folding: true,
                                  suggestOnTriggerCharacters: true,
                                  quickSuggestions: true,
                                  renderLineHighlight: 'all',
                                  scrollbar: {
                                    vertical: 'visible',
                                    horizontal: 'visible',
                                    useShadows: false,
                                    verticalScrollbarSize: 10,
                                    horizontalScrollbarSize: 10,
                                  },
                                  // Mobile-friendly options
                                  contextmenu: true,
                                  copyWithSyntaxHighlighting: false,
                                  multiCursorModifier: 'alt',
                                  accessibilitySupport: 'on',
                                  mouseWheelZoom: true,
                                  quickSuggestionsDelay: 0,
                                  occurrencesHighlight: 'singleFile',
                                  wordBasedSuggestions: 'currentDocument',
                                  suggest: {
                                    showWords: true,
                                    showSnippets: true,
                                    showClasses: true,
                                    showFunctions: true,
                                    showVariables: true,
                                    showProperties: true,
                                    showColors: true,
                                    showFiles: true,
                                    showReferences: true,
                                    showFolders: true,
                                    showTypeParameters: true,
                                    showEnums: true,
                                    showConstructors: true,
                                    showDeprecated: true,
                                    showEnumMembers: true,
                                    showKeywords: true,
                                  },
                                }}
                              />
                            </div>
                          </FormControl>
                          {validation.error && !validation.isValid && <FormMessage>{validation.error}</FormMessage>}
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Form: Core display name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('coreConfigModal.name')}</FormLabel>
                        <FormControl>
                          <Input isError={!!form.formState.errors.name} placeholder={t('coreConfigModal.namePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Form: Fallback inbound selectors */}
                  <FormField
                    control={form.control}
                    name="fallback_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('coreConfigModal.fallback')}</FormLabel>
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            {field.value && field.value.length > 0 ? (
                              field.value.map((tag: string) => (
                                <span key={tag} className="flex items-center gap-2 rounded-md bg-muted/80 px-2 py-1 text-sm">
                                  {tag}
                                  <button type="button" className="hover:text-destructive" onClick={() => field.onChange((field.value || []).filter((t: string) => t !== tag))}>
                                    ×
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">{t('coreConfigModal.selectFallback')}</span>
                            )}
                          </div>
                          <Select
                            value={undefined}
                            onValueChange={(value: string) => {
                              if (!value || value.trim() === '') return
                              const currentValue = field.value || []
                              if (!currentValue.includes(value)) {
                                field.onChange([...currentValue, value])
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('coreConfigModal.selectFallback')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {inboundTags.length > 0 ? (
                                inboundTags.map(tag => (
                                  <SelectItem key={tag} value={tag} disabled={field.value?.includes(tag)} className="cursor-pointer">
                                    {tag}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem key="no-inbounds" value="no-inbounds" disabled>
                                  {t('coreConfigModal.noInboundsFound')}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {field.value && field.value.length > 0 && (
                            <Button type="button" variant="outline" size="sm" onClick={() => field.onChange([])} className="w-full">
                              {t('coreConfigModal.clearAllFallbacks')}
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Form: Excluded inbound selectors */}
                  <FormField
                    control={form.control}
                    name="excluded_inbound_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('coreConfigModal.excludedInbound')}</FormLabel>
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            {field.value && field.value.length > 0 ? (
                              field.value.map((tag: string) => (
                                <span key={tag} className="flex items-center gap-2 rounded-md bg-muted/80 px-2 py-1 text-sm">
                                  {tag}
                                  <button type="button" className="hover:text-destructive" onClick={() => field.onChange((field.value || []).filter((t: string) => t !== tag))}>
                                    ×
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">{t('coreConfigModal.selectInbound')}</span>
                            )}
                          </div>
                          <Select
                            value={undefined}
                            onValueChange={(value: string) => {
                              if (!value || value.trim() === '') return
                              const currentValue = field.value || []
                              if (!currentValue.includes(value)) {
                                field.onChange([...currentValue, value])
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('coreConfigModal.selectInbound')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {inboundTags.length > 0 ? (
                                inboundTags.map(tag => (
                                  <SelectItem key={tag} value={tag} disabled={field.value?.includes(tag)} className="cursor-pointer">
                                    {tag}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem key="no-inbounds" value="no-inbounds" disabled>
                                  {t('coreConfigModal.noInboundsFound')}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {field.value && field.value.length > 0 && (
                            <Button type="button" variant="outline" size="sm" onClick={() => field.onChange([])} className="w-full">
                              {t('coreConfigModal.clearAllExcluded')}
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4 pt-4">
                    <LoaderButton type="button" onClick={generatePrivateAndPublicKey} className="w-full" isLoading={isGeneratingKeyPair} loadingText={t('coreConfigModal.generatingKeyPair')}>
                      {t('coreConfigModal.generateKeyPair')}
                    </LoaderButton>

                    {keyPair && (
                      <div className="relative rounded-md border p-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn('absolute top-2 h-6 w-6', dir === 'rtl' ? 'left-2' : 'right-2')}
                          onClick={() => setKeyPair(null)}
                          aria-label={t('close')}
                        >
                          <X className="h-4 w-4" />
                        </Button>

                        <div className="space-y-3">
                          <div>
                            <p className="mb-1 text-sm font-medium">{t('coreConfigModal.publicKey')}</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted p-2 text-sm">{keyPair.publicKey}</code>
                              <CopyButton value={keyPair.publicKey} copiedMessage="coreConfigModal.publicKeyCopied" defaultMessage="coreConfigModal.copyPublicKey" />
                            </div>
                          </div>

                          <div>
                            <p className="mb-1 text-sm font-medium">{t('coreConfigModal.privateKey')}</p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted p-2 text-sm">{keyPair.privateKey}</code>
                              <CopyButton value={keyPair.privateKey} copiedMessage="coreConfigModal.privateKeyCopied" defaultMessage="coreConfigModal.copyPrivateKey" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <LoaderButton type="button" onClick={generateShortId} className="w-full" isLoading={isGeneratingShortId} loadingText={t('coreConfigModal.generatingShortId')}>
                      {t('coreConfigModal.generateShortId')}
                    </LoaderButton>
                  </div>

                  {generatedShortId && (
                    <div className="relative mt-4 rounded-md border p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn('absolute top-2 h-6 w-6', dir === 'rtl' ? 'left-2' : 'right-2')}
                        onClick={() => setGeneratedShortId(null)}
                        aria-label={t('close')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <p className="mb-1 text-sm font-medium">{t('coreConfigModal.shortId')}</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted p-2 text-sm">{generatedShortId}</code>
                        <CopyButton value={generatedShortId} copiedMessage="coreConfigModal.shortIdCopied" defaultMessage="coreConfigModal.copyShortId" />
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <LoaderButton type="button" onClick={handleGenerateMldsa65} className="w-full" isLoading={isGeneratingMldsa65} loadingText={t('coreConfigModal.generatingMldsa65')}>
                      {t('coreConfigModal.generateMldsa65')}
                    </LoaderButton>
                  </div>

                  {mldsa65Keys && (
                    <div className="relative mt-4 space-y-3 rounded-md border p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn('absolute top-2 h-6 w-6', dir === 'rtl' ? 'left-2' : 'right-2')}
                        onClick={() => setMldsa65Keys(null)}
                        aria-label={t('close')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <div className="space-y-2">
                        <div>
                          <p className="mb-1 text-sm font-medium">{t('coreConfigModal.mldsa65Seed')}</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted p-2 text-sm">{mldsa65Keys.seed}</code>
                            <CopyButton value={mldsa65Keys.seed} copiedMessage="coreConfigModal.mldsa65SeedCopied" defaultMessage="coreConfigModal.copyMldsa65Seed" />
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-sm font-medium">{t('coreConfigModal.mldsa65Verify')}</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted p-2 text-sm">{mldsa65Keys.verify}</code>
                            <CopyButton value={mldsa65Keys.verify} copiedMessage="coreConfigModal.mldsa65VerifyCopied" defaultMessage="coreConfigModal.copyMldsa65Verify" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <LoaderButton
                      type="button"
                      onClick={generateVLESSEncryption}
                      className="w-full"
                      isLoading={isGeneratingVLESSEncryption}
                      loadingText={t('coreConfigModal.generatingVLESSEncryption')}
                    >
                      {t('coreConfigModal.generateVLESSEncryption')}
                    </LoaderButton>
                  </div>

                  {vlessEncryption.x25519 && vlessEncryption.mlkem768 && (
                    <div className="relative mt-4 rounded-md border p-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn('absolute top-2 h-6 w-6', dir === 'rtl' ? 'left-2' : 'right-2')}
                        onClick={() => setVlessEncryption({ x25519: null, mlkem768: null })}
                        aria-label={t('close')}
                      >
                        <X className="h-4 w-4" />
                      </Button>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold">VLESS Encryption</h4>
                            <p className="text-xs text-muted-foreground">{t('coreConfigModal.chooseAuthentication')}</p>
                          </div>
                          <Select value={selectedVlessVariant} onValueChange={handleVlessVariantChange}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="x25519">{t('coreConfigModal.x25519Authentication')}</SelectItem>
                              <SelectItem value="mlkem768">{t('coreConfigModal.mlkem768Authentication')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {currentVlessValues && (
                          <div className="space-y-2">
                            <div>
                              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('coreConfigModal.decryption')}</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1 text-xs">{currentVlessValues.decryption}</code>
                                <CopyButton value={currentVlessValues.decryption} copiedMessage="coreConfigModal.decryptionCopied" defaultMessage="coreConfigModal.copyDecryption" />
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('coreConfigModal.encryption')}</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1 text-xs">{currentVlessValues.encryption}</code>
                                <CopyButton value={currentVlessValues.encryption} copiedMessage="coreConfigModal.encryptionCopied" defaultMessage="coreConfigModal.copyEncryption" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <LoaderButton
                      type="button"
                      onClick={e => generateShadowsocksPassword(selectedEncryptionMethod)}
                      className="w-full"
                      isLoading={isGeneratingShadowsocksPassword}
                      loadingText={t('coreConfigModal.generatingShadowsocksPassword')}
                    >
                      {t('coreConfigModal.generateShadowsocksPassword')}
                    </LoaderButton>
                  </div>

                  {generatedShadowsocksPassword && (
                    <div className="relative mt-4 rounded-md border p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn('absolute top-2 h-6 w-6', dir === 'rtl' ? 'left-2' : 'right-2')}
                        onClick={() => setGeneratedShadowsocksPassword(null)}
                        aria-label={t('close')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <div className="space-y-3">
                        <div>
                          <p className="mb-1 text-sm font-medium">{t('coreConfigModal.selectEncryptionMethod')}</p>
                          <Select
                            value={selectedEncryptionMethod}
                            onValueChange={value => {
                              setSelectedEncryptionMethod(value)
                              generateShadowsocksPassword(value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SHADOWSOCKS_ENCRYPTION_METHODS.map(method => (
                                <SelectItem key={method.value} value={method.value}>
                                  {method.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="mb-1 text-sm font-medium">{t('coreConfigModal.shadowsocksPassword')}</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted p-2 text-sm">{generatedShadowsocksPassword}</code>
                            <CopyButton value={generatedShadowsocksPassword} copiedMessage="coreConfigModal.shadowsocksPasswordCopied" defaultMessage="coreConfigModal.copyShadowsocksPassword" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Form: Restart nodes toggle */}
            {!isEditorFullscreen && (
              <div className="flex flex-col gap-2">
                {editingCore && (
                  <FormField
                    control={form.control}
                    name="restart_nodes"
                    render={({ field }) => (
                      <FormItem className={'mb-2 flex flex-row-reverse items-center gap-2'}>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!m-0 text-sm">{t('coreConfigModal.restartNodes')}</FormLabel>
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createCoreMutation.isPending || modifyCoreMutation.isPending}>
                    {t('cancel')}
                  </Button>
                  <LoaderButton
                    type="submit"
                    disabled={!validation.isValid || createCoreMutation.isPending || modifyCoreMutation.isPending || form.formState.isSubmitting}
                    isLoading={createCoreMutation.isPending || modifyCoreMutation.isPending}
                    loadingText={editingCore ? t('modifying') : t('creating')}
                  >
                    {editingCore ? t('modify') : t('create')}
                  </LoaderButton>
                </div>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
