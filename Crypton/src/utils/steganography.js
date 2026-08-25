const MAGIC = 'CRYPTON1'
const MAGIC_BYTES = new TextEncoder().encode(MAGIC)

const SALT_LENGTH = 16
const IV_LENGTH = 12
const PBKDF2_ITERATIONS = 250000

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function concatBytes(...arrays) {
  const totalLength = arrays.reduce(
    (total, array) => total + array.length,
    0
  )

  const result = new Uint8Array(totalLength)

  let offset = 0

  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }

  return result
}

function numberToBytes(number) {
  const bytes = new Uint8Array(4)

  bytes[0] = (number >>> 24) & 0xff
  bytes[1] = (number >>> 16) & 0xff
  bytes[2] = (number >>> 8) & 0xff
  bytes[3] = number & 0xff

  return bytes
}

function bytesToNumber(bytes) {
  return (
    ((bytes[0] << 24) >>> 0) +
    ((bytes[1] << 16) >>> 0) +
    ((bytes[2] << 8) >>> 0) +
    bytes[3]
  )
}

function bytesToBase64(bytes) {
  let binary = ''

  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(
      i,
      Math.min(i + chunkSize, bytes.length)
    )

    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

async function deriveKey(password, salt) {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptPayload(payloadBytes, password) {
  const salt = crypto.getRandomValues(
    new Uint8Array(SALT_LENGTH)
  )

  const iv = crypto.getRandomValues(
    new Uint8Array(IV_LENGTH)
  )

  const key = await deriveKey(password, salt)

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    payloadBytes
  )

  const encryptedBytes = new Uint8Array(encryptedBuffer)

  return concatBytes(
    salt,
    iv,
    encryptedBytes
  )
}

async function decryptPayload(encryptedBytes, password) {
  if (
    encryptedBytes.length <
    SALT_LENGTH + IV_LENGTH + 16
  ) {
    throw new Error('Invalid or incomplete encrypted payload.')
  }

  const salt = encryptedBytes.slice(
    0,
    SALT_LENGTH
  )

  const iv = encryptedBytes.slice(
    SALT_LENGTH,
    SALT_LENGTH + IV_LENGTH
  )

  const ciphertext = encryptedBytes.slice(
    SALT_LENGTH + IV_LENGTH
  )

  const key = await deriveKey(password, salt)

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    )

    return new Uint8Array(decryptedBuffer)
  } catch {
    throw new Error(
      'Unable to decrypt hidden data. The password may be incorrect or the image has been modified.'
    )
  }
}

async function createPayload({
  type,
  text,
  file,
}) {
  if (type === 'text') {
    const metadata = {
      version: 1,
      type: 'text',
      text,
    }

    return encoder.encode(
      JSON.stringify(metadata)
    )
  }

  if (!file) {
    throw new Error(
      'No file was provided for the hidden payload.'
    )
  }

  const fileBuffer = await file.arrayBuffer()

  const metadata = {
    version: 1,
    type: 'file',
    fileName: file.name,
    mimeType: file.type ||
      'application/octet-stream',
    data: bytesToBase64(
      new Uint8Array(fileBuffer)
    ),
  }

  return encoder.encode(
    JSON.stringify(metadata)
  )
}

async function parsePayload(bytes) {
  let payload

  try {
    payload = JSON.parse(
      decoder.decode(bytes)
    )
  } catch {
    throw new Error(
      'Recovered payload could not be interpreted.'
    )
  }

  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    throw new Error(
      'Recovered payload has an invalid format.'
    )
  }

  if (payload.version !== 1) {
    throw new Error(
      'This hidden payload uses an unsupported Crypton format.'
    )
  }

  if (payload.type === 'text') {
    return {
      type: 'text',
      text: payload.text || '',
    }
  }

  if (payload.type === 'file') {
    if (!payload.data) {
      throw new Error(
        'Recovered file payload is incomplete.'
      )
    }

    return {
      type: 'file',
      fileName:
        payload.fileName || 'crypton-recovered-file',
      mimeType:
        payload.mimeType ||
        'application/octet-stream',
      data: base64ToBytes(payload.data),
    }
  }

  throw new Error(
    'Recovered payload type is not supported.'
  )
}

function calculateCapacity(width, height) {
  // We use one least-significant bit from
  // each RGB channel.
  //
  // 3 usable bits per pixel.
  // 8 bits required per stored byte.
  return Math.floor(
    (width * height * 3) / 8
  )
}

function imageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      const canvas = document.createElement('canvas')

      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const context = canvas.getContext(
        '2d',
        {
          willReadFrequently: true,
        }
      )

      if (!context) {
        URL.revokeObjectURL(url)

        reject(
          new Error(
            'Canvas processing is unavailable in this browser.'
          )
        )

        return
      }

      context.drawImage(image, 0, 0)

      URL.revokeObjectURL(url)

      resolve({
        canvas,
        context,
        width: canvas.width,
        height: canvas.height,
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)

      reject(
        new Error(
          'The selected image could not be processed.'
        )
      )
    }

    image.src = url
  })
}

