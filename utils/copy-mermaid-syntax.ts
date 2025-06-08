export const copyMermaidToClipboard = async (
  graphDefinition: string,
  setIsCopied: (value: boolean) => void,
) => {
  try {
    await navigator.clipboard.writeText(graphDefinition)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  } catch (error) {
    console.error('Failed to copy syntax:', error)
  }
}
