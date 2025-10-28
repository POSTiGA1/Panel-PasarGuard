import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Node from '@/components/nodes/Node'
import { useGetNodes, useModifyNode, NodeResponse, NodeConnectionType } from '@/service/api'
import { toast } from 'sonner'
import { queryClient } from '@/utils/query-client'
import NodeModal from '@/components/dialogs/NodeModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { nodeFormSchema, NodeFormValues } from '@/components/dialogs/NodeModal'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const initialDefaultValues: Partial<NodeFormValues> = {
  name: '',
  address: '',
  port: 62050,
  usage_coefficient: 1,
  connection_type: NodeConnectionType.grpc,
  server_ca: '',
  keep_alive: 20000,
  max_logs: 100,
}

export default function Nodes() {
  const { t } = useTranslation()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<NodeResponse | null>(null)
  const modifyNodeMutation = useModifyNode()

  const { data: nodesData, isLoading } = useGetNodes(undefined, {
    query: {
      refetchInterval: 5000, // 5s
      staleTime: 0, // No stale time - always fetch fresh data
      gcTime: 0, // No garbage collection time - no caching
    },
  })

  const form = useForm<NodeFormValues>({
    resolver: zodResolver(nodeFormSchema),
    defaultValues: initialDefaultValues,
  })

  useEffect(() => {
    const handleOpenDialog = () => setIsDialogOpen(true)
    window.addEventListener('openNodeDialog', handleOpenDialog)
    return () => window.removeEventListener('openNodeDialog', handleOpenDialog)
  }, [])

  const handleEdit = (node: NodeResponse) => {
    setEditingNode(node)
    form.reset({
      name: node.name,
      address: node.address,
      port: node.port || 62050,
      usage_coefficient: node.usage_coefficient || 1,
      connection_type: node.connection_type,
      server_ca: node.server_ca,
      keep_alive: node.keep_alive,
      max_logs: node.max_logs,
    })
    setIsDialogOpen(true)
  }

  const handleToggleStatus = async (node: NodeResponse) => {
    try {
      // Determine the new status: enable if currently disabled, otherwise disable
      const shouldEnable = node.status === 'disabled'
      const newStatus = shouldEnable ? 'connected' : 'disabled'

      await modifyNodeMutation.mutateAsync({
        nodeId: node.id,
        data: {
          name: node.name,
          address: node.address,
          port: node.port,
          usage_coefficient: node.usage_coefficient,
          connection_type: node.connection_type,
          server_ca: node.server_ca,
          keep_alive: node.keep_alive,
          max_logs: node.max_logs,
          status: newStatus,
        },
      })

      toast.success(t('success', { defaultValue: 'Success' }), {
        description: t(shouldEnable ? 'nodes.enableSuccess' : 'nodes.disableSuccess', {
          name: node.name,
          defaultValue: `Node "{name}" has been ${shouldEnable ? 'enabled' : 'disabled'} successfully`,
        }),
      })

      // Invalidate nodes queries
      queryClient.invalidateQueries({
        queryKey: ['/api/nodes'],
      })
    } catch (error) {
      toast.error(t('error', { defaultValue: 'Error' }), {
        description: t(node.status === 'disabled' ? 'nodes.enableFailed' : 'nodes.disableFailed', {
          name: node.name,
          defaultValue: `Failed to ${node.status === 'disabled' ? 'enable' : 'disable'} node "{name}"`,
        }),
      })
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="w-full flex-1 space-y-4 pt-6">
        <div
          className="mb-12 grid transform-gpu animate-slide-up grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}
        >
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24 sm:w-32" />
                    <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-20 sm:w-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 w-8 shrink-0" />
                  </div>
                </div>
              </Card>
            ))
          ) : (
            nodesData?.map(node => <Node key={node.id} node={node} onEdit={handleEdit} onToggleStatus={handleToggleStatus} />)
          )}
        </div>

        {!isLoading && (!nodesData || nodesData.length === 0) && (
          <Card className="mb-12">
            <CardContent className="p-8 text-center">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('nodes.noNodes')}</h3>
                <p className="mx-auto max-w-2xl text-muted-foreground">
                  {t('nodes.noNodesDescription')}{' '}
                  <a href="https://github.com/PasarGuard/node" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                    PasarGuard/node
                  </a>{' '}
                  {t('nodes.noNodesDescription2', { defaultValue: 'and connect it to the panel.' })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <NodeModal
          isDialogOpen={isDialogOpen}
          onOpenChange={open => {
            if (!open) {
              setEditingNode(null)
              form.reset(initialDefaultValues)
            }
            setIsDialogOpen(open)
          }}
          form={form}
          editingNode={!!editingNode}
          editingNodeId={editingNode?.id}
        />
      </div>
    </div>
  )
}
