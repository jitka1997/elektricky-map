/**
 * Read an image file and return it as a small, square (center-cropped) JPEG
 * data URL — small enough (~10–20 KB) to store directly on the user's
 * Firestore doc as their avatar.
 */
export const resizeImageToDataUrl = (
  file: File,
  size = 160,
  quality = 0.85
): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Your browser cannot process images'))
        return
      }
      // White backdrop so transparent PNGs don't turn black as JPEG.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      )
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
