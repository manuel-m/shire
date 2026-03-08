import { MongoClient, Db, Collection } from 'mongodb';
import type { Invoice } from '@shire/shared-types';
import { config } from './config.js';

let client: MongoClient;
let db: Db;

export async function connectDb(uri?: string): Promise<Db> {
  client = new MongoClient(uri || config.mongodbUri);
  await client.connect();
  db = client.db();

  await db.collection('invoices').createIndex({ clientId: 1 });
  await db.collection('invoices').createIndex({ engagementId: 1 });
  await db.collection('invoices').createIndex({ status: 1 });
  await db.collection('invoices').createIndex({ invoiceNumber: 1 }, { unique: true });

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

export function getInvoicesCollection(): Collection<Invoice> {
  return getDb().collection<Invoice>('invoices');
}
