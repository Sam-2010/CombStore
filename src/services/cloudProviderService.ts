import { db, recalculateAllAccountsUsage } from './db';
import type { StorageAccount, CloudFile, CloudProvider } from '../types';

export interface ProviderInfo {
  id: CloudProvider;
  name: string;
  defaultCapacity: number; // bytes
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  iconName: string;
  description: string;
}

export const PROVIDERS_META: Record<CloudProvider, ProviderInfo> = {
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    defaultCapacity: 15 * 1024 * 1024 * 1024, // 15 GB
    color: '#4285F4',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    badgeText: 'text-blue-400',
    borderColor: 'border-blue-500',
    iconName: 'google',
    description: '15 GB free pooled storage per account with appDataFolder catalog synchronization.',
  },
  onedrive: {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    defaultCapacity: 5 * 1024 * 1024 * 1024, // 5 GB
    color: '#0078D4',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    badgeText: 'text-sky-400',
    borderColor: 'border-sky-500',
    iconName: 'microsoft',
    description: '5 GB free personal Microsoft cloud storage.',
  },
  's3-r2': {
    id: 's3-r2',
    name: 'Cloudflare R2 / S3',
    defaultCapacity: 10 * 1024 * 1024 * 1024, // 10 GB
    color: '#F38020',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    badgeText: 'text-orange-400',
    borderColor: 'border-orange-500',
    iconName: 'server',
    description: '10 GB free S3-compatible zero-egress object storage.',
  },
};

/**
 * Default initial mock accounts
 */
export const SEED_ACCOUNTS: StorageAccount[] = [
  {
    id: 'acc-gdrive-anchor',
    provider: 'google-drive',
    email: 'sam.dev@gmail.com',
    name: 'Google Drive (Personal)',
    role: 'anchor',
    totalCapacity: 15 * 1024 * 1024 * 1024, // 15 GB
    usedCapacity: 0,
    connectedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    isMock: true,
  },
  {
    id: 'acc-gdrive-worker-1',
    provider: 'google-drive',
    email: 'backup.vault@gmail.com',
    name: 'Google Drive (Archive)',
    role: 'worker',
    totalCapacity: 15 * 1024 * 1024 * 1024, // 15 GB
    usedCapacity: 0,
    connectedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    isMock: true,
  },
  {
    id: 'acc-onedrive-worker',
    provider: 'onedrive',
    email: 'sam.work@outlook.com',
    name: 'Microsoft OneDrive (Office)',
    role: 'worker',
    totalCapacity: 5 * 1024 * 1024 * 1024, // 5 GB
    usedCapacity: 0,
    connectedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    isMock: true,
  },
  {
    id: 'acc-r2-worker',
    provider: 's3-r2',
    email: 'media-bucket@r2.cloud',
    name: 'Cloudflare R2 (Object Store)',
    role: 'worker',
    totalCapacity: 20 * 1024 * 1024 * 1024, // 20 GB
    usedCapacity: 0,
    connectedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    isMock: true,
  },
];

/**
 * Default sample virtual file system tree
 */
