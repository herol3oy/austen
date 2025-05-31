'use client'

// eslint-disable-next-line simple-import-sort/imports
import Prism from 'prismjs'
import 'prismjs/components/prism-mermaid'
import 'prismjs/themes/prism-coy.min.css'

import type { User } from '@supabase/supabase-js'
import domtoimage from 'dom-to-image'
import { Code2 } from 'lucide-react'
import { Copy } from 'lucide-react'
import { Edit2 } from 'lucide-react'
import { Globe2 } from 'lucide-react'
import { Info } from 'lucide-react'
import { Lock } from 'lucide-react'
import { Share2 } from 'lucide-react'
import mermaid from 'mermaid'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { saveGraph } from '@/app/actions/save-graph'
import { EditGraphDialog } from '@/components/EditGraphDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { MermaidGraphProps } from '@/types/mermaid-graph-props'

export function MermaidGraphCard({
  graphDefinition,
  emojis,
  title,
  author,
  graphId,
  isShared = false,
}: MermaidGraphProps) {
  const graphRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef<HTMLElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [svgContent, setSvgContent] = useState<string>('')
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [isUrlCopied, setIsUrlCopied] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [user, setUser] = useState<User | null>(null)
  const [shareUrl, setShareUrl] = useState<string>('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [currentGraphDefinition, setCurrentGraphDefinition] =
    useState<string>(graphDefinition)
  const [isPublicGraph, setIsPublicGraph] = useState(false)

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

  useEffect(() => {
    if (graphId) {
      setShareUrl(`${window.location.origin}/share/${graphId}`)
    }
  }, [graphId])

  const getFileName = () => {
    return `austen-pages.dev-${title?.toLowerCase().replace(/\s+/g, '-')}-${author?.toLowerCase().replace(/\s+/g, '-')}-graph`
  }

  const downloadSvg = () => {
    if (!svgContent) return

    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${getFileName()}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const downloadPng = async () => {
    if (!graphRef.current) return

    try {
      const dataUrl = await domtoimage.toPng(graphRef.current)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${getFileName()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error generating PNG:', error)
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

  const handleCopyUrl = async () => {
    urlInputRef.current?.select()
    await navigator.clipboard.writeText(shareUrl)
    setIsUrlCopied(true)
    setTimeout(() => setIsUrlCopied(false), 2000)
  }

  const handleInputClick = async (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select()
    await navigator.clipboard.writeText(shareUrl)
    setIsUrlCopied(true)
    setTimeout(() => setIsUrlCopied(false), 2000)
  }

  const copyMermaidSyntax = async () => {
    try {
      await navigator.clipboard.writeText(graphDefinition)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy syntax:', error)
    }
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
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current)
    }
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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-lg shadow-gray-100/50 transition-all duration-200 hover:shadow-xl hover:shadow-gray-100/60">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                  {title}
                </h2>
                {emojis && (
                  <span className="text-2xl opacity-80">{emojis}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-medium text-white">
                  {author.charAt(0)}
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
                        onClick={downloadSvg}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                      >
                        Download SVG
                      </Button>
                      <Button
                        onClick={downloadPng}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                      >
                        Download PNG
                      </Button>
                    </div>

                    {user ? (
                      <div className="flex items-center gap-3">
                        {!isShared && (
                          <Button
                            onClick={handleSaveGraph}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving ? 'Saving...' : 'Save Graph'}
                          </Button>
                        )}

                        {graphId && (
                          <>
                            <Button
                              onClick={() => setIsEditDialogOpen(true)}
                              variant="outline"
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                            >
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit Graph
                            </Button>

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
                          </>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => (window.location.href = '/auth/login')}
                        variant="outline"
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition-all hover:bg-blue-100 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                      >
                        Login to Save
                      </Button>
                    )}
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
                    onClick={handleCopyUrl}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                      isUrlCopied
                        ? 'border-green-600 bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
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
                  onClick={copyMermaidSyntax}
                  variant="outline"
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                    isCopied
                      ? 'border-green-600 bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500'
                  }`}
                >
                  <Copy className="h-4 w-4" />
                  {isCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>

              <div className="relative">
                <pre
                  suppressHydrationWarning
                  className="language-mermaid overflow-x-auto rounded bg-gray-50 p-4 text-sm"
                  data-prismjs-copy="Copy"
                >
                  <code ref={codeRef} className="language-mermaid">
                    {currentGraphDefinition}
                  </code>
                </pre>
              </div>
            </div>
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
