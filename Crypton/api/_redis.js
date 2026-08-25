import { createClient } from 'redis'

let client
let connectPromise

export async function getRedis() {
  if (!client) {
    const redisUrl =
      process.env.REDIS_URL ||
      'redis://127.0.0.1:6379'

    client = createClient({
      url: redisUrl,
    })

    client.on('error', (error) => {
      console.error('Redis Client Error:', error)
    })
  }

  if (!client.isOpen) {
    if (!connectPromise) {
      connectPromise = client
        .connect()
        .catch((error) => {
          connectPromise = null
          throw error
        })
    }

    await connectPromise
  }

  return client
}