export const SEED_FILES: CloudFile[] = [
  // Root Folders
  {
    id: 'fld-documents',
    accountId: 'acc-gdrive-anchor',
    remoteId: 'rem-fld-docs',
    name: 'Documents',
    virtualPath: '/Documents',
    parentPath: '/',
    sizeBytes: 0,
    mimeType: 'folder',
    isFolder: true,
    modifiedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    etag: 'tag-fld-docs',
    pinned: true,
  },
  {
    id: 'fld-photos',
    accountId: 'acc-gdrive-anchor',
    remoteId: 'rem-fld-photos',
    name: 'Media & Photos',
    virtualPath: '/Media & Photos',
    parentPath: '/',
    sizeBytes: 0,
    mimeType: 'folder',
    isFolder: true,
    modifiedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    etag: 'tag-fld-photos',
    pinned: true,
  },
  {
    id: 'fld-backups',
    accountId: 'acc-gdrive-worker-1',
    remoteId: 'rem-fld-backups',
    name: 'Backups',
    virtualPath: '/Backups',
    parentPath: '/',
    sizeBytes: 0,
    mimeType: 'folder',
    isFolder: true,
    modifiedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    etag: 'tag-fld-backups',
  },
  {
    id: 'fld-projects',
    accountId: 'acc-onedrive-worker',
    remoteId: 'rem-fld-projects',
    name: 'Engineering Projects',
    virtualPath: '/Engineering Projects',
    parentPath: '/',
    sizeBytes: 0,
    mimeType: 'folder',
    isFolder: true,
    modifiedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    etag: 'tag-fld-projects',
    starred: true,
  },

  // Documents folder files
  {
    id: 'file-q4-financials',
    accountId: 'acc-gdrive-anchor',
    remoteId: 'rem-doc-1',
    name: 'Q4_Financial_Projections.xlsx',
    virtualPath: '/Documents/Q4_Financial_Projections.xlsx',
    parentPath: '/Documents',
    sizeBytes: 2450000, // ~2.45 MB
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    etag: 'tag-doc-1',
    starred: true,
  },
  {
    id: 'file-architecture-blueprint',
    accountId: 'acc-onedrive-worker',
    remoteId: 'rem-doc-2',
    name: 'CloudMesh_Architecture_Blueprint.pdf',
    virtualPath: '/Documents/CloudMesh_Architecture_Blueprint.pdf',
    parentPath: '/Documents',
    sizeBytes: 14800000, // 14.8 MB
    mimeType: 'application/pdf',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 18 * 3600000).toISOString(),
    etag: 'tag-doc-2',
    starred: true,
  },
  {
    id: 'file-product-roadmap',
    accountId: 'acc-gdrive-worker-1',
    remoteId: 'rem-doc-3',
    name: 'Product_Roadmap_2026.docx',
    virtualPath: '/Documents/Product_Roadmap_2026.docx',
    parentPath: '/Documents',
    sizeBytes: 3840000, // 3.84 MB
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    etag: 'tag-doc-3',
  },

  // Media folder files
  {
    id: 'file-hero-video',
    accountId: 'acc-r2-worker',
    remoteId: 'rem-media-1',
    name: 'Product_Keynote_4K.mp4',
    virtualPath: '/Media & Photos/Product_Keynote_4K.mp4',
    parentPath: '/Media & Photos',
    sizeBytes: 312000000, // 312 MB
    mimeType: 'video/mp4',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    etag: 'tag-media-1',
  },
  {
    id: 'file-banner-photo',
    accountId: 'acc-gdrive-anchor',
    remoteId: 'rem-media-2',
    name: 'Hero_Banner_Retina.png',
    virtualPath: '/Media & Photos/Hero_Banner_Retina.png',
    parentPath: '/Media & Photos',
    sizeBytes: 12400000, // 12.4 MB
    mimeType: 'image/png',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 40 * 3600000).toISOString(),
    etag: 'tag-media-2',
  },

  // Backups folder files
  {
    id: 'file-db-snapshot',
    accountId: 'acc-r2-worker',
    remoteId: 'rem-bkp-1',
    name: 'Production_Database_Dump_2026.sql.gz',
    virtualPath: '/Backups/Production_Database_Dump_2026.sql.gz',
    parentPath: '/Backups',
    sizeBytes: 524000000, // 524 MB
    mimeType: 'application/gzip',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    etag: 'tag-bkp-1',
  },
  {
    id: 'file-encryption-keys',
    accountId: 'acc-gdrive-worker-1',
    remoteId: 'rem-bkp-2',
    name: 'System_Config_Archive.tar',
    virtualPath: '/Backups/System_Config_Archive.tar',
    parentPath: '/Backups',
    sizeBytes: 18200000, // 18.2 MB
    mimeType: 'application/x-tar',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 60 * 3600000).toISOString(),
    etag: 'tag-bkp-2',
  },

  // Projects folder files
  {
    id: 'file-nextgen-source',
    accountId: 'acc-gdrive-anchor',
    remoteId: 'rem-proj-1',
    name: 'CloudMesh_Source_v1.0.zip',
    virtualPath: '/Engineering Projects/CloudMesh_Source_v1.0.zip',
    parentPath: '/Engineering Projects',
    sizeBytes: 86400000, // 86.4 MB
    mimeType: 'application/zip',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    etag: 'tag-proj-1',
  },
  {
    id: 'file-contracts',
    accountId: 'acc-onedrive-worker',
    remoteId: 'rem-proj-2',
    name: 'Enterprise_Licensing_Agreement.pdf',
    virtualPath: '/Engineering Projects/Enterprise_Licensing_Agreement.pdf',
    parentPath: '/Engineering Projects',
    sizeBytes: 6200000, // 6.2 MB
    mimeType: 'application/pdf',
    isFolder: false,
    modifiedAt: new Date(Date.now() - 14 * 3600000).toISOString(),
    etag: 'tag-proj-2',
  },
];

/**
 * Initialize Dexie with seed data if accounts table is empty
 */
export async function initializeDatabaseSeed(): Promise<void> {
  const accountCount = await db.accounts.count();
  if (accountCount === 0) {
    console.log('[CloudMesh] Seeding initial mock accounts and sample files...');
    await db.accounts.bulkPut(SEED_ACCOUNTS);
    await db.files.bulkPut(SEED_FILES);
    await recalculateAllAccountsUsage();
  }
}

/**
 * Hard reset database to default mock state
 */
export async function resetDatabaseToDemo(): Promise<void> {
  await db.files.clear();
  await db.accounts.clear();
  await db.transfers.clear();
  await db.fileBlobs.clear();
  await db.meta.clear();

  await db.accounts.bulkPut(SEED_ACCOUNTS);
  await db.files.bulkPut(SEED_FILES);
  await recalculateAllAccountsUsage();
}

/**
 * Returns account with the most available storage (smart pooling allocation)
 */
