import React from 'react';
import {
  Folder,
  FolderOpen,
  Star,
  Plus,
  Lock,
  Unlock,
  Cloud,
  ArrowRightLeft
} from 'lucide-react';
import type { StorageAccount, CloudFile } from '../types';
import { PROVIDERS_META } from '../services/cloudProviderService';
import { formatBytes } from '../lib/utils';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  folders: CloudFile[];
  accounts: StorageAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onOpenAccountsModal: () => void;
  onOpenVaultModal: () => void;
  isVaultUnlocked: boolean;
  isVaultConfigured: boolean;
  activeTransfersCount: number;
  onToggleTransferDrawer: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  folders,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onOpenAccountsModal,
  onOpenVaultModal,
  isVaultUnlocked,
  isVaultConfigured,
  activeTransfersCount,
  onToggleTransferDrawer,
}) => {
  // Extract top-level root folders for quick navigation
  const rootFolders = folders.filter((f) => f.parentPath === '/');

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900/70 border-r border-slate-800 flex flex-col justify-between overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Navigation Category 1: VFS Root */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Virtual Drive
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => {
                onNavigate('/');
                onSelectAccount(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                currentPath === '/' && selectedAccountId === null
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Cloud className="w-4 h-4 text-indigo-400" />
                <span>Unified Home</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                /
              </span>
            </button>

            {/* Active transfers shortcut */}
            {activeTransfersCount > 0 && (
              <button
                onClick={onToggleTransferDrawer}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>Active Transfers</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold">
                  {activeTransfersCount}
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* Navigation Category 2: Pinned & Root Folders */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Folders
          </div>
          <div className="space-y-1">
            {rootFolders.map((folder) => {
              const isActive = currentPath === folder.virtualPath;
              return (
                <button
                  key={folder.id}
                  onClick={() => onNavigate(folder.virtualPath)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/90 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {isActive ? (
                      <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{folder.name}</span>
                  </div>
                  {folder.pinned && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Category 3: Linked Cloud Accounts */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Linked Accounts
            </span>
            <button
              onClick={onOpenAccountsModal}
              title="Add another cloud drive to pool"
              className="text-xs text-indigo-400 hover:text-indigo-300 p-0.5 rounded hover:bg-indigo-500/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            {accounts.map((acc) => {
              const meta = PROVIDERS_META[acc.provider];
              const isSelected = selectedAccountId === acc.id;
              const usedPct = acc.totalCapacity > 0 ? (acc.usedCapacity / acc.totalCapacity) * 100 : 0;

              return (
                <button
                  key={acc.id}
                  onClick={() => onSelectAccount(isSelected ? null : acc.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500/50'
                      : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                      <span className="text-xs font-semibold text-white truncate">
                        {acc.name || meta.name}
                      </span>
                    </div>
                    {acc.role === 'anchor' ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                        Anchor
                      </span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                        Worker
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 truncate mb-1.5">{acc.email}</div>

                  {/* Micro progress meter */}
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(3, usedPct))}%`,
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                    <span>{formatBytes(acc.usedCapacity)}</span>
                    <span>{formatBytes(acc.totalCapacity)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Vault & Security Widget */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
        <div
          onClick={onOpenVaultModal}
          className="cursor-pointer p-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 transition-all flex items-center gap-3"
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isVaultUnlocked
                ? 'bg-emerald-500/20 text-emerald-400'
                : isVaultConfigured
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {isVaultUnlocked ? (
              <Unlock className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              <span>Token Vault</span>
              {isVaultUnlocked && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {isVaultUnlocked
                ? 'AES-256 Active'
                : isVaultConfigured
                ? 'Click to Unlock'
                : 'Set Master Password'}
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 text-center">
          100% Client-Side • Web Crypto & Streams
        </div>
      </div>
    </aside>
  );
};
