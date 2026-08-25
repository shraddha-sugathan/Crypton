import crypto from 'crypto'
import { getRedis } from '../_redis.js'

const generateId = () =>
  crypto.randomBytes(6).toString('hex')

const generateToken = () =>
  crypto.randomBytes(24).toString('hex')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed.',
    })
  }

  try {
    const {
      ciphertext,
      iv,
      salt,
      burnAfterReading,
      ttlSeconds,
      maxViews,
    } = req.body

    if (!ciphertext || !iv || !salt) {
      return res.status(400).json({
        error: 'Missing encrypted data.',
      })
    }

    const redis = await getRedis()

    const id = generateId()
    const deleteToken = generateToken()

    const parsedViews = parseInt(maxViews, 10)

    const totalViews =
      !Number.isNaN(parsedViews) && parsedViews > 0
        ? parsedViews
        : burnAfterReading
          ? 1
          : null

    const parsedTtl = parseInt(ttlSeconds, 10)

    const expires =
      !Number.isNaN(parsedTtl) && parsedTtl > 0
        ? parsedTtl
        : 86400

    const payload = {
      ciphertext,
      iv,
      salt,
      burnAfterReading: Boolean(burnAfterReading),
      maxViews: totalViews,
      viewsLeft: totalViews,
      deleteToken,
    }

    await redis.set(
      id,
      JSON.stringify(payload),
      {
        EX: expires,
      }
    )

    return res.status(200).json({
      id,
      deleteToken,
    })
  } catch (error) {
    console.error('Create paste error:', error)

    return res.status(500).json({
      error: 'Unable to create secure transfer.',
    })
  }
}