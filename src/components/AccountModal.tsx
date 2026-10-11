import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  HardDrive
} from 'lucide-react';
import type { StorageAccount, CloudProvider } from '../types';
import { PROVIDERS_META } from '../services/cloudProviderService';
import { formatBytes } from '../lib/utils';
import { startOAuthPKCEFlow } from '../services/oauthService';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: StorageAccount[];
  onAddAccount: (account: StorageAccount) => void;
  onRemoveAccount: (accountId: string) => void;
  onSetAnchor: (accountId: string) => void;
  isMockMode?: boolean;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onAddAccount,
  onRemoveAccount,
  onSetAnchor,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<CloudProvider>('google-drive');
  const [connectMode, setConnectMode] = useState<'quick' | 'custom'>('quick');

  // Quick connect form fields
  const [quickEmail, setQuickEmail] = useState('');
  const [quickLabel, setQuickLabel] = useState('');
  const [quickCapacityGB, setQuickCapacityGB] = useState('15');

  // Custom OAuth PKCE / S3 fields
  const [customClientId, setCustomClientId] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleQuickAdd = () => {
    const meta = PROVIDERS_META[activeTab];
    const capacityBytes = (parseFloat(quickCapacityGB) || 15) * 1024 * 1024 * 1024;
    const defaultEmail = `${activeTab}-user-${Math.random().toString(36).substring(2, 6)}@cloud.dev`;

    const newAccount: StorageAccount = {
      id: `acc-${activeTab}-${Date.now()}`,
      provider: activeTab,
      email: quickEmail.trim() || defaultEmail,
      name: quickLabel.trim() || `${meta.name} (Account ${accounts.length + 1})`,
      role: 'worker', // By default worker
      totalCapacity: capacityBytes,
      usedCapacity: 0,
      connectedAt: new Date().toISOString(),
      isMock: true,
    };

    onAddAccount(newAccount);
    setQuickEmail('');
    setQuickLabel('');
  };

  const handleCustomConnect = async () => {
    setAuthError(null);
    setIsLoadingAuth(true);

    try {
      if (activeTab === 's3-r2') {
        if (!s3Bucket.trim() || !s3Endpoint.trim()) {
          throw new Error('Please provide S3 Bucket and Endpoint URL');
        }

        const newAccount: StorageAccount = {
          id: `acc-s3-${Date.now()}`,
          provider: 's3-r2',
          email: `${s3Bucket.trim()}@${new URL(s3Endpoint).hostname}`,
          name: `S3: ${s3Bucket.trim()}`,
          role: 'worker',
          totalCapacity: 10 * 1024 * 1024 * 1024,
          usedCapacity: 0,
          connectedAt: new Date().toISOString(),
          isMock: false,
          authDetails: {
            bucket: s3Bucket.trim(),
            endpoint: s3Endpoint.trim(),
            accessKeyId: s3AccessKey.trim(),
            secretAccessKey: s3SecretKey.trim(),
          },
        };
        onAddAccount(newAccount);
      } else {
        // OAuth 2.0 PKCE Flow
        const authResult = await startOAuthPKCEFlow(activeTab, customClientId.trim() || undefined);
        const meta = PROVIDERS_META[activeTab];

        const newAccount: StorageAccount = {
          id: `acc-${activeTab}-${Date.now()}`,
          provider: activeTab,
          email: `${activeTab}-oauth-user@gmail.com`,
          name: `${meta.name} (OAuth Connected)`,
          role: 'worker',
          totalCapacity: meta.defaultCapacity,
          usedCapacity: 0,
          connectedAt: new Date().toISOString(),
          isMock: false,
          authDetails: {
            accessToken: authResult.code, // In direct SPA, exchange token or store code
            refreshToken: 'mock-refresh-token-' + Date.now(),
          },
        };
        onAddAccount(newAccount);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Linked Cloud Accounts</h3>
              <p className="text-[11px] text-slate-400">
                Pool multiple free tiers into one unified virtual storage drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-6 overflow-y-auto flex-1">
          {/* Active Pooled Drives List */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              Currently Pooled Accounts ({accounts.length})
            </h4>
            <div className="space-y-2">
              {accounts.map((acc) => {
                const meta = PROVIDERS_META[acc.provider];
                const usedPct = acc.totalCapacity > 0 ? (acc.usedCapacity / acc.totalCapacity) * 100 : 0;
                const isAnchor = acc.role === 'anchor';

                return (
                  <div
                    key={acc.id}
                    className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">
                            {acc.name || meta.name}
                          </span>
                          {isAnchor ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Anchor Account
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              Worker
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{acc.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-200">
                          {formatBytes(acc.usedCapacity)} / {formatBytes(acc.totalCapacity)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {usedPct.toFixed(1)}% full
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {acc.provider === 'google-drive' && !isAnchor && (
                          <button
                            onClick={() => onSetAnchor(acc.id)}
                            className="px-2 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-750 text-amber-300 hover:text-amber-200 rounded-lg border border-slate-700 transition-colors"
                            title="Set this Google Drive account as the primary Anchor for appDataFolder catalog syncing"
                          >
                            Set Anchor
                          </button>
                        )}

                        {accounts.length > 1 && (
                          <button
                            onClick={() => onRemoveAccount(acc.id)}
                            className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition-colors"
                            title="Disconnect Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connect New Cloud Storage Section */}
          <div className="border-t border-slate-800 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Connect New Cloud Storage
              </h4>

              {/* Mode switch */}
              <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                <button
                  onClick={() => setConnectMode('quick')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    connectMode === 'quick' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Instant 1-Click
                </button>
                <button
                  onClick={() => setConnectMode('custom')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    connectMode === 'custom' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  OAuth PKCE / S3
                </button>
              </div>
            </div>

            {/* Provider Tabs */}
            <div className="grid grid-cols-3 gap-2">
              {(['google-drive', 'onedrive', 's3-r2'] as CloudProvider[]).map((p) => {
                const meta = PROVIDERS_META[p];
                const isSelected = activeTab === p;

                return (
                  <button
                    key={p}
                    onClick={() => setActiveTab(p)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500'
                        : 'bg-slate-850 hover:bg-slate-800 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-xs font-bold text-white truncate">{meta.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {p === 's3-r2' ? '10 GB Free Tier' : p === 'google-drive' ? '15 GB Free' : '5 GB Free'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Form based on Connect Mode */}
            {connectMode === 'quick' ? (
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Account Email / ID
                    </label>
                    <input
                      type="email"
                      value={quickEmail}
                      onChange={(e) => setQuickEmail(e.target.value)}
                      placeholder={`e.g. storage.${Math.floor(Math.random() * 900 + 100)}@gmail.com`}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Account Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={quickLabel}
                      onChange={(e) => setQuickLabel(e.target.value)}
                      placeholder="e.g. Secondary Drive"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Free Tier Capacity (GB)
                    </label>
                    <select
                      value={quickCapacityGB}
                      onChange={(e) => setQuickCapacityGB(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="5">5 GB (Standard OneDrive)</option>
                      <option value="10">10 GB (Standard Cloudflare R2 / S3)</option>
                      <option value="15">15 GB (Standard Google Drive)</option>
                      <option value="20">20 GB (Extended Tier)</option>
                      <option value="50">50 GB (High Capacity Tier)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400">
                    Will add <strong>{quickCapacityGB} GB</strong> to your pooled virtual drive.
                  </div>
                  <button
                    onClick={handleQuickAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Pool Account</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                {activeTab === 's3-r2' ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Bucket Name
                        </label>
                        <input
                          type="text"
                          value={s3Bucket}
                          onChange={(e) => setS3Bucket(e.target.value)}
                          placeholder="my-cloudmesh-bucket"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          S3 Endpoint URL
                        </label>
                        <input
                          type="text"
                          value={s3Endpoint}
                          onChange={(e) => setS3Endpoint(e.target.value)}
                          placeholder="https://<account-id>.r2.cloudflarestorage.com"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Access Key ID
                        </label>
                        <input
                          type="text"
                          value={s3AccessKey}
                          onChange={(e) => setS3AccessKey(e.target.value)}
                          placeholder="Key ID..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Secret Access Key (Encrypted in Vault)
                        </label>
                        <input
                          type="password"
                          value={s3SecretKey}
                          onChange={(e) => setS3SecretKey(e.target.value)}
                          placeholder="Secret Key..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      OAuth 2.0 Client ID (Optional override)
                    </label>
                    <input
                      type="text"
                      value={customClientId}
                      onChange={(e) => setCustomClientId(e.target.value)}
                      placeholder={`Leave blank to use default ${PROVIDERS_META[activeTab].name} integration`}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-500">
                      Uses direct browser PKCE flow (code_verifier + code_challenge SHA-256) with zero backend servers.
                    </p>
                  </div>
                )}

                {authError && (
                  <div className="text-[11px] text-red-400 p-2 bg-red-950/30 rounded-lg border border-red-500/20">
                    {authError}
                  </div>
                )}

                <div className="flex items-center justify-end pt-1">
                  <button
                    onClick={handleCustomConnect}
                    disabled={isLoadingAuth}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {isLoadingAuth ? 'Connecting...' : `Connect ${PROVIDERS_META[activeTab].name}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
