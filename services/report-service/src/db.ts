import { MongoClient, Db, Collection } from 'mongodb';
import type { Report } from '@shire/shared-types';
import { config } from './config.js';

export interface ReportVersion extends Report {
  reportId: string;
}

let client: MongoClient;
let db: Db;

export async function connectDb(uri?: string): Promise<Db> {
  client = new MongoClient(uri || config.mongodbUri);
  await client.connect();
  db = client.db();

  await db.collection('reports').createIndex({ engagementId: 1 });
  await db.collection('reports').createIndex({ clientId: 1 });
  await db.collection('reports').createIndex({ status: 1 });
  await db.collection('report_versions').createIndex({ reportId: 1, version: 1 }, { unique: true });

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

export function getReportsCollection(): Collection<Report> {
  return getDb().collection<Report>('reports');
}

export function getReportVersionsCollection(): Collection<ReportVersion> {
  return getDb().collection<ReportVersion>('report_versions');
}
