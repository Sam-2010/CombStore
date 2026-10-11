import React, { useState } from 'react';
import {
  Folder,
  File,
  FileText,
  Image,
  Film,
  Archive,
  Code,
  Table as TableIcon,
  ChevronRight,
  Search,
  LayoutGrid,
  List,
  Upload,
  FolderPlus,
  ArrowRightLeft,
  Download,
  Trash2,
  Edit2,
  RefreshCw
} from 'lucide-react';
import type { CloudFile, StorageAccount } from '../types';
import { PROVIDERS_META } from '../services/cloudProviderService';
import { formatBytes, formatDate, getFileExtension } from '../lib/utils';

interface FileListProps {
  files: CloudFile[];
  accounts: StorageAccount[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenFileMoveModal: (file: CloudFile) => void;
  onUploadFile: (file: File) => void;
  onOpenNewFolderModal: () => void;
  onDeleteFile: (file: CloudFile) => void;
  onRenameFile: (file: CloudFile) => void;
  onDownloadFile: (file: CloudFile) => void;
  selectedAccountId: string | null;
  onSelectAccount?: (accountId: string | null) => void;
  onSimulateConflict: () => void;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  accounts,
  currentPath,
  onNavigate,
  onOpenFileMoveModal,
  onUploadFile,
  onOpenNewFolderModal,
  onDeleteFile,
  onRenameFile,
  onDownloadFile,
  selectedAccountId,
  onSimulateConflict,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isDragOver, setIsDragOver] = useState(false);

  // Accounts lookup dictionary
  const accountsMap = new Map<string, StorageAccount>();
  accounts.forEach((a) => accountsMap.set(a.id, a));

  // Breadcrumbs parsing
  const pathSegments = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

