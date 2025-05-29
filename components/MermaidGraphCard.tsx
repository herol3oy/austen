'use client'

// eslint-disable-next-line simple-import-sort/imports
import Prism from 'prismjs'
import 'prismjs/components/prism-mermaid'
import 'prismjs/themes/prism-coy.min.css'

import type { User } from '@supabase/supabase-js'
import domtoimage from 'dom-to-image'
import { Copy, Edit2, Globe2, Lock } from 'lucide-react'
import mermaid from 'mermaid'
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
        emojis: emojis,
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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
      <div className="mb-4 border-b pb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">by {author}</p>
      </div>

      <div className="space-y-4">
        <div>
          <div ref={graphRef} />
          <div className="ml-4 flex gap-2">
            {svgContent && (
              <>
                <Button onClick={downloadSvg}>Download SVG</Button>
                <Button onClick={downloadPng}>Download PNG</Button>
                {user ? (
                  <>
                    <Button onClick={handleSaveGraph} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Graph'}
                    </Button>
                    {graphId && (
                      <>
                        <Button
                          onClick={() => setIsEditDialogOpen(true)}
                          variant="outline"
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit Graph
                        </Button>
                        <div className="ml-4 flex items-center space-x-2">
                          <Switch
                            id={`public-mode-${graphId}`}
                            checked={isPublicGraph}
                            onCheckedChange={handleTogglePublic}
                          />
                          <Label
                            htmlFor={`public-mode-${graphId}`}
                            className="flex items-center"
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
                  </>
                ) : (
                  <Button
                    onClick={() => (window.location.href = '/auth/login')}
                    variant="outline"
                  >
                    Login to Save
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">Mermaid Syntax:</h3>{' '}
          <Button onClick={copyMermaidSyntax} variant="outline">
            <Copy className="h-4 w-4" />
            {isCopied ? 'Copied!' : 'Copy Syntax'}
          </Button>
        </div>

        {graphId && (
          <div className="flex items-center gap-2">
            <Input
              ref={urlInputRef}
              readOnly
              value={shareUrl}
              className="cursor-pointer font-mono text-sm"
              onClick={handleInputClick}
            />
            <Button variant="outline" onClick={handleCopyUrl} className="gap-2">
              <Copy className="h-4 w-4" />
              {isUrlCopied ? 'Copied!' : 'Copy URL'}
            </Button>
          </div>
        )}

        <pre
          suppressHydrationWarning
          className="language-mermaid overflow-x-auto rounded bg-gray-50 p-4 text-sm"
          data-prismjs-copy="Copy"
        >
          <code ref={codeRef} className="language-mermaid">
            {currentGraphDefinition}
          </code>
        </pre>

        {emojis && (
          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-500">
              Related Emojis:
            </h3>
            <div className="text-2xl">{emojis}</div>
          </div>
        )}
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
