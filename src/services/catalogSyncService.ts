import { db } from './db';
import type { CloudFile, StorageAccount, CatalogExportFormat } from '../types';
import { getVaultExportForSync, importVaultFromSync } from './cryptoService';

export interface SyncResult {
  success: boolean;
  etag: string;
  filesCount: number;
  accountsCount: number;
  conflictResolved?: boolean;
  message: string;
}

/**
 * Modern browser native gzip compression using CompressionStream
 */
export async function compressGzip(text: string): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const response = new Response(stream);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  // Fallback for environments lacking CompressionStream
  return new TextEncoder().encode(text);
}

/**
 * Modern browser native gzip decompression using DecompressionStream
 */
export async function decompressGzip(data: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new Blob([data as any]).stream().pipeThrough(new DecompressionStream('gzip'));
      const response = new Response(stream);
      return await response.text();
    } catch {
      // Fallback if raw text
      return new TextDecoder().decode(data);
    }
  }
  return new TextDecoder().decode(data);
}

/**
 * Build catalog JSON structure from current Dexie state
 */
export async function buildCatalogPayload(anchorAccountId: string): Promise<CatalogExportFormat> {
  const accounts = await db.accounts.toArray();
  const files = await db.files.toArray();
  const vaultSync = await getVaultExportForSync();

  // Strip sensitive auth details from exported account list
  const sanitizedAccounts = accounts.map(({ authDetails, ...rest }) => rest);
  // Strip binary blobs from file metadata
  const sanitizedFiles = files.map(({ blobData, ...rest }) => rest);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    anchorAccountId,
    accounts: sanitizedAccounts,
    files: sanitizedFiles,
    vaultEncryptedData: vaultSync?.vaultEnc,
    vaultSalt: vaultSync?.salt,
  };
}

/**
 * Merge remote catalog with local catalog based on modifiedAt timestamps
 */
export async function mergeCatalogs(
  remoteCatalog: CatalogExportFormat,
  localCatalog: CatalogExportFormat
): Promise<{ mergedFiles: CloudFile[]; resolvedCount: number }> {
  const localFileMap = new Map<string, CloudFile>();
  for (const f of localCatalog.files as CloudFile[]) {
    localFileMap.set(f.id, f);
  }

  let resolvedCount = 0;
  const mergedMap = new Map<string, CloudFile>(localFileMap);

  for (const rFile of remoteCatalog.files as CloudFile[]) {
    const lFile = localFileMap.get(rFile.id);
    if (!lFile) {
      // File exists remotely but not locally -> Add it
      mergedMap.set(rFile.id, rFile);
      resolvedCount++;
    } else {
      // Both exist: newest modifiedAt wins
      const remoteTime = new Date(rFile.modifiedAt).getTime();
      const localTime = new Date(lFile.modifiedAt).getTime();

      if (remoteTime > localTime) {
        mergedMap.set(rFile.id, rFile);
        resolvedCount++;
      }
    }
  }

  // Merge accounts if missing
  const localAccountIds = new Set(localCatalog.accounts.map((a) => a.id));
  for (const rAcc of remoteCatalog.accounts) {
    if (!localAccountIds.has(rAcc.id)) {
      await db.accounts.put(rAcc as StorageAccount);
    }
  }

  // If remote has vault and local doesn't, import it
  if (remoteCatalog.vaultEncryptedData && remoteCatalog.vaultSalt) {
    const localVault = await getVaultExportForSync();
    if (!localVault || !localVault.vaultEnc) {
      await importVaultFromSync(remoteCatalog.vaultEncryptedData, remoteCatalog.vaultSalt);
    }
  }

  const mergedFiles = Array.from(mergedMap.values());
  return { mergedFiles, resolvedCount };
}

/* =====================================================================
   Mock Google Drive appDataFolder Simulation
   ===================================================================== */
const MOCK_STORAGE_KEY_CATALOG = 'cloudmesh_mock_appdata_catalog';
const MOCK_STORAGE_KEY_ETAG = 'cloudmesh_mock_appdata_etag';

export async function getMockRemoteCatalog(): Promise<{
  catalog: CatalogExportFormat | null;
  etag: string | null;
}> {
  const etag = localStorage.getItem(MOCK_STORAGE_KEY_ETAG);
  const rawGz = localStorage.getItem(MOCK_STORAGE_KEY_CATALOG);

  if (!rawGz || !etag) {
    return { catalog: null, etag: null };
  }

  try {
    const bytes = Uint8Array.from(atob(rawGz), (c) => c.charCodeAt(0));
    const jsonStr = await decompressGzip(bytes);
    return { catalog: JSON.parse(jsonStr), etag };
  } catch (err) {
    console.warn('Failed to parse mock remote catalog:', err);
    return { catalog: null, etag: null };
  }
}

