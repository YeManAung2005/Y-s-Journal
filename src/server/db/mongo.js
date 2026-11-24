import mongoose from 'mongoose'
import { config } from '../config.js'

let connectionLogger = null

export async function connectMongo(uri = config.mongoUri, logger = null) {
  connectionLogger = logger

  mongoose.set('strictQuery', true)

  mongoose.connection.on('disconnected', () => {
    connectionLogger?.warn('MongoDB disconnected')
  })

  mongoose.connection.on('reconnected', () => {
    connectionLogger?.info('MongoDB reconnected')
  })

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
    minPoolSize: 1,
    autoIndex: config.nodeEnv !== 'production',
  })
}

export async function pingMongo() {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      return false
    }

    const result = await mongoose.connection.db.admin().ping()
    return result?.ok === 1
  } catch {
    return false
  }
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

export function getMongoConnectionState() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }
  return states[mongoose.connection.readyState] ?? 'unknown'
}
