import { MongoClient, Db, Collection } from 'mongodb';
import type { Client, Contact, CredentialAccessLog } from '@shire/shared-types';
import { config } from './config.js';

let client: MongoClient;
let db: Db;

export async function connectDb(uri?: string): Promise<Db> {
  client = new MongoClient(uri || config.mongodbUri);
  await client.connect();
  db = client.db();

  await db.collection('clients').createIndex({ companyName: 1 }, { unique: true });
  await db.collection('contacts').createIndex({ clientId: 1 });
  await db.collection('credential_access_logs').createIndex({ clientId: 1, timestamp: 1 });

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

export function getClientsCollection(): Collection<Client> {
  return getDb().collection<Client>('clients');
}

export function getContactsCollection(): Collection<Contact> {
  return getDb().collection<Contact>('contacts');
}

export function getCredentialAccessLogsCollection(): Collection<CredentialAccessLog> {
  return getDb().collection<CredentialAccessLog>('credential_access_logs');
}