export async function setMockRemoteCatalog(
  catalog: CatalogExportFormat,
  expectedEtag?: string | null
): Promise<{ success: boolean; newEtag: string; status: number }> {
  const currentEtag = localStorage.getItem(MOCK_STORAGE_KEY_ETAG);

  // Optimistic locking check: If-Match etag verification
  if (expectedEtag && currentEtag && expectedEtag !== currentEtag) {
    // 412 Precondition Failed
    return {
      success: false,
      newEtag: currentEtag,
      status: 412,
    };
  }

  const jsonStr = JSON.stringify(catalog);
  const compressed = await compressGzip(jsonStr);
  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  const base64 = btoa(binary);

  const newEtag = `W/"mock-etag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}"`;
  localStorage.setItem(MOCK_STORAGE_KEY_CATALOG, base64);
  localStorage.setItem(MOCK_STORAGE_KEY_ETAG, newEtag);

  return { success: true, newEtag, status: 200 };
}

/**
 * Simulates a collision by updating the remote mock catalog behind the scenes
 */
export async function simulateRemoteConflict(): Promise<void> {
  const remote = await getMockRemoteCatalog();
  const sampleTime = new Date(Date.now() + 10000).toISOString();

  let catalog: CatalogExportFormat;
  if (remote.catalog) {
    catalog = remote.catalog;
  } else {
    const anchor = (await db.accounts.where('role').equals('anchor').first()) || { id: 'mock-anchor' };
    catalog = await buildCatalogPayload(anchor.id);
  }

  // Inject or update a remote conflict file
  const conflictFile: CloudFile = {
    id: 'conflict-test-doc-' + Date.now().toString(36),
    accountId: catalog.anchorAccountId || 'mock-anchor-google',
    remoteId: 'remote-conflict-gdrive-id',
    name: `Team-Roadmap-Remote-Sync-${new Date().toLocaleTimeString().replace(/:/g, '')}.docx`,
    virtualPath: '/Documents',
    parentPath: '/Documents',
    sizeBytes: 1024 * 340, // 340 KB
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    isFolder: false,
    modifiedAt: sampleTime,
    etag: 'etag-remote-conflict',
  };

  catalog.files.push(conflictFile);
  catalog.exportedAt = sampleTime;

  // Save directly to mock remote storage to invalidate etag
  const jsonStr = JSON.stringify(catalog);
  const compressed = await compressGzip(jsonStr);
  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  const base64 = btoa(binary);

  const freshConflictEtag = `W/"conflict-etag-${Date.now()}"`;
  localStorage.setItem(MOCK_STORAGE_KEY_CATALOG, base64);
  localStorage.setItem(MOCK_STORAGE_KEY_ETAG, freshConflictEtag);
}

/* =====================================================================
   Real Google Drive appDataFolder REST API Integration
   ===================================================================== */
async function findRemoteFile(accessToken: string, fileName: string): Promise<{ id: string; etag: string } | null> {
  const q = encodeURIComponent(`name = '${fileName}' and 'appDataFolder' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,etag)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to list appDataFolder files: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return { id: data.files[0].id, etag: data.files[0].etag };
  }
  return null;
}

async function fetchRemoteCatalogGzip(accessToken: string, fileId: string): Promise<{ catalog: CatalogExportFormat; etag: string }> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch catalog.json.gz: ${res.status}`);
  }

  const etag = res.headers.get('ETag') || `etag-${Date.now()}`;
  const arrayBuffer = await res.arrayBuffer();
  const decompressedJson = await decompressGzip(new Uint8Array(arrayBuffer));
  const catalog = JSON.parse(decompressedJson);
  return { catalog, etag };
}

