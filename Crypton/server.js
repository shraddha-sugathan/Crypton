import express from 'express'
import { createClient } from 'redis'
import crypto from 'crypto'

const app = express()

app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ limit: '5mb', extended: true }))

const redisClient = createClient()

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

redisClient
  .connect()
  .then(() => {
    console.log('Connected to Redis')
  })
  .catch((err) => {
    console.error('Redis connection failed:', err)
  })

const generateId = () => {
  return crypto.randomBytes(6).toString('hex')
}

const generateToken = () => {
  return crypto.randomBytes(24).toString('hex')
}

// --------------------------------------------------
// CREATE SECURE PASTE
// --------------------------------------------------

app.post('/api/paste', async (req, res) => {
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

    await redisClient.set(
      id,
      JSON.stringify(payload),
      {
        EX: expires,
      }
    )

    res.json({
      id,
      deleteToken,
    })
  } catch (error) {
    console.error('Create paste error:', error)

    res.status(500).json({
      error: 'Unable to create secure transfer.',
    })
  }
})

// --------------------------------------------------
// FETCH SECURE PASTE
//
// IMPORTANT:
// This route DOES NOT consume a view.
// It only returns the encrypted payload.
//
// A view is consumed later through:
// POST /api/paste/:id/consume
// --------------------------------------------------

app.get('/api/paste/:id', async (req, res) => {
  try {
    const { id } = req.params

    const pasteData = await redisClient.get(id)

    if (!pasteData) {
      return res.status(404).json({
        error:
          'Secure content was not found. It may have expired or reached its view limit.',
      })
    }

    const paste = JSON.parse(pasteData)

    const ttlRemaining = await redisClient.ttl(id)

    if (ttlRemaining <= 0) {
      return res.status(404).json({
        error: 'Secure content has expired.',
      })
    }

    const expiresAt =
      Date.now() + ttlRemaining * 1000

    res.json({
      ciphertext: paste.ciphertext,
      iv: paste.iv,
      salt: paste.salt,

      expiresAt,

      viewsLeft: paste.viewsLeft,
      maxViews: paste.maxViews,

      burnAfterReading:
        paste.burnAfterReading,
    })
  } catch (error) {
    console.error('Fetch paste error:', error)

    res.status(500).json({
      error: 'Unable to retrieve secure content.',
    })
  }
})

// --------------------------------------------------
// CONSUME ONE SUCCESSFUL VIEW
//
// Called only after the frontend successfully
// decrypts the payload.
// --------------------------------------------------

app.post(
  '/api/paste/:id/consume',
  async (req, res) => {
    try {
      const { id } = req.params

      const pasteData =
        await redisClient.get(id)

      if (!pasteData) {
        return res.status(404).json({
          error:
            'Secure content is no longer available.',
        })
      }

      const paste = JSON.parse(pasteData)

      const ttlRemaining =
        await redisClient.ttl(id)

      if (ttlRemaining <= 0) {
        await redisClient.del(id)

        return res.status(404).json({
          error:
            'Secure content has expired.',
        })
      }

      // Unlimited views
      if (paste.viewsLeft === null) {
        return res.json({
          success: true,
          viewsLeft: null,
          deleted: false,
        })
      }

      paste.viewsLeft -= 1

      // Final allowed view:
      // return success, then delete from Redis.
      if (paste.viewsLeft <= 0) {
        await redisClient.del(id)

        return res.json({
          success: true,
          viewsLeft: 0,
          deleted: true,
        })
      }

      // Views remain.
      // Save again while preserving the original TTL.
      await redisClient.set(
        id,
        JSON.stringify(paste),
        {
          EX: ttlRemaining,
        }
      )

      res.json({
        success: true,
        viewsLeft: paste.viewsLeft,
        deleted: false,
      })
    } catch (error) {
      console.error(
        'Consume view error:',
        error
      )

      res.status(500).json({
        error:
          'Unable to update secure access record.',
      })
    }
  }
)

// --------------------------------------------------
// FORCE DELETE
// --------------------------------------------------

app.delete(
  '/api/paste/:id',
  async (req, res) => {
    try {
      const { id } = req.params
      const { deleteToken } = req.body

      const pasteData =
        await redisClient.get(id)

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

      await redisClient.del(id)

      console.log(
        `Force deleted paste: ${id}`
      )

      res.json({
        success: true,
      })
    } catch (error) {
      console.error(
        'Force delete error:',
        error
      )

      res.status(500).json({
        error:
          'Unable to delete secure transfer.',
      })
    }
  }
)

app.listen(3000, () => {
  console.log(
    'Backend running on http://localhost:3000'
  )
})