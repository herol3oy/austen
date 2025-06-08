export const copyUrlToClipboard = async (
  urlInputRef: React.RefObject<HTMLInputElement | null>,
  setUrlCopied: (value: boolean) => void,
) => {
  if (urlInputRef.current) {
    urlInputRef.current.select()
    await navigator.clipboard.writeText(urlInputRef.current.value)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
  }
}
