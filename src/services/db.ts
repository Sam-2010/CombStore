import Dexie, { type Table } from 'dexie';
import type { StorageAccount, CloudFile, TransferTask } from '../types';

export interface MetaItem {
  key: string;
  value: any;
}

export interface FileBlobItem {
  fileId: string;
  blob: Blob;
  updatedAt: string;
}

export class CloudMeshDB extends Dexie {
  accounts!: Table<StorageAccount, string>;
  files!: Table<CloudFile, string>;
  transfers!: Table<TransferTask, string>;
  meta!: Table<MetaItem, string>;
  fileBlobs!: Table<FileBlobItem, string>;

  constructor() {
    super('CloudMeshDB');

    this.version(1).stores({
      accounts: 'id, provider, email, role, totalCapacity, usedCapacity, connectedAt',
      files: 'id, accountId, remoteId, name, virtualPath, parentPath, sizeBytes, mimeType, isFolder, modifiedAt, etag, [parentPath+name]',
      transfers: 'id, fileId, fileName, sourceAccountId, targetAccountId, bytesTransferred, totalBytes, status, progressPercentage',
      meta: 'key',
      fileBlobs: 'fileId, updatedAt'
    });
  }
}

export const db = new CloudMeshDB();

// Helper database queries
export async function getFilesByParent(parentPath: string): Promise<CloudFile[]> {
  return await db.files.where('parentPath').equals(parentPath).toArray();
}

export async function getFileByPath(parentPath: string, name: string): Promise<CloudFile | undefined> {
  return await db.files.where(['parentPath', 'name']).equals([parentPath, name]).first();
}

export async function recalculateAccountUsage(accountId: string): Promise<void> {
  const files = await db.files.where('accountId').equals(accountId).toArray();
  const totalUsed = files.reduce((sum, f) => sum + (f.isFolder ? 0 : f.sizeBytes), 0);
  
  const account = await db.accounts.get(accountId);
  if (account) {
    await db.accounts.update(accountId, { usedCapacity: totalUsed });
  }
}

export async function recalculateAllAccountsUsage(): Promise<void> {
  const accounts = await db.accounts.toArray();
  for (const acc of accounts) {
    await recalculateAccountUsage(acc.id);
  }
}
