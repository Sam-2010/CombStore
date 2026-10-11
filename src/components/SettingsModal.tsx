import React, { useState } from 'react';
import {
  X,
  Settings,
  Download,
  Upload,
  RefreshCw,
  Shield,
  Zap,
  RotateCcw,
  CheckCircle2,
  FileJson
} from 'lucide-react';
import { buildCatalogPayload, syncCatalogWithAnchor, simulateRemoteConflict } from '../services/catalogSyncService';
import { resetDatabaseToDemo } from '../services/cloudProviderService';
import { db } from '../services/db';
import type { CatalogExportFormat, StorageAccount } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMockMode: boolean;
  onToggleMockMode: () => void;
  isVaultUnlocked: boolean;
  isVaultConfigured: boolean;
  onOpenVaultModal: () => void;
  lastSyncedAt: string | null;
  lastEtag: string | null;
  accounts: StorageAccount[];
  onDataReset: () => void;
  onSyncCompleted: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isMockMode,
  onToggleMockMode,
  isVaultUnlocked,
  isVaultConfigured,
  onOpenVaultModal,
  lastSyncedAt,
  lastEtag,
  accounts,
  onDataReset,
  onSyncCompleted,
}) => {
  if (!isOpen) return null;

  const [isExporting, setIsExporting] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Export JSON Catalog Backup
  const handleExportCatalog = async () => {
    setIsExporting(true);
    try {
      const anchor = accounts.find((a) => a.role === 'anchor') || accounts[0];
      const payload = await buildCatalogPayload(anchor?.id || 'export');
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cloudmesh_catalog_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Import JSON Catalog Backup
  const handleImportCatalog = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const catalog: CatalogExportFormat = JSON.parse(text);

        if (!catalog.files || !catalog.accounts) {
          throw new Error('Invalid catalog format. Missing files or accounts array.');
        }

        // Restore Dexie
        await db.files.clear();
        await db.accounts.clear();
        await db.accounts.bulkPut(catalog.accounts as any);
        await db.files.bulkPut(catalog.files as any);

        setSyncStatusMsg(`Successfully restored catalog (${catalog.files.length} files).`);
        onDataReset();
      } catch (err: any) {
        setSyncStatusMsg(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Test 412 Conflict Simulation
  const handleSimulate412 = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Simulating out-of-band remote catalog change...');
    try {
      await simulateRemoteConflict();
      setSyncStatusMsg('Remote conflict created! Now syncing with optimistic locking...');
      const res = await syncCatalogWithAnchor(true);
      setSyncStatusMsg(res.message);
      onSyncCompleted();
    } catch (err: any) {
      setSyncStatusMsg(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Reset to Demo
  const handleResetDemo = async () => {
    if (window.confirm('Reset all virtual files and cloud accounts to default showcase state?')) {
      await resetDatabaseToDemo();
      onDataReset();
      setSyncStatusMsg('Database reset to default showcase data.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Settings & Synchronization</h3>
              <p className="text-[11px] text-slate-400">Manage client-side engine, vault, and cloud metadata</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
          {syncStatusMsg && (
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-indigo-400" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

          {/* Section 1: Mock Mode */}
          <div className="p-4 bg-slate-850 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Interactive Mock Cloud Mode</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Allows testing multi-cloud pooling, 8MB streaming transfers, and 412 conflicts with zero credentials required.
              </p>
            </div>
            <button
              onClick={onToggleMockMode}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isMockMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isMockMode ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Section 2: Google Drive appDataFolder Sync & Optimistic Locking */}
          <div className="p-4 bg-slate-850 rounded-xl border border-slate-800 space-y-3">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <span>Anchor appDataFolder Sync & Optimistic Locking</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Compresses catalog into <code>catalog.json.gz</code> and syncs using <code>If-Match</code> ETag headers.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 bg-slate-900 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500">Last Synced: </span>
                <span className="text-slate-300">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Never'}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-500">ETag: </span>
                <span className="text-slate-300 font-mono text-[10px]">{lastEtag || 'None'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSimulate412}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Test 412 Conflict Merge</span>
              </button>
            </div>
          </div>

          {/* Section 3: Master Password Vault */}
          <div className="p-4 bg-slate-850 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Encrypted Token Vault</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isVaultUnlocked
                  ? 'Active in memory (AES-GCM-256)'
                  : isVaultConfigured
                  ? 'Configured and locked'
                  : 'Not yet configured'}
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenVaultModal();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 transition-colors"
            >
              {isVaultUnlocked ? 'Manage Vault' : 'Unlock / Setup'}
            </button>
          </div>

          {/* Section 4: Offline Backup & Restore */}
          <div className="p-4 bg-slate-850 rounded-xl border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileJson className="w-4 h-4 text-blue-400" />
              <span>Offline Catalog Backup & Restore</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Export full virtual drive metadata (files, folders, accounts) to a portable JSON backup.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleExportCatalog}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON Catalog</span>
              </button>

              <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON Catalog</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportCatalog}
                />
              </label>
            </div>
          </div>

          {/* Section 5: Reset Demo */}
          <div className="pt-2 flex justify-between items-center text-xs text-slate-500">
            <span>Danger zone:</span>
            <button
              onClick={handleResetDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 border border-transparent hover:border-red-500/20 transition-all text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Showcase Data</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
