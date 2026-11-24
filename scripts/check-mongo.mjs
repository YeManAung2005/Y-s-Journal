import mongoose from 'mongoose'
import { config } from '../src/server/config.js'
import { connectMongo, disconnectMongo, pingMongo } from '../src/server/db/mongo.js'

try {
  await connectMongo(config.mongoUri)
  const alive = await pingMongo()

  if (!alive) {
    throw new Error('MongoDB ping failed')
  }

  const info = await mongoose.connection.db.admin().serverInfo()

  console.log(
    JSON.stringify(
      {
        ok: true,
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        serverVersion: info.version,
      },
      null,
      2,
    ),
  )
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  )
  process.exitCode = 1
} finally {
  await disconnectMongo()
}
