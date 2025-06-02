export interface EditGraphDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (syntax: string) => Promise<void>
  initialSyntax: string
  bookTitle: string
}