  // Filtering files:
  // If search query is present, search across all files in current level or entire drive
  let displayedFiles = files;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayedFiles = files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.virtualPath.toLowerCase().includes(q) ||
        getFileExtension(f.name).includes(q)
    );
  } else {
    // Show items where parentPath === currentPath
    displayedFiles = files.filter((f) => f.parentPath === currentPath);
  }

  // Filter by selected account if any
  if (selectedAccountId) {
    displayedFiles = displayedFiles.filter((f) => f.accountId === selectedAccountId);
  }

  // Sort folders first, then files alphabetically
  displayedFiles.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  // Helper to pick file icon
  const renderFileIcon = (file: CloudFile) => {
    if (file.isFolder) {
      return <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />;
    }
    const ext = getFileExtension(file.name);
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return <Image className="w-5 h-5 text-emerald-400" />;
    }
    if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
      return <Film className="w-5 h-5 text-purple-400" />;
    }
    if (['zip', 'gz', 'tar', 'rar', '7z'].includes(ext)) {
      return <Archive className="w-5 h-5 text-orange-400" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return <TableIcon className="w-5 h-5 text-emerald-500" />;
    }
    if (['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext)) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    if (['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'html', 'css'].includes(ext)) {
      return <Code className="w-5 h-5 text-indigo-400" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  // Drag and drop handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        onUploadFile(e.dataTransfer.files[i]);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        onUploadFile(e.target.files[i]);
      }
      e.target.value = '';
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col overflow-hidden bg-slate-950 relative transition-colors ${
        isDragOver ? 'bg-indigo-950/30 ring-2 ring-indigo-500 ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Action Bar & Breadcrumbs */}
      <div className="p-4 sm:p-6 border-b border-slate-800 space-y-4 bg-slate-900/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Breadcrumbs Navigation */}
          <div className="flex items-center gap-1.5 text-sm overflow-x-auto py-1">
            <button
              onClick={() => onNavigate('/')}
              className={`px-2 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                currentPath === '/'
                  ? 'text-white bg-slate-800'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>Unified Root</span>
            </button>

            {pathSegments.map((segment, index) => {
              const segmentPath = '/' + pathSegments.slice(0, index + 1).join('/');
              const isLast = index === pathSegments.length - 1;

              return (
                <React.Fragment key={segmentPath}>
                  <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <button
                    onClick={() => onNavigate(segmentPath)}
                    className={`px-2 py-1 rounded-md transition-colors font-medium truncate max-w-[160px] ${
                      isLast
                        ? 'text-white bg-slate-800'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {segment}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Hidden file input */}
            <input
              type="file"
              id="cloudmesh-file-upload"
              className="hidden"
              multiple
              onChange={handleFileInputChange}
            />
            <label
              htmlFor="cloudmesh-file-upload"
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-600/30 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Files</span>
            </label>

            <button
              onClick={onOpenNewFolderModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all"
            >
              <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>New Folder</span>
            </button>

            {/* Simulate 412 Conflict Demo Button */}
            <button
              onClick={onSimulateConflict}
              title="Test Optimistic Locking: Simulates an out-of-band remote update to trigger HTTP 412 Precondition Failed and automated timestamp merge"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-amber-950/40 text-amber-300 hover:text-amber-200 border border-amber-500/20 text-xs font-medium transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Simulate 412 Conflict</span>
              <span className="xl:hidden">412 Test</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'list'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar & Instant Filter */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files by name, type, or virtual path..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            {displayedFiles.length} {displayedFiles.length === 1 ? 'item' : 'items'}
          </div>
        </div>
      </div>

      {/* Drag overlay notice */}
      {isDragOver && (
        <div className="absolute inset-0 bg-indigo-950/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center border-2 border-dashed border-indigo-400 rounded-xl m-4 pointer-events-none">
          <Upload className="w-12 h-12 text-indigo-400 animate-bounce mb-3" />
          <h3 className="text-lg font-bold text-white">Drop files anywhere to upload</h3>
          <p className="text-sm text-indigo-200">Will stream into current virtual folder ({currentPath})</p>
        </div>
      )}

      {/* File List / Grid Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {displayedFiles.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl">
            <Folder className="w-12 h-12 text-slate-700 mb-3" />
            <h4 className="text-sm font-semibold text-slate-300 mb-1">
              {searchQuery ? 'No matching files found' : 'This folder is empty'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              {searchQuery
                ? 'Try a different search query or clear the filter.'
                : 'Upload files or create subfolders to start pooling cloud storage.'}
            </p>
            <label
              htmlFor="cloudmesh-file-upload"
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Upload a file</span>
            </label>
          </div>
        ) : viewMode === 'list' ? (
          /* Table View */
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 hidden md:table-cell">Physical Cloud Account</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Size</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Modified</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedFiles.map((file) => {
                  const account = accountsMap.get(file.accountId);
                  const providerMeta = account ? PROVIDERS_META[account.provider] : null;

                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-slate-800/40 group transition-colors"
                    >
                      {/* Name & Icon */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => {
                            if (file.isFolder) {
                              onNavigate(file.virtualPath);
                            }
                          }}
                          className={`flex items-center gap-3 ${
                            file.isFolder ? 'cursor-pointer' : ''
                          }`}
                        >
                          <div className="flex-shrink-0">{renderFileIcon(file)}</div>
                          <div className="truncate max-w-[240px] sm:max-w-xs md:max-w-sm">
                            <div className="font-medium text-slate-200 hover:text-white truncate">
                              {file.name}
                            </div>
                            {searchQuery && (
                              <div className="text-[10px] text-slate-500 truncate">
                                {file.parentPath}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Physical Cloud Account Badge */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        {providerMeta && account ? (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-medium ${providerMeta.badgeBg}`}
                            title={`Stored physically on ${account.email}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: providerMeta.color }}
                            />
                            <span className="truncate max-w-[120px]">
                              {account.name || providerMeta.name}
                            </span>
                            {account.role === 'anchor' && (
                              <span className="text-[9px] font-bold px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded ml-0.5">
                                A
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">Unassigned</span>
                        )}
                      </td>

                      {/* Size */}
                      <td className="py-3 px-4 text-slate-400 hidden sm:table-cell">
                        {file.isFolder ? '--' : formatBytes(file.sizeBytes)}
                      </td>

                      {/* Modified */}
                      <td className="py-3 px-4 text-slate-500 hidden lg:table-cell">
                        {formatDate(file.modifiedAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!file.isFolder && (
                            <button
                              onClick={() => onOpenFileMoveModal(file)}
                              title="Stream Transfer to Another Cloud Account"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium transition-all"
                            >
                              <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                              <span className="hidden sm:inline">Move Cloud</span>
                            </button>
                          )}

                          <button
                            onClick={() => onDownloadFile(file)}
                            title="Download"
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onRenameFile(file)}
                            title="Rename"
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteFile(file)}
                            title="Delete"
                            className="p-1.5 rounded-lg hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedFiles.map((file) => {
              const account = accountsMap.get(file.accountId);
              const providerMeta = account ? PROVIDERS_META[account.provider] : null;

              return (
                <div
                  key={file.id}
                  className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm"
                >
                  <div
                    onClick={() => {
                      if (file.isFolder) onNavigate(file.virtualPath);
                    }}
                    className={file.isFolder ? 'cursor-pointer' : ''}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                        {renderFileIcon(file)}
                      </div>

                      {providerMeta && account && (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-lg border ${providerMeta.badgeBg}`}
                          title={`Hosted on ${account.email}`}
                        >
                          {account.name ? account.name.split(' ')[0] : providerMeta.name}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white truncate mb-1" title={file.name}>
                      {file.name}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                      <span>{file.isFolder ? 'Folder' : formatBytes(file.sizeBytes)}</span>
                      <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Grid card bottom actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
                    {!file.isFolder ? (
                      <button
                        onClick={() => onOpenFileMoveModal(file)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Move</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-600">Virtual Directory</span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onDownloadFile(file)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteFile(file)}
                        className="p-1 rounded hover:bg-red-950/40 text-slate-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
