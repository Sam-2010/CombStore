import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Pause,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Layers
} from 'lucide-react';
import type { TransferTask, StorageAccount } from '../types';
import { formatBytes, formatTransferSpeed, formatETA } from '../lib/utils';
import { PROVIDERS_META } from '../services/cloudProviderService';

interface TransferDrawerProps {
  transfers: TransferTask[];
  accounts: StorageAccount[];
  isOpen: boolean;
  onToggle: () => void;
  onPauseTransfer: (taskId: string) => void;
  onResumeTransfer: (taskId: string) => void;
  onCancelTransfer: (taskId: string) => void;
  onClearFinished: () => void;
}

export const TransferDrawer: React.FC<TransferDrawerProps> = ({
  transfers,
  accounts,
  isOpen,
  onToggle,
  onPauseTransfer,
  onResumeTransfer,
  onCancelTransfer,
  onClearFinished,
}) => {
  if (transfers.length === 0) return null;

  const accountsMap = new Map<string, StorageAccount>();
  accounts.forEach((a) => accountsMap.set(a.id, a));

  const activeTransfers = transfers.filter(
    (t) => t.status === 'transferring' || t.status === 'pending'
  );
  const totalSpeed = activeTransfers.reduce(
    (sum, t) => sum + (t.speedBytesPerSec || 0),
    0
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 shadow-2xl transition-all duration-300">
      {/* Drawer Header Bar */}
      <div
        onClick={onToggle}
        className="px-4 py-3 bg-slate-850 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between border-b border-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-bold text-white tracking-tight">
              Client-Side Stream Pipe Transfers
            </span>
          </div>

          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {activeTransfers.length} Active / {transfers.length} Total
          </span>

          {activeTransfers.length > 0 && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-semibold">
                {formatTransferSpeed(totalSpeed)}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 flex items-center gap-1 text-[11px]">
                <Layers className="w-3 h-3 text-indigo-400" />
                8MB Chunks (&lt; 30MB RAM)
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-300 text-[11px] font-medium">
                Screen Wake Lock Active
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {transfers.some((t) => t.status === 'completed' || t.status === 'cancelled') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearFinished();
              }}
              className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 transition-colors"
            >
              Clear Finished
            </button>
          )}

          <button className="p-1 rounded text-slate-400 hover:text-white">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div className="max-h-72 overflow-y-auto p-4 space-y-3 bg-slate-950/80 divide-y divide-slate-800/60">
          {transfers.map((task) => {
            const srcAcc = accountsMap.get(task.sourceAccountId);
            const tgtAcc = accountsMap.get(task.targetAccountId);
            const srcMeta = srcAcc ? PROVIDERS_META[srcAcc.provider] : null;
            const tgtMeta = tgtAcc ? PROVIDERS_META[tgtAcc.provider] : null;

            const remainingBytes = Math.max(0, task.totalBytes - task.bytesTransferred);
            const etaSeconds =
              task.speedBytesPerSec && task.speedBytesPerSec > 0
                ? remainingBytes / task.speedBytesPerSec
                : 0;

            return (
              <div key={task.id} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-md">
                    <span className="font-semibold text-white truncate">{task.fileName}</span>
                    <span className="text-slate-500">•</span>
                    {/* Routing info */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span className="text-slate-300">{srcMeta?.name || 'Drive A'}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-indigo-300 font-medium">{tgtMeta?.name || 'Drive B'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {task.status === 'transferring' && (
                      <span className="text-[11px] text-emerald-400 font-medium">
                        {formatTransferSpeed(task.speedBytesPerSec || 0)} (ETA: {formatETA(etaSeconds)})
                      </span>
                    )}

                    {task.status === 'completed' && (
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    )}

                    {task.status === 'paused' && (
                      <span className="text-[11px] text-amber-400 font-medium">Paused</span>
                    )}

                    {task.status === 'cancelled' && (
                      <span className="text-[11px] text-slate-500">Cancelled</span>
                    )}

                    {task.status === 'failed' && (
                      <span className="text-[11px] text-red-400 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {task.error || 'Failed'}
                      </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {task.status === 'transferring' && (
                        <button
                          onClick={() => onPauseTransfer(task.id)}
                          title="Pause transfer"
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {task.status === 'paused' && (
                        <button
                          onClick={() => onResumeTransfer(task.id)}
                          title="Resume transfer"
                          className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(task.status === 'transferring' || task.status === 'paused') && (
                        <button
                          onClick={() => onCancelTransfer(task.id)}
                          title="Cancel transfer"
                          className="p-1 rounded bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      task.status === 'completed'
                        ? 'bg-emerald-500'
                        : task.status === 'paused'
                        ? 'bg-amber-500'
                        : task.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${task.progressPercentage}%` }}
                  />
                </div>

                {/* Progress breakdown stats */}
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>
                      {formatBytes(task.bytesTransferred)} / {formatBytes(task.totalBytes)} ({task.progressPercentage}%)
                    </span>
                    {task.totalChunks && (
                      <span className="text-slate-500">
                        • Chunk {task.currentChunk || 0} of {task.totalChunks} (8 MB each)
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500">Flat Heap: &lt; 30MB RAM</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
