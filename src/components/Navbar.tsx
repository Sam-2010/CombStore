import React from 'react';
import {
  Cloud,
  RefreshCw,
  Lock,
  Unlock,
  Settings,
  ShieldCheck,
  Zap
} from 'lucide-react';
import type { StorageAccount } from '../types';
import { formatBytes } from '../lib/utils';

interface NavbarProps {
  accounts: StorageAccount[];
  isMockMode: boolean;
  onToggleMockMode: () => void;
  isVaultUnlocked: boolean;
  isVaultConfigured: boolean;
  onOpenVaultModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAccountsModal: () => void;
  onSyncAnchor: () => void;
  isSyncing: boolean;
  syncMessage?: string | null;
  lastSyncedAt: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  accounts,
  isMockMode,
  onToggleMockMode,
  isVaultUnlocked,
  isVaultConfigured,
  onOpenVaultModal,
  onOpenSettingsModal,
  onOpenAccountsModal,
  onSyncAnchor,
  isSyncing,
  lastSyncedAt,
}) => {
  const totalPooledBytes = accounts.reduce((acc, a) => acc + a.totalCapacity, 0);
  const usedPooledBytes = accounts.reduce((acc, a) => acc + a.usedCapacity, 0);
  const anchorAccount = accounts.find((a) => a.role === 'anchor');

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between">
      {/* Brand logo */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/20">
          <Cloud className="w-5 h-5 text-white stroke-[2.2]" />
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-white tracking-tight">CloudMesh</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              VFS
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">Zero-Backend Multi-Cloud Storage Pooler</p>
        </div>
      </div>

      {/* Middle status & badges */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mock Mode Toggle */}
        <button
          onClick={onToggleMockMode}
          title="Toggle between Interactive Mock Cloud Mode and Live OAuth API Mode"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            isMockMode
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{isMockMode ? 'Mock Cloud Mode' : 'Live API Mode'}</span>
          <span className="md:hidden">{isMockMode ? 'Mock' : 'Live'}</span>
        </button>

        {/* Anchor appDataFolder Sync Pill */}
        <button
          onClick={onSyncAnchor}
          disabled={isSyncing || !anchorAccount}
          title={
            anchorAccount
              ? `Sync metadata with ${anchorAccount.email}'s appDataFolder (Optimistic Locking & Gzip)`
              : 'No anchor Google Drive connected'
          }
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden lg:inline">
            {isSyncing ? 'Syncing...' : lastSyncedAt ? 'Anchor Synced' : 'Sync Catalog'}
          </span>
          <span className="lg:hidden">{isSyncing ? '...' : 'Sync'}</span>
        </button>

        {/* Master Password Vault Status */}
        <button
          onClick={onOpenVaultModal}
          title="Master Password Encrypted Vault (PBKDF2 + AES-256-GCM)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            isVaultUnlocked
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : isVaultConfigured
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isVaultUnlocked ? (
            <>
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Vault Unlocked</span>
            </>
          ) : isVaultConfigured ? (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Unlock Vault</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Setup Vault</span>
            </>
          )}
        </button>

        {/* Storage Stats Pill */}
        <button
          onClick={onOpenAccountsModal}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <span>
            {formatBytes(usedPooledBytes)} / <strong className="text-white">{formatBytes(totalPooledBytes)}</strong>
          </span>
          <span className="text-slate-500">({accounts.length} Drives)</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettingsModal}
          title="Settings, Vault & Offline Backups"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
