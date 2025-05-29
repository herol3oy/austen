'use client'

import mermaid from 'mermaid'
import { useEffect, useState } from 'react'

import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Textarea } from './ui/textarea'

interface EditGraphDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (syntax: string) => Promise<void>
  initialSyntax: string
  bookTitle: string
}

export function EditGraphDialog({
  isOpen,
  onClose,
  onSave,
  initialSyntax,
  bookTitle,
}: EditGraphDialogProps) {
  const [syntax, setSyntax] = useState(initialSyntax)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setSyntax(initialSyntax)
  }, [initialSyntax])

  const validateMermaidSyntax = async (graphSyntax: string) => {
    try {
      await mermaid.parse(graphSyntax)
      return { isValid: true, error: null }
    } catch (error) {
      console.log('Mermaid parse error:', error)
      return {
        isValid: false,
        error: 'Invalid Mermaid syntax',
      }
    }
  }

  const handleUpdateSyntaxChange = async (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setSyntax(e.target.value)
  }

  const handleUpdate = async () => {
    setIsSaving(true)
    try {
      const validation = await validateMermaidSyntax(syntax)
      if (!validation.isValid) {
        setError(validation.error)
        return
      }
      setError(null)
      await onSave(syntax)
      onClose()
    } catch (error) {
      console.log('Error saving graph:', error)
      setError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Update {bookTitle} Graph</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <Textarea
            value={syntax}
            onChange={handleUpdateSyntaxChange}
            rows={10}
            className="font-mono"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isSaving}>
            {isSaving ? 'Updating...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
