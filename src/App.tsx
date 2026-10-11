import { useState, useEffect, useCallback } from 'react';
import { db, recalculateAllAccountsUsage } from './services/db';
import {
  initializeDatabaseSeed,
  addUploadedFile,
  createVirtualFolder,
  deleteVirtualItem,
  renameVirtualItem
} from './services/cloudProviderService';
import {
  transferBetweenAccounts,
  pauseTransfer,
  resumeTransfer,
  cancelTransfer,
  clearFinishedTransfers
} from './services/streamingTransferService';
import {
  syncCatalogWithAnchor,
  simulateRemoteConflict
} from './services/catalogSyncService';
import {
  isVaultUnlocked as checkVaultUnlocked,
  isVaultConfigured as checkVaultConfigured
} from './services/cryptoService';
import type { StorageAccount, CloudFile, TransferTask } from './types';

// UI Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { StorageOverview } from './components/StorageOverview';
import { FileList } from './components/FileList';
import { TransferDrawer } from './components/TransferDrawer';
import { MoveToCloudModal } from './components/MoveToCloudModal';
import { NewFolderModal } from './components/NewFolderModal';
import { AccountModal } from './components/AccountModal';
import { VaultModal } from './components/VaultModal';
import { SettingsModal } from './components/SettingsModal';
import { RenameModal } from './components/RenameModal';

