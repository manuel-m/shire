import { MongoClient, Db, Collection } from 'mongodb';
import type { Engagement } from '@shire/shared-types';
import { config } from './config.js';

let client: MongoClient;
let db: Db;

export async function connectDb(uri?: string): Promise<Db> {
  client = new MongoClient(uri || config.mongodbUri);
  await client.connect();
  db = client.db();

  await db.collection('engagements').createIndex({ clientId: 1 });
  await db.collection('engagements').createIndex({ status: 1 });
  await db.collection('engagements').createIndex({ type: 1 });
  await db.collection('engagements').createIndex({ priority: 1 });

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

export function getEngagementsCollection(): Collection<Engagement> {
  return getDb().collection<Engagement>('engagements');
}
