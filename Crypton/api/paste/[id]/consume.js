import { getRedis } from '../../_redis.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const { id } = req.query

  if (!id || Array.isArray(id)) {
    return res.status(400).json({
      error: 'Invalid secure content ID.',
    })
  }

  try {
    const redis = await getRedis()

    // Watch this paste so simultaneous requests
    // cannot safely overwrite each other.
    for (let attempt = 0; attempt < 5; attempt++) {
      await redis.watch(id)

      const pasteData = await redis.get(id)

      if (!pasteData) {
        await redis.unwatch()

        return res.status(404).json({
          error: 'Secure content is no longer available.',
        })
      }

      const paste = JSON.parse(pasteData)

      const ttlRemaining = await redis.ttl(id)

      if (ttlRemaining <= 0) {
        await redis.unwatch()
        await redis.del(id)

        return res.status(404).json({
          error: 'Secure content has expired.',
        })
      }

      // Unlimited views
      if (paste.viewsLeft === null) {
        await redis.unwatch()

        return res.status(200).json({
          success: true,
          viewsLeft: null,
          deleted: false,
        })
      }

      const nextViews = paste.viewsLeft - 1

      // Final allowed view: delete the paste
      if (nextViews <= 0) {
        const transaction = redis.multi()

        transaction.del(id)

        const result = await transaction.exec()

        if (result !== null) {
          return res.status(200).json({
            success: true,
            viewsLeft: 0,
            deleted: true,
          })
        }

        continue
      }

      // Save the reduced view count
      paste.viewsLeft = nextViews

      const transaction = redis.multi()

      transaction.set(
        id,
        JSON.stringify(paste),
        {
          EX: ttlRemaining,
        }
      )

      const result = await transaction.exec()

      if (result !== null) {
        return res.status(200).json({
          success: true,
          viewsLeft: nextViews,
          deleted: false,
        })
      }
    }

    return res.status(409).json({
      error:
        'Content was accessed simultaneously. Please try again.',
    })
  } catch (error) {
    console.error('Consume view error:', error)

    return res.status(500).json({
      error: 'Unable to update view count.',
    })
  }
}