export function App() {
  // Core VFS State
  const [accounts, setAccounts] = useState<StorageAccount[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [transfers, setTransfers] = useState<TransferTask[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // System & Engine State
  const [isMockMode, setIsMockMode] = useState<boolean>(true);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(false);
  const [isVaultConfigured, setIsVaultConfigured] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastEtag, setLastEtag] = useState<string | null>(null);

  // Modals & Drawers
  const [isTransferDrawerOpen, setIsTransferDrawerOpen] = useState<boolean>(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState<boolean>(false);
  const [movingFile, setMovingFile] = useState<CloudFile | null>(null);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState<boolean>(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [renamingFile, setRenamingFile] = useState<CloudFile | null>(null);

  // Load / Refresh from IndexedDB
  const refreshDatabaseState = useCallback(async () => {
    const loadedAccounts = await db.accounts.toArray();
    const loadedFiles = await db.files.toArray();
    const loadedTransfers = await db.transfers.toArray();

    // Check last sync & etag
    const etagMeta = await db.meta.get('last_catalog_etag');
    const syncTimeMeta = await db.meta.get('last_sync_time');

    setAccounts(loadedAccounts);
    setFiles(loadedFiles);
    setTransfers(loadedTransfers);
    setLastEtag(etagMeta?.value || null);
    setLastSyncedAt(syncTimeMeta?.value || null);

    // Check vault
    const configured = await checkVaultConfigured();
    const unlocked = checkVaultUnlocked();
    setIsVaultConfigured(configured);
    setIsVaultUnlocked(unlocked);
  }, []);

  // Initial startup: seed mock database if empty
  useEffect(() => {
    const startup = async () => {
      await initializeDatabaseSeed();
      await refreshDatabaseState();
    };
    startup();
  }, [refreshDatabaseState]);

  // Handle Stream Transfer Start
  const handleStartTransfer = async (
    file: CloudFile,
    sourceAccount: StorageAccount,
    targetAccount: StorageAccount
  ) => {
    setIsTransferDrawerOpen(true);
    try {
      await transferBetweenAccounts(file, sourceAccount, targetAccount, async (updatedTask) => {
        setTransfers((prev) => {
          const index = prev.findIndex((t) => t.id === updatedTask.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedTask;
            return next;
          }
          return [updatedTask, ...prev];
        });
        if (updatedTask.status === 'completed') {
          await refreshDatabaseState();
        }
      });
      await refreshDatabaseState();
    } catch (err) {
      console.error('Transfer error:', err);
    }
  };

  // Pause / Resume / Cancel Transfer
  const handlePauseTransfer = async (taskId: string) => {
    await pauseTransfer(taskId);
    await refreshDatabaseState();
  };

  const handleResumeTransfer = async (taskId: string) => {
    setIsTransferDrawerOpen(true);
    await resumeTransfer(taskId, async (updatedTask) => {
      setTransfers((prev) => {
        const index = prev.findIndex((t) => t.id === updatedTask.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedTask;
          return next;
        }
        return [updatedTask, ...prev];
      });
      if (updatedTask.status === 'completed') {
        await refreshDatabaseState();
      }
    });
    await refreshDatabaseState();
  };

  const handleCancelTransfer = async (taskId: string) => {
    await cancelTransfer(taskId);
    await refreshDatabaseState();
  };

  const handleClearFinished = async () => {
    await clearFinishedTransfers();
    await refreshDatabaseState();
  };

  // File operations
  const handleUploadFile = async (file: File) => {
    try {
      await addUploadedFile(currentPath, file, selectedAccountId || undefined);
      await refreshDatabaseState();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    try {
      await createVirtualFolder(currentPath, folderName, selectedAccountId || undefined);
      await refreshDatabaseState();
    } catch (err: any) {
      alert(`Could not create folder: ${err.message}`);
    }
  };

  const handleDeleteFile = async (file: CloudFile) => {
    const isFolder = file.isFolder;
    const msg = isFolder
      ? `Delete folder "${file.name}" and all its contents?`
      : `Delete file "${file.name}" from ${accounts.find((a) => a.id === file.accountId)?.name || 'cloud'}?`;

    if (window.confirm(msg)) {
      await deleteVirtualItem(file);
      await refreshDatabaseState();
    }
  };

  const handleRenameFile = async (file: CloudFile, newName: string) => {
    await renameVirtualItem(file, newName);
    await refreshDatabaseState();
  };

  const handleDownloadFile = async (file: CloudFile) => {
    if (file.isFolder) return;

    // Check if we have the blob stored in Dexie
    const stored = await db.fileBlobs.get(file.id);
    let blob: Blob;

    if (stored?.blob) {
      blob = stored.blob;
    } else if (file.blobData) {
      blob = file.blobData;
    } else {
      // Mock downloadable content
      const dummyContent = `CloudMesh Virtual File Download\nFile: ${file.name}\nSize: ${file.sizeBytes} bytes\nVirtual Path: ${file.virtualPath}\nETag: ${file.etag}\nPhysical Host: ${file.accountId}\nGenerated at: ${new Date().toISOString()}`;
      blob = new Blob([dummyContent], { type: file.mimeType || 'text/plain' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Catalog Synchronization with Google Drive Anchor
  const handleSyncAnchor = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing catalog with Anchor appDataFolder...');
    try {
      const res = await syncCatalogWithAnchor(isMockMode);
      setSyncMessage(res.message);
      await refreshDatabaseState();
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message}`);
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Simulate 412 Conflict Demo
  const handleSimulateConflict = async () => {
    setIsSyncing(true);
    setSyncMessage('Simulating remote 412 conflict...');
    try {
      await simulateRemoteConflict();
      // Immediately sync with anchor
      const res = await syncCatalogWithAnchor(true);
      setSyncMessage(res.message);
      await refreshDatabaseState();
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Account Management
  const handleAddAccount = async (newAccount: StorageAccount) => {
    await db.accounts.put(newAccount);
    await refreshDatabaseState();
  };

  const handleRemoveAccount = async (accountId: string) => {
    await db.accounts.delete(accountId);
    // Move orphaned files to anchor or first remaining account
    const remaining = await db.accounts.toArray();
    if (remaining.length > 0) {
      const targetAcc = remaining[0];
      const orphans = await db.files.where('accountId').equals(accountId).toArray();
      for (const f of orphans) {
        await db.files.update(f.id, { accountId: targetAcc.id });
      }
    }
    await recalculateAllAccountsUsage();
    await refreshDatabaseState();
  };

  const handleSetAnchor = async (accountId: string) => {
    const all = await db.accounts.toArray();
    for (const a of all) {
      await db.accounts.update(a.id, {
        role: a.id === accountId ? 'anchor' : 'worker',
      });
    }
    await refreshDatabaseState();
  };

  const activeTransfersCount = transfers.filter(
    (t) => t.status === 'transferring' || t.status === 'pending'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Navbar */}
      <Navbar
        accounts={accounts}
        isMockMode={isMockMode}
        onToggleMockMode={() => setIsMockMode((prev) => !prev)}
        isVaultUnlocked={isVaultUnlocked}
        isVaultConfigured={isVaultConfigured}
        onOpenVaultModal={() => setIsVaultModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenAccountsModal={() => setIsAccountsModalOpen(true)}
        onSyncAnchor={handleSyncAnchor}
        isSyncing={isSyncing}
        syncMessage={syncMessage}
        lastSyncedAt={lastSyncedAt}
      />

      {/* Main Body Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentPath={currentPath}
          onNavigate={(path) => setCurrentPath(path)}
          folders={files.filter((f) => f.isFolder)}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={(accId) => setSelectedAccountId(accId)}
          onOpenAccountsModal={() => setIsAccountsModalOpen(true)}
          onOpenVaultModal={() => setIsVaultModalOpen(true)}
          isVaultUnlocked={isVaultUnlocked}
          isVaultConfigured={isVaultConfigured}
          activeTransfersCount={activeTransfersCount}
          onToggleTransferDrawer={() => setIsTransferDrawerOpen((prev) => !prev)}
        />

        {/* Central Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {/* Storage Bar Overview */}
          <StorageOverview
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelectAccount={(accId) => setSelectedAccountId(accId)}
            onOpenAccountsModal={() => setIsAccountsModalOpen(true)}
          />

          {/* Toast Notification for Sync & Conflicts */}
          {syncMessage && (
            <div className="px-6 py-2.5 bg-indigo-950/80 border-b border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>{syncMessage}</span>
              </div>
              <button
                onClick={() => setSyncMessage(null)}
                className="text-indigo-400 hover:text-indigo-200 text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* File List & Virtual Drive Explorer */}
          <FileList
            files={files}
            accounts={accounts}
            currentPath={currentPath}
            onNavigate={(path) => setCurrentPath(path)}
            onOpenFileMoveModal={(file) => {
              setMovingFile(file);
              setIsMoveModalOpen(true);
            }}
            onUploadFile={handleUploadFile}
            onOpenNewFolderModal={() => setIsNewFolderModalOpen(true)}
            onDeleteFile={handleDeleteFile}
            onRenameFile={(file) => {
              setRenamingFile(file);
              setIsRenameModalOpen(true);
            }}
            onDownloadFile={handleDownloadFile}
            selectedAccountId={selectedAccountId}
            onSelectAccount={(accId) => setSelectedAccountId(accId)}
            onSimulateConflict={handleSimulateConflict}
          />
        </main>
      </div>

      {/* Active Transfer Bottom Drawer */}
      <TransferDrawer
        transfers={transfers}
        accounts={accounts}
        isOpen={isTransferDrawerOpen}
        onToggle={() => setIsTransferDrawerOpen((prev) => !prev)}
        onPauseTransfer={handlePauseTransfer}
        onResumeTransfer={handleResumeTransfer}
        onCancelTransfer={handleCancelTransfer}
        onClearFinished={handleClearFinished}
      />

      {/* Modals */}
      <MoveToCloudModal
        isOpen={isMoveModalOpen}
        onClose={() => {
          setIsMoveModalOpen(false);
          setMovingFile(null);
        }}
        file={movingFile}
        accounts={accounts}
        onStartTransfer={handleStartTransfer}
      />

      <NewFolderModal
        isOpen={isNewFolderModalOpen}
        onClose={() => setIsNewFolderModalOpen(false)}
        currentPath={currentPath}
        onCreateFolder={handleCreateFolder}
      />

      <AccountModal
        isOpen={isAccountsModalOpen}
        onClose={() => setIsAccountsModalOpen(false)}
        accounts={accounts}
        onAddAccount={handleAddAccount}
        onRemoveAccount={handleRemoveAccount}
        onSetAnchor={handleSetAnchor}
        isMockMode={isMockMode}
      />

      <VaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        isUnlocked={isVaultUnlocked}
        isConfigured={isVaultConfigured}
        onVaultStateChanged={refreshDatabaseState}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        isMockMode={isMockMode}
        onToggleMockMode={() => setIsMockMode((prev) => !prev)}
        isVaultUnlocked={isVaultUnlocked}
        isVaultConfigured={isVaultConfigured}
        onOpenVaultModal={() => setIsVaultModalOpen(true)}
        lastSyncedAt={lastSyncedAt}
        lastEtag={lastEtag}
        accounts={accounts}
        onDataReset={refreshDatabaseState}
        onSyncCompleted={refreshDatabaseState}
      />

      <RenameModal
        isOpen={isRenameModalOpen}
        onClose={() => {
          setIsRenameModalOpen(false);
          setRenamingFile(null);
        }}
        file={renamingFile}
        onRename={handleRenameFile}
      />
    </div>
  );
}

export default App;
