'use client'

import type { User } from '@supabase/supabase-js'
import {
  Code2,
  Copy,
  Download,
  Edit2,
  Globe2,
  Info,
  Lock,
  Pencil,
  Share2,
} from 'lucide-react'
import mermaid from 'mermaid'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { saveGraph } from '@/app/actions/save-graph'
import { DeleteGraphDialog } from '@/components/DeleteGraphDialog'
import { EditGraphDialog } from '@/components/EditGraphDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { MermaidGraphProps } from '@/types/mermaid-graph-props'
import { copyMermaidToClipboard } from '@/utils/copy-mermaid-syntax'
import { copyUrlToClipboard } from '@/utils/copy-url'
import { exportGraphAsPng } from '@/utils/download-png'
import { exportGraphAsSvg } from '@/utils/download-svg'
import { highlighter } from '@/utils/highlighter'

export function GraphCard({
  graphDefinition,
  emojis,
  title,
  author,
  graphId,
  isShared = false,
  isPublic = false,
  userId,
}: MermaidGraphProps) {
  const [svgContent, setSvgContent] = useState<string>('')
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [isUrlCopied, setIsUrlCopied] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [user, setUser] = useState<User | null>(null)
  const [shareUrl, setShareUrl] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [isPublicGraph, setIsPublicGraph] = useState<boolean>(isPublic)
  const [currentGraphDefinition, setCurrentGraphDefinition] =
    useState<string>(graphDefinition)

  const graphRef = useRef<HTMLDivElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (graphId) {
      setShareUrl(`${window.location.origin}/share/${graphId}`)
    }
  }, [graphId])

  useEffect(() => {
    const renderGraph = async () => {
      if (graphRef.current) {
        graphRef.current.innerHTML = ''

        try {
          await mermaid.initialize({
            startOnLoad: true,
            securityLevel: 'strict',
            theme: 'forest',
            look: 'handDrawn',
          })

          const graphId = `graph_${crypto.randomUUID()}`
          const { svg } = await mermaid.render(graphId, currentGraphDefinition)

          graphRef.current.innerHTML = svg
          setSvgContent(svg)
        } catch (error) {
          console.error('Error rendering graph:', error)
          graphRef.current.innerHTML = `
            <div class="p-4 text-red-600">
              Failed to render graph. Please check the syntax.
            </div>`
        }
      }
    }

    renderGraph()
  }, [currentGraphDefinition])

  useEffect(() => {
    const supabase = createClient()

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleDownloadSvg = () => {
    if (!user) {
      toast.error('Log in to download svg file')
      return
    }
    if (!svgContent) return
    exportGraphAsSvg(svgContent, title || 'untitled', author || 'unknown')
  }

  const handleDownloadPng = () => {
    if (!svgContent) return
    exportGraphAsPng(graphRef, title || 'untitled', author || 'unknown')
  }

  const handleTogglePublic = async () => {
    if (!graphId || !user) return

    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('graphs')
        .update({ is_public: !isPublicGraph })
        .eq('id', graphId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      setIsPublicGraph(!isPublicGraph)
    } catch (error) {
      console.log('Error toggling graph visibility:', error)
    }
  }

  const handleSaveGraph = async () => {
    if (!svgContent) return

    setIsSaving(true)
    try {
      await saveGraph({
        bookName: title,
        authorName: author,
        svgGraph: svgContent,
        mermaidSyntax: graphDefinition,
        emojis,
      })
    } catch (error) {
      console.error('Error saving graph:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyUrlClick = async () => {
    await copyUrlToClipboard(urlInputRef, setIsUrlCopied)
  }

  const handleInputClick = async (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select()
    await navigator.clipboard.writeText(shareUrl)
    setIsUrlCopied(true)
    setTimeout(() => setIsUrlCopied(false), 2000)
  }

  const handleCopyMermaidSyntax = async () => {
    await copyMermaidToClipboard(currentGraphDefinition, setIsCopied)
  }

  const handleUpdateGraph = async (newSyntax: string) => {
    if (!graphId || !user) return

    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('graphs')
        .update({ mermaid_syntax: newSyntax })
        .eq('id', graphId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      setCurrentGraphDefinition(newSyntax)
    } catch (error) {
      console.error('Error updating graph:', error)
    }
  }

  const highlightedHtml = highlighter.codeToHtml(
    '```mermaid\n' + currentGraphDefinition + '\n```',
    {
      theme: 'light-plus',
      lang: 'mermaid',
    },
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-lg shadow-gray-100/50 transition-all duration-200 hover:shadow-xl hover:shadow-gray-100/60">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white px-8 py-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                {title}
              </h2>
              {emojis && <span className="text-2xl opacity-80">{emojis}</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-medium text-white">
                <Pencil className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-medium text-gray-600">by {author}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPublicGraph ? (
              <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
                <Globe2 className="h-3.5 w-3.5" />
                Public
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">
                <Lock className="h-3.5 w-3.5" />
                Private
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="space-y-8">
          <div className="relative">
            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-gray-200 bg-gray-50/30 p-6">
              <div ref={graphRef} className="w-full" />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {svgContent && (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleDownloadSvg}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                    >
                      <Download className="h-4 w-4" />
                      Download SVG
                    </Button>
                    <Button
                      onClick={handleDownloadPng}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                    >
                      <Download className="h-4 w-4" />
                      Download PNG
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    {!isShared && (
                      <Button
                        onClick={() => {
                          if (!user) {
                            toast.error('Log in to share the graph')
                            return
                          }
                          handleSaveGraph()
                        }}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Share2 className="h-4 w-4" />
                        {isSaving ? 'Creating link...' : 'Share'}
                      </Button>
                    )}

                    {graphId && (
                      <>
                        <Button
                          onClick={() => {
                            if (!user) {
                              toast.error('Log in to edit the graph')
                              return
                            }
                            setIsEditDialogOpen(true)
                          }}
                          variant="outline"
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit Graph
                        </Button>

                        {user && user.id === userId && (
                          <DeleteGraphDialog
                            graphId={graphId}
                            graphTitle={title}
                          />
                        )}

                        {user && (
                          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-2.5">
                            <Label
                              htmlFor={`public-mode-${graphId}`}
                              className="text-sm font-medium text-gray-700"
                            >
                              Visibility:
                            </Label>
                            <Switch
                              id={`public-mode-${graphId}`}
                              checked={isPublicGraph}
                              onCheckedChange={handleTogglePublic}
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300"
                            />
                            <Label
                              htmlFor={`public-mode-${graphId}`}
                              className="flex items-center text-sm font-medium text-gray-700"
                            >
                              {isPublicGraph ? (
                                <>
                                  <Globe2 className="mr-1 h-4 w-4" />
                                  Public
                                </>
                              ) : (
                                <>
                                  <Lock className="mr-1 h-4 w-4" />
                                  Private
                                </>
                              )}
                            </Label>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {graphId && (
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50/50 to-white p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Share2 className="h-5 w-5 text-gray-600" />
                Share this graph
              </h3>
              <div className="flex items-center gap-3">
                <Input
                  ref={urlInputRef}
                  readOnly
                  value={shareUrl}
                  onClick={handleInputClick}
                  className="flex-1 cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-700 shadow-sm transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
                <Button
                  variant="outline"
                  onClick={handleCopyUrlClick}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                    isUrlCopied
                      ? 'border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white focus:ring-green-500'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500'
                  }`}
                >
                  <Copy className="h-4 w-4" />
                  {isUrlCopied ? 'Copied!' : 'Copy URL'}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50/50 to-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Code2 className="h-5 w-5 text-gray-600" />
                Mermaid Syntax
                <Link
                  href="https://mermaid.js.org/intro/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative"
                  title="Learn more about Mermaid"
                >
                  <Info className="h-5 w-5 text-gray-600 hover:text-gray-800" />
                </Link>
              </h3>
              <Button
                onClick={handleCopyMermaidSyntax}
                variant="outline"
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                  isCopied
                    ? 'border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white focus:ring-green-500'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500'
                }`}
              >
                <Copy className="h-4 w-4" />
                {isCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            <div
              className="overflow-x-auto rounded p-4 text-left text-sm"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </div>
        </div>
      </div>

      <EditGraphDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={handleUpdateGraph}
        initialSyntax={currentGraphDefinition}
        bookTitle={title}
      />
    </div>
  )
}
