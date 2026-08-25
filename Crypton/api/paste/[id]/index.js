import { getRedis } from '../../_redis.js'

export default async function handler(req, res) {
  const { id } = req.query

  if (!id || Array.isArray(id)) {
    return res.status(400).json({
      error: 'Invalid secure content ID.',
    })
  }

  try {
    const redis = await getRedis()

    // ==============================
    // GET: Retrieve encrypted paste
    // ==============================
    if (req.method === 'GET') {
      const pasteData = await redis.get(id)

      if (!pasteData) {
        return res.status(404).json({
          error:
            'Secure content was not found. It may have expired or reached its view limit.',
        })
      }

      const paste = JSON.parse(pasteData)

      const ttlRemaining = await redis.ttl(id)

      if (ttlRemaining <= 0) {
        await redis.del(id)

        return res.status(404).json({
          error: 'Secure content has expired.',
        })
      }

      const expiresAt =
        Date.now() + ttlRemaining * 1000

      return res.status(200).json({
        ciphertext: paste.ciphertext,
        iv: paste.iv,
        salt: paste.salt,

        expiresAt,

        viewsLeft: paste.viewsLeft,
        maxViews: paste.maxViews,
        burnAfterReading: paste.burnAfterReading,
      })
    }

    // ==============================
    // DELETE: Manually delete paste
    // ==============================
    if (req.method === 'DELETE') {
      const { deleteToken } = req.body || {}

      const pasteData = await redis.get(id)

      if (!pasteData) {
        return res.status(404).json({
          error: 'Paste not found.',
        })
      }

      const paste = JSON.parse(pasteData)

      if (
        !deleteToken ||
        paste.deleteToken !== deleteToken
      ) {
        return res.status(403).json({
          error: 'Unauthorized.',
        })
      }

      await redis.del(id)

      return res.status(200).json({
        success: true,
      })
    }

    return res.status(405).json({
      error: 'Method not allowed.',
    })
  } catch (error) {
    console.error(
      'Paste request error:',
      error
    )

    return res.status(500).json({
      error:
        'Unable to process secure content.',
    })
  }
}