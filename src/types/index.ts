export type CloudProvider = 'google-drive' | 'onedrive' | 's3-r2';

export type AccountRole = 'anchor' | 'worker';

export interface StorageAccount {
  id: string;
  provider: CloudProvider;
  email: string;
  name?: string;
  role: AccountRole;
  totalCapacity: number; // in bytes
  usedCapacity: number; // in bytes
  connectedAt: string; // ISO date
  avatarUrl?: string;
  isMock?: boolean;
  authDetails?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    clientId?: string;
    clientSecret?: string;
    bucket?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
}

export interface CloudFile {
  id: string;
  accountId: string;
  remoteId: string;
  name: string;
  virtualPath: string; // e.g. "/Documents/report.pdf"
  parentPath: string; // e.g. "/Documents"
  sizeBytes: number;
  mimeType: string;
  isFolder: boolean;
  modifiedAt: string; // ISO date
  etag: string;
  starred?: boolean;
  pinned?: boolean;
  // In-memory or blob cache for client-side uploads
  blobData?: Blob;
}

export type TransferStatus = 'pending' | 'transferring' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface TransferTask {
  id: string;
  fileId: string;
  fileName: string;
  sourceAccountId: string;
  targetAccountId: string;
  bytesTransferred: number;
  totalBytes: number;
  status: TransferStatus;
  progressPercentage: number;
  speedBytesPerSec?: number;
  currentChunk?: number;
  totalChunks?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface VaultMetadata {
  isConfigured: boolean;
  isUnlocked: boolean;
  saltBase64?: string;
  encryptedVaultPayload?: string; // Base64 ciphertext
  verificationPayload?: string; // Encrypted known phrase to test password
  lastUnlockedAt?: string;
}

export interface CatalogMetadata {
  etag: string;
  lastSyncedAt: string;
  anchorAccountId: string;
  version: number;
  syncStatus: 'idle' | 'syncing' | 'conflict_resolved' | 'error';
  lastError?: string;
}

export interface CatalogExportFormat {
  version: number;
  exportedAt: string;
  anchorAccountId: string;
  accounts: Omit<StorageAccount, 'authDetails'>[];
  files: Omit<CloudFile, 'blobData'>[];
  vaultEncryptedData?: string;
  vaultSalt?: string;
}
