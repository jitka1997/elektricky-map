/**
 * Save data as a JSON file. On iOS, plain downloads are unreliable inside an
 * installed web app, so use the share sheet ("Save to Files"); elsewhere, a
 * normal browser download.
 */
export const saveJsonFile = async (data: unknown, filename: string) => {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const file = new File([blob], filename, { type: 'application/json' })

  if (isIOS && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename })
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