function embedBytes(imageData, bytes) {
  const pixels = imageData.data

  const totalBits = bytes.length * 8

  if (totalBits > Math.floor(pixels.length / 4) * 3) {
    throw new Error(
      'The carrier image does not have enough capacity for this encrypted payload.'
    )
  }

  let bitIndex = 0

  for (
    let pixelIndex = 0;
    pixelIndex < pixels.length &&
    bitIndex < totalBits;
    pixelIndex += 4
  ) {
    for (
      let channel = 0;
      channel < 3 &&
      bitIndex < totalBits;
      channel++
    ) {
      const byteIndex = Math.floor(
        bitIndex / 8
      )

      const bitPosition =
        7 - (bitIndex % 8)

      const bit =
        (bytes[byteIndex] >>
          bitPosition) &
        1

      pixels[pixelIndex + channel] =
        (pixels[pixelIndex + channel] &
          0xfe) |
        bit

      bitIndex++
    }
  }

  return imageData
}

function extractBytes(imageData, byteCount) {
  const pixels = imageData.data

  const requiredBits = byteCount * 8
  const availableBits =
    Math.floor(pixels.length / 4) * 3

  if (requiredBits > availableBits) {
    throw new Error(
      'The hidden payload exceeds the available image data.'
    )
  }

  const result = new Uint8Array(byteCount)

  let bitIndex = 0

  for (
    let pixelIndex = 0;
    pixelIndex < pixels.length &&
    bitIndex < requiredBits;
    pixelIndex += 4
  ) {
    for (
      let channel = 0;
      channel < 3 &&
      bitIndex < requiredBits;
      channel++
    ) {
      const bit =
        pixels[pixelIndex + channel] & 1

      const byteIndex = Math.floor(
        bitIndex / 8
      )

      const bitPosition =
        7 - (bitIndex % 8)

      result[byteIndex] |=
        bit << bitPosition

      bitIndex++
    }
  }

  return result
}

function hasValidMagic(bytes) {
  if (bytes.length < MAGIC_BYTES.length) {
    return false
  }

  for (
    let i = 0;
    i < MAGIC_BYTES.length;
    i++
  ) {
    if (
      bytes[i] !== MAGIC_BYTES[i]
    ) {
      return false
    }
  }

  return true
}

export async function hideDataInImage({
  carrierFile,
  payloadType,
  text,
  file,
  password,
}) {
  if (!carrierFile) {
    throw new Error(
      'A carrier image is required.'
    )
  }

  if (!password) {
    throw new Error(
      'A recovery password is required.'
    )
  }

  const {
    canvas,
    context,
    width,
    height,
  } = await imageToCanvas(
    carrierFile
  )

  const rawPayload = await createPayload({
    type: payloadType,
    text,
    file,
  })

  const encryptedPayload =
    await encryptPayload(
      rawPayload,
      password
    )

  // Final image structure:
  //
  // MAGIC
  // 8 bytes = "CRYPTON1"
  //
  // LENGTH
  // 4 bytes = encrypted payload length
  //
  // PAYLOAD
  // encrypted bytes

  const payloadLength = numberToBytes(
    encryptedPayload.length
  )

  const finalBytes = concatBytes(
    MAGIC_BYTES,
    payloadLength,
    encryptedPayload
  )

  const capacity = calculateCapacity(
    width,
    height
  )

  if (finalBytes.length > capacity) {
    throw new Error(
      `Carrier image capacity is too small. Required: ${(
        finalBytes.length / 1024
      ).toFixed(
        1
      )} KB. Available: ${(
        capacity / 1024
      ).toFixed(1)} KB.`
    )
  }

  const imageData = context.getImageData(
    0,
    0,
    width,
    height
  )

  const modifiedImageData = embedBytes(
    imageData,
    finalBytes
  )

  context.putImageData(
    modifiedImageData,
    0,
    0
  )

  const blob = await new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result)
          } else {
            reject(
              new Error(
                'Unable to generate the hidden PNG.'
              )
            )
          }
        },
        'image/png'
      )
    }
  )

  return {
    blob,
    fileName: 'CRYPTON-HIDDEN.png',
    width,
    height,
    capacity,
    payloadSize: finalBytes.length,
  }
}

export async function recoverDataFromImage({
  imageFile,
  password,
}) {
  if (!imageFile) {
    throw new Error(
      'A hidden image is required.'
    )
  }

  if (!password) {
    throw new Error(
      'A recovery password is required.'
    )
  }

  const {
    context,
    width,
    height,
  } = await imageToCanvas(
    imageFile
  )

  const capacity = calculateCapacity(
    width,
    height
  )

  const minimumHeaderLength =
    MAGIC_BYTES.length + 4

  if (capacity < minimumHeaderLength) {
    throw new Error(
      'This image is too small to contain a Crypton payload.'
    )
  }

  const imageData = context.getImageData(
    0,
    0,
    width,
    height
  )

  const headerBytes = extractBytes(
    imageData,
    minimumHeaderLength
  )

  const magic = headerBytes.slice(
    0,
    MAGIC_BYTES.length
  )

  if (!hasValidMagic(magic)) {
    throw new Error(
      'No Crypton hidden payload was detected in this image.'
    )
  }

  const encryptedLength = bytesToNumber(
    headerBytes.slice(
      MAGIC_BYTES.length,
      MAGIC_BYTES.length + 4
    )
  )

  if (
    encryptedLength <= 0 ||
    encryptedLength >
      capacity - minimumHeaderLength
  ) {
    throw new Error(
      'The Crypton payload length is invalid or the image has been altered.'
    )
  }

  const completeBytes = extractBytes(
    imageData,
    minimumHeaderLength +
      encryptedLength
  )

  const encryptedPayload =
    completeBytes.slice(
      minimumHeaderLength
    )

  const decryptedBytes =
    await decryptPayload(
      encryptedPayload,
      password
    )

  return parsePayload(
    decryptedBytes
  )
}