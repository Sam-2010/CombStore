import React from 'react';
import { Plus } from 'lucide-react';
import type { StorageAccount } from '../types';
import { PROVIDERS_META } from '../services/cloudProviderService';
import { formatBytes } from '../lib/utils';

interface StorageOverviewProps {
  accounts: StorageAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onOpenAccountsModal: () => void;
}

// Distinct segment colors for visual clarity
const SEGMENT_COLORS = [
  'bg-blue-500 hover:bg-blue-400',
  'bg-indigo-500 hover:bg-indigo-400',
  'bg-sky-500 hover:bg-sky-400',
  'bg-amber-500 hover:bg-amber-400',
  'bg-emerald-500 hover:bg-emerald-400',
  'bg-purple-500 hover:bg-purple-400',
];

export const StorageOverview: React.FC<StorageOverviewProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onOpenAccountsModal,
}) => {
  const totalPooledBytes = accounts.reduce((acc, a) => acc + a.totalCapacity, 0);
  const usedPooledBytes = accounts.reduce((acc, a) => acc + a.usedCapacity, 0);
  const freePooledBytes = Math.max(0, totalPooledBytes - usedPooledBytes);
  const overallUsedPct = totalPooledBytes > 0 ? (usedPooledBytes / totalPooledBytes) * 100 : 0;

  return (
    <div className="bg-slate-900 border-b border-slate-800 p-4 sm:p-6 space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">
              Pooled Storage Cluster
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {accounts.length} Drives Combined
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Client-side virtual drive aggregation with zero backend storage servers.
          </p>
        </div>

        {/* Global capacity metrics */}
        <div className="flex items-center gap-4 text-right">
          <div className="bg-slate-800/80 rounded-xl px-3.5 py-2 border border-slate-700/60">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total Pooled</div>
            <div className="text-base font-bold text-white">{formatBytes(totalPooledBytes)}</div>
          </div>
          <div className="bg-slate-800/80 rounded-xl px-3.5 py-2 border border-slate-700/60">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Used Space</div>
            <div className="text-base font-bold text-indigo-300">{formatBytes(usedPooledBytes)}</div>
          </div>
          <div className="bg-slate-800/80 rounded-xl px-3.5 py-2 border border-slate-700/60">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Free Space</div>
            <div className="text-base font-bold text-emerald-400">{formatBytes(freePooledBytes)}</div>
          </div>
        </div>
      </div>

      {/* Multi-Color Segmented Storage Progress Bar */}
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-slate-800 shadow-inner">
          {totalPooledBytes > 0 &&
            accounts.map((acc, index) => {
              const segPct = (acc.usedCapacity / totalPooledBytes) * 100;
              if (segPct <= 0.2) return null; // Too small to render
              const colorClass = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
              const isSelected = selectedAccountId === acc.id;

              return (
                <div
                  key={acc.id}
                  style={{ width: `${segPct}%` }}
                  title={`${acc.name || acc.email}: ${formatBytes(acc.usedCapacity)} used (${segPct.toFixed(1)}% of pooled cluster)`}
                  onClick={() => onSelectAccount(isSelected ? null : acc.id)}
                  className={`h-full cursor-pointer transition-all ${colorClass} ${
                    isSelected ? 'ring-2 ring-white z-10 brightness-110' : 'opacity-90 hover:opacity-100'
                  }`}
                />
              );
            })}
        </div>

        {/* Legend / Accounts summary list */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => onSelectAccount(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              selectedAccountId === null
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/80'
            }`}
          >
            All Accounts ({overallUsedPct.toFixed(1)}% full)
          </button>

          {accounts.map((acc, index) => {
            const meta = PROVIDERS_META[acc.provider];
            const colorClass = SEGMENT_COLORS[index % SEGMENT_COLORS.length].split(' ')[0];
            const isSelected = selectedAccountId === acc.id;
            const pctOfThisDrive = acc.totalCapacity > 0 ? (acc.usedCapacity / acc.totalCapacity) * 100 : 0;

            return (
              <button
                key={acc.id}
                onClick={() => onSelectAccount(isSelected ? null : acc.id)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-slate-800 text-white border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                <span className="font-medium text-slate-200">
                  {acc.name ? acc.name.split(' ')[0] : meta.name}:
                </span>
                <span className="text-slate-400">
                  {formatBytes(acc.usedCapacity)} / {formatBytes(acc.totalCapacity)} ({pctOfThisDrive.toFixed(0)}%)
                </span>
                {acc.role === 'anchor' && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold border border-amber-500/30">
                    Anchor
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={onOpenAccountsModal}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-dashed border-indigo-500/30 transition-colors ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
