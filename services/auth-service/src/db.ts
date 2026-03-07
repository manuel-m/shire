import { MongoClient, Db, Collection } from 'mongodb';
import type { User, RefreshToken } from '@shire/shared-types';
import { config } from './config.js';

let client: MongoClient;
let db: Db;

export async function connectDb(uri?: string): Promise<Db> {
  client = new MongoClient(uri || config.mongodbUri);
  await client.connect();
  db = client.db();

  // Ensure indexes
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('refresh_tokens').createIndex({ userId: 1 });
  await db.collection('refresh_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  return db;
}

export async function disconnectDb(): Promise<void> {
  if (client) {
    await client.close();
  }
}

export function getDb(): Db {
  if (!db) throw new Error('Database not connected');
  return db;
}

export function getUsersCollection(): Collection<User> {
  return getDb().collection<User>('users');
}

export function getRefreshTokensCollection(): Collection<RefreshToken> {
  return getDb().collection<RefreshToken>('refresh_tokens');
}
