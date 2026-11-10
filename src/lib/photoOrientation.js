export function photoRotation(row) {
  const degrees = Number(row.foto_datos_extraidos?.rotation_degrees ?? row.extracted_data?.rotation_degrees ?? 0)
  return [90, 180, 270].includes(degrees) ? degrees : 0
}

export async function orientedPhotoBlob(blob, degrees) {
  if (!degrees) return blob
  const image = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    const sideways = degrees === 90 || degrees === 270
    canvas.width = sideways ? image.height : image.width
    canvas.height = sideways ? image.width : image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo orientar la imagen.')
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate(degrees * Math.PI / 180)
    context.drawImage(image, -image.width / 2, -image.height / 2)
    return await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo orientar la imagen.')), 'image/webp', 0.95))
  } finally {
    image.close()
  }
}
