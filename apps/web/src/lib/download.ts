// Long enough for the browser to start on the file: revoked at once, some browsers save nothing.
const REVOKE_AFTER_MS = 60_000

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}
