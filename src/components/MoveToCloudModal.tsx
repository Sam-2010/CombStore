import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  Layers,
  Zap
} from 'lucide-react';
import type { CloudFile, StorageAccount } from '../types';
import { formatBytes } from '../lib/utils';
import { PROVIDERS_META } from '../services/cloudProviderService';
import { CHUNK_SIZE } from '../services/streamingTransferService';

interface MoveToCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: CloudFile | null;
  accounts: StorageAccount[];
  onStartTransfer: (file: CloudFile, sourceAccount: StorageAccount, targetAccount: StorageAccount) => void;
}

export const MoveToCloudModal: React.FC<MoveToCloudModalProps> = ({
  isOpen,
  onClose,
  file,
  accounts,
  onStartTransfer,
}) => {
  if (!isOpen || !file) return null;

  const sourceAccount = accounts.find((a) => a.id === file.accountId);
  const eligibleTargets = accounts.filter((a) => a.id !== file.accountId);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    eligibleTargets[0]?.id || ''
  );

  const targetAccount = accounts.find((a) => a.id === selectedTargetId);
  const sourceMeta = sourceAccount ? PROVIDERS_META[sourceAccount.provider] : null;
  const targetMeta = targetAccount ? PROVIDERS_META[targetAccount.provider] : null;

  const totalChunks = Math.max(1, Math.ceil(file.sizeBytes / CHUNK_SIZE));

  const handleConfirm = () => {
    if (!sourceAccount || !targetAccount) return;
    onStartTransfer(file, sourceAccount, targetAccount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Stream-Pipe to Cloud</h3>
              <p className="text-[11px] text-slate-400">Zero-server client-side chunk streaming</p>
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
        <div className="p-4 sm:p-5 space-y-4">
          {/* File summary */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-[11px] text-slate-500 uppercase font-semibold">Selected File</div>
            <div className="text-sm font-semibold text-white truncate mt-0.5">{file.name}</div>
            <div className="text-xs text-indigo-300 mt-1">
              {formatBytes(file.sizeBytes)} • {totalChunks} chunks of 8 MB
            </div>
          </div>

          {/* Transfer Route */}
          <div className="flex items-center justify-between gap-2 p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
            {/* Source */}
            <div className="flex-1">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Source Account</div>
              <div className="font-semibold text-slate-200 truncate mt-0.5">
                {sourceAccount?.name || sourceMeta?.name || 'Current'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">{sourceAccount?.email}</div>
            </div>

            <div className="flex-shrink-0 px-2">
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </div>

            {/* Target */}
            <div className="flex-1 text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Destination</div>
              <div className="font-semibold text-indigo-300 truncate mt-0.5">
                {targetAccount?.name || targetMeta?.name || 'Target'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">{targetAccount?.email}</div>
            </div>
          </div>

          {/* Target Account Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Destination Cloud Account
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {eligibleTargets.map((acc) => {
                const meta = PROVIDERS_META[acc.provider];
                const isSelected = selectedTargetId === acc.id;
                const freeSpace = Math.max(0, acc.totalCapacity - acc.usedCapacity);

                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedTargetId(acc.id)}
                    className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-850 hover:bg-slate-800 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div className="truncate">
                        <div className="text-xs font-semibold text-white truncate">
                          {acc.name || meta.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{acc.email}</div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-400 flex-shrink-0 ml-2">
                      <div className="text-emerald-400 font-medium">{formatBytes(freeSpace)} free</div>
                      <div>{meta.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Architecture Guarantee Info */}
          <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Layers className="w-3.5 h-3.5" />
              <span>Web Streams Architecture</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Streams in fixed 8 MB chunks via browser ReadableStream. Memory heap remains flat (&lt; 30 MB RAM) regardless of file size. Screen Wake Lock automatically keeps the tab awake.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!targetAccount}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            Start Stream Transfer
          </button>
        </div>
      </div>
    </div>
  );
};
