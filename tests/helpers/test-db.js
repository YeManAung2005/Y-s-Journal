import mongoose from 'mongoose'

export const TEST_DB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/ys_journal_test'

export async function connectTestDb() {
  await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 5000 })
}

export async function resetTestDb() {
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase()
  }
}

export async function disconnectTestDb() {
  await mongoose.disconnect()
}