export async function getBestAccountForUpload(requiredBytes: number = 0): Promise<StorageAccount> {
  const accounts = await db.accounts.toArray();
  if (accounts.length === 0) {
    throw new Error('No cloud accounts connected.');
  }

  // Filter accounts that have enough space (if specified)
  const eligible = accounts.filter((a) => a.totalCapacity - a.usedCapacity >= requiredBytes);
  const pool = eligible.length > 0 ? eligible : accounts;

  // Sort descending by remaining capacity
  pool.sort((a, b) => (b.totalCapacity - b.usedCapacity) - (a.totalCapacity - a.usedCapacity));
  return pool[0];
}

/**
 * Creates a new virtual folder in Dexie VFS
 */
export async function createVirtualFolder(parentPath: string, folderName: string, accountId?: string): Promise<CloudFile> {
  let targetAccountId = accountId;
  if (!targetAccountId) {
    const defaultAcc = await getBestAccountForUpload();
    targetAccountId = defaultAcc.id;
  }

  const cleanName = folderName.trim().replace(/[/\\?%*:|"<>]/g, '-');
  const virtualPath = parentPath === '/' ? `/${cleanName}` : `${parentPath}/${cleanName}`;

  // Check if exists
  const existing = await db.files.where(['parentPath', 'name']).equals([parentPath, cleanName]).first();
  if (existing) {
    throw new Error(`A folder or file named "${cleanName}" already exists here.`);
  }

  const folder: CloudFile = {
    id: 'fld-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    accountId: targetAccountId,
    remoteId: 'mock-rem-fld-' + Date.now(),
    name: cleanName,
    virtualPath,
    parentPath,
    sizeBytes: 0,
    mimeType: 'folder',
    isFolder: true,
    modifiedAt: new Date().toISOString(),
    etag: `fld-etag-${Date.now()}`,
  };

  await db.files.put(folder);
  return folder;
}

/**
 * Adds an uploaded file to Dexie VFS and recalculates storage
 */
export async function addUploadedFile(
  parentPath: string,
  file: File,
  accountId?: string
): Promise<CloudFile> {
  let targetAccountId = accountId;
  if (!targetAccountId) {
    const bestAcc = await getBestAccountForUpload(file.size);
    targetAccountId = bestAcc.id;
  }

  const cleanName = file.name.trim();
  const virtualPath = parentPath === '/' ? `/${cleanName}` : `${parentPath}/${cleanName}`;

  const cloudFile: CloudFile = {
    id: 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    accountId: targetAccountId,
    remoteId: 'rem-' + Date.now(),
    name: cleanName,
    virtualPath,
    parentPath,
    sizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
    isFolder: false,
    modifiedAt: new Date().toISOString(),
    etag: `etag-${Date.now()}`,
    blobData: file,
  };

  await db.files.put(cloudFile);

  // Store in fileBlobs for persistence
  await db.fileBlobs.put({
    fileId: cloudFile.id,
    blob: file,
    updatedAt: new Date().toISOString(),
  });

  // Update account used storage
  const account = await db.accounts.get(targetAccountId);
  if (account) {
    await db.accounts.update(targetAccountId, {
      usedCapacity: (account.usedCapacity || 0) + file.size,
    });
  }

  return cloudFile;
}

/**
 * Delete a file or recursively delete a folder
 */
export async function deleteVirtualItem(item: CloudFile): Promise<void> {
  if (item.isFolder) {
    // Delete all child files and subfolders
    const allFiles = await db.files.toArray();
    const toDelete = allFiles.filter(
      (f) => f.virtualPath === item.virtualPath || f.virtualPath.startsWith(item.virtualPath + '/')
    );

    const ids = toDelete.map((f) => f.id);
    await db.files.bulkDelete(ids);
    await db.fileBlobs.bulkDelete(ids);
  } else {
    await db.files.delete(item.id);
    await db.fileBlobs.delete(item.id);
  }

  await recalculateAllAccountsUsage();
}

/**
 * Rename a file or folder
 */
export async function renameVirtualItem(item: CloudFile, newName: string): Promise<void> {
  const cleanName = newName.trim();
  if (!cleanName || cleanName === item.name) return;

  const parent = item.parentPath;
  const newVirtualPath = parent === '/' ? `/${cleanName}` : `${parent}/${cleanName}`;

  if (item.isFolder) {
    const oldPrefix = item.virtualPath;
    const allFiles = await db.files.toArray();
    for (const f of allFiles) {
      if (f.id === item.id) {
        await db.files.update(f.id, {
          name: cleanName,
          virtualPath: newVirtualPath,
          modifiedAt: new Date().toISOString(),
        });
      } else if (f.virtualPath.startsWith(oldPrefix + '/')) {
        const subSuffix = f.virtualPath.slice(oldPrefix.length);
        const subParentSuffix = f.parentPath.startsWith(oldPrefix)
          ? f.parentPath.slice(oldPrefix.length)
          : '';
        await db.files.update(f.id, {
          virtualPath: newVirtualPath + subSuffix,
          parentPath: newVirtualPath + subParentSuffix,
          modifiedAt: new Date().toISOString(),
        });
      }
    }
  } else {
    await db.files.update(item.id, {
      name: cleanName,
      virtualPath: newVirtualPath,
      modifiedAt: new Date().toISOString(),
    });
  }
}