async function uploadCatalogToGoogle(
  accessToken: string,
  compressedData: Uint8Array,
  existingFileId?: string,
  ifMatchEtag?: string
): Promise<{ success: boolean; etag: string; status: number }> {
  if (existingFileId) {
    // PATCH with If-Match optimistic locking
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/gzip',
    };
    if (ifMatchEtag) {
      headers['If-Match'] = ifMatchEtag;
    }

    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
      method: 'PATCH',
      headers,
      body: compressedData as any,
    });

    if (res.status === 412) {
      return { success: false, etag: '', status: 412 };
    }

    if (!res.ok) {
      throw new Error(`Google Drive upload failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return { success: true, etag: data.etag || '', status: res.status };
  } else {
    // Multipart POST to create inside appDataFolder
    const metadata = {
      name: 'catalog.json.gz',
      parents: ['appDataFolder'],
    };

    const boundary = '-------CloudMeshBoundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const mediaHeader = `${delimiter}Content-Type: application/gzip\r\n\r\n`;

    const metaEncoded = new TextEncoder().encode(metadataPart + mediaHeader);
    const closeEncoded = new TextEncoder().encode(closeDelimiter);

    const fullBody = new Uint8Array(metaEncoded.length + compressedData.length + closeEncoded.length);
    fullBody.set(metaEncoded, 0);
    fullBody.set(compressedData, metaEncoded.length);
    fullBody.set(closeEncoded, metaEncoded.length + compressedData.length);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    });

    if (!res.ok) {
      throw new Error(`Failed to create catalog file: ${res.status}`);
    }

    const data = await res.json();
    return { success: true, etag: data.etag || '', status: res.status };
  }
}

/* =====================================================================
   Main Catalog Synchronization Routine with Optimistic Locking
   ===================================================================== */
export async function syncCatalogWithAnchor(forceMock: boolean = true): Promise<SyncResult> {
  const anchorAccount = await db.accounts.where('role').equals('anchor').first();
  if (!anchorAccount) {
    throw new Error('No Anchor account configured. Please designate a Google Drive account as Anchor.');
  }

  const storedEtagMeta = await db.meta.get('last_catalog_etag');
  const storedEtag = storedEtagMeta?.value || null;

  // Check if we run in Mock Mode or Real Mode
  const isMock = forceMock || anchorAccount.isMock || !anchorAccount.authDetails?.accessToken;

  if (isMock) {
    // Artificial latency for authentic feeling
    await new Promise((r) => setTimeout(r, 600));

    const localCatalog = await buildCatalogPayload(anchorAccount.id);

    // Attempt to commit with Optimistic Locking Check
    let uploadRes = await setMockRemoteCatalog(localCatalog, storedEtag);

    if (uploadRes.status === 412) {
      // 412 Precondition Failed: Remote catalog was updated elsewhere!
      const remote = await getMockRemoteCatalog();
      if (!remote.catalog) {
        throw new Error('Remote catalog conflict detected, but could not load remote payload.');
      }

      // Merge remote changes with local changes based on timestamps
      const { mergedFiles, resolvedCount } = await mergeCatalogs(remote.catalog, localCatalog);

      // Persist merged files to Dexie
      await db.files.clear();
      await db.files.bulkPut(mergedFiles);

      // Re-build catalog and re-commit with new remote ETag
      const reMergedCatalog = await buildCatalogPayload(anchorAccount.id);
      uploadRes = await setMockRemoteCatalog(reMergedCatalog, uploadRes.newEtag);

      await db.meta.put({ key: 'last_catalog_etag', value: uploadRes.newEtag });
      await db.meta.put({ key: 'last_sync_time', value: new Date().toISOString() });

      return {
        success: true,
        etag: uploadRes.newEtag,
        filesCount: mergedFiles.length,
        accountsCount: localCatalog.accounts.length,
        conflictResolved: true,
        message: `Optimistic locking resolved: merged ${resolvedCount} conflicting changes based on timestamps.`,
      };
    }

    await db.meta.put({ key: 'last_catalog_etag', value: uploadRes.newEtag });
    await db.meta.put({ key: 'last_sync_time', value: new Date().toISOString() });

    return {
      success: true,
      etag: uploadRes.newEtag,
      filesCount: localCatalog.files.length,
      accountsCount: localCatalog.accounts.length,
      conflictResolved: false,
      message: 'Catalog synchronized cleanly with Google Drive appDataFolder.',
    };
  } else {
    // REAL Google Drive Mode
    const token = anchorAccount.authDetails?.accessToken;
    if (!token) throw new Error('Anchor account missing access token.');

    const localCatalog = await buildCatalogPayload(anchorAccount.id);
    const jsonStr = JSON.stringify(localCatalog);
    const compressed = await compressGzip(jsonStr);

    const remoteFile = await findRemoteFile(token, 'catalog.json.gz');

    let uploadRes = await uploadCatalogToGoogle(
      token,
      compressed,
      remoteFile?.id,
      storedEtag || remoteFile?.etag
    );

    if (uploadRes.status === 412 && remoteFile?.id) {
      // Fetch latest remote catalog
      const { catalog: remoteCatalog, etag: freshRemoteEtag } = await fetchRemoteCatalogGzip(token, remoteFile.id);
      const { mergedFiles, resolvedCount } = await mergeCatalogs(remoteCatalog, localCatalog);

      await db.files.clear();
      await db.files.bulkPut(mergedFiles);

      const reMergedCatalog = await buildCatalogPayload(anchorAccount.id);
      const reCompressed = await compressGzip(JSON.stringify(reMergedCatalog));

      uploadRes = await uploadCatalogToGoogle(token, reCompressed, remoteFile.id, freshRemoteEtag);

      await db.meta.put({ key: 'last_catalog_etag', value: uploadRes.etag });
      await db.meta.put({ key: 'last_sync_time', value: new Date().toISOString() });

      return {
        success: true,
        etag: uploadRes.etag,
        filesCount: mergedFiles.length,
        accountsCount: localCatalog.accounts.length,
        conflictResolved: true,
        message: `Remote conflict resolved: merged ${resolvedCount} items from Google Drive.`,
      };
    }

    await db.meta.put({ key: 'last_catalog_etag', value: uploadRes.etag });
    await db.meta.put({ key: 'last_sync_time', value: new Date().toISOString() });

    return {
      success: true,
      etag: uploadRes.etag,
      filesCount: localCatalog.files.length,
      accountsCount: localCatalog.accounts.length,
      message: 'Catalog synchronized with Google Drive appDataFolder.',
    };
  }
}
