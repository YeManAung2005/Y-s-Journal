import Dexie from 'dexie'

export const offlineDb = new Dexie('ys-journal-offline')

offlineDb.version(1).stores({
  cache: 'key,updatedAt',
  operations: 'id,status,createdAt,sequence',
  profiles: 'userId,updatedAt',
})
