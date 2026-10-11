import { db, recalculateAccountUsage } from './db';
import type { CloudFile, StorageAccount, TransferTask } from '../types';

export const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB chunks

// Track active controllers for cancellation and pausing
const activeAbortControllers = new Map<string, AbortController>();
let activeTransfersCount = 0;
let activeWakeLock: any = null;

/**
 * Screen Wake Lock Management
 */
async function acquireWakeLock(): Promise<void> {
  activeTransfersCount++;
  if (activeWakeLock) return;

  try {
    if ('wakeLock' in navigator) {
      activeWakeLock = await (navigator as any).wakeLock.request('screen');
      activeWakeLock.addEventListener('release', () => {
        activeWakeLock = null;
      });
      console.log('[CloudMesh] Screen Wake Lock acquired.');
    }
  } catch (err) {
    console.warn('[CloudMesh] Screen Wake Lock unavailable or denied:', err);
  }
}

async function releaseWakeLock(): Promise<void> {
  activeTransfersCount = Math.max(0, activeTransfersCount - 1);
  if (activeTransfersCount === 0 && activeWakeLock) {
    try {
      await activeWakeLock.release();
      activeWakeLock = null;
      console.log('[CloudMesh] Screen Wake Lock released.');
    } catch (err) {
      console.warn('[CloudMesh] Error releasing wake lock:', err);
    }
  }
}

/**
 * Creates a readable stream yielding synthetic or blob-backed 8MB chunks
 * strictly keeping memory footprint flat (< 30 MB).
 */
function createChunkSourceStream(
  _file: CloudFile,
  startByte: number,
  totalBytes: number,
  existingBlob?: Blob
): ReadableStream<Uint8Array> {
  let currentByte = startByte;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (currentByte >= totalBytes) {
        controller.close();
        return;
      }

      const endByte = Math.min(currentByte + CHUNK_SIZE, totalBytes);
      const chunkSize = endByte - currentByte;

      let chunkBytes: Uint8Array;
      if (existingBlob) {
        const slice = existingBlob.slice(currentByte, endByte);
        const arrayBuf = await slice.arrayBuffer();
        chunkBytes = new Uint8Array(arrayBuf);
      } else {
        // Flat buffer allocation: exactly one chunk in memory at a time
        chunkBytes = new Uint8Array(chunkSize);
        // Fill pseudo-content or zeroed
        for (let i = 0; i < Math.min(chunkSize, 1024); i++) {
          chunkBytes[i] = (i + currentByte) % 256;
        }
      }

      controller.enqueue(chunkBytes);
      currentByte = endByte;
    },
  });
}

/**
 * Streams data between accounts using browser Web Streams API with 8MB chunks,
 * ensuring memory remains < 30 MB and allowing cancel / pause / resume.
 */
export async function transferBetweenAccounts(
  file: CloudFile,
  sourceAccount: StorageAccount,
  targetAccount: StorageAccount,
  onProgress?: (task: TransferTask) => void
): Promise<TransferTask> {
  // Check if there is an existing task to resume
  let existingTask = await db.transfers.where('fileId').equals(file.id).first();

  const totalBytes = file.sizeBytes || 1024 * 1024 * 32; // Default to 32MB if 0
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  let task: TransferTask;
  if (existingTask && (existingTask.status === 'paused' || existingTask.status === 'failed')) {
    task = {
      ...existingTask,
      status: 'transferring',
      error: undefined,
    };
  } else {
    task = {
      id: 'trans-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      fileId: file.id,
      fileName: file.name,
      sourceAccountId: sourceAccount.id,
      targetAccountId: targetAccount.id,
      bytesTransferred: 0,
      totalBytes,
      status: 'transferring',
      progressPercentage: 0,
      speedBytesPerSec: 0,
      currentChunk: 0,
      totalChunks,
      startedAt: new Date().toISOString(),
    };
  }

  await db.transfers.put(task);
  if (onProgress) onProgress(task);

  const abortController = new AbortController();
  activeAbortControllers.set(task.id, abortController);
  await acquireWakeLock();

  const startChunk = task.currentChunk || 0;
  const startByte = startChunk * CHUNK_SIZE;

  // Retrieve any real stored blob
  const storedBlobItem = await db.fileBlobs.get(file.id);
  const existingBlob = file.blobData || storedBlobItem?.blob;

  // Construct source chunk stream
  const chunkStream = createChunkSourceStream(file, startByte, totalBytes, existingBlob);
  const reader = chunkStream.getReader();

  let bytesTransferred = task.bytesTransferred || startByte;
  let chunkIndex = startChunk;
  let lastTime = performance.now();
  let lastBytes = bytesTransferred;

  try {
    while (true) {
      if (abortController.signal.aborted) {
        throw new DOMException('Transfer aborted by user', 'AbortError');
      }

      const { done, value: chunk } = await reader.read();
      if (done) {
        break;
      }

      chunkIndex++;

      // Simulate streaming pipe upload latency (e.g. realistic 15-30 MB/s speed)
      // Chunks are 8MB; let's simulate realistic chunk processing delay
      const simulateDelayMs = Math.min(260, Math.max(120, Math.round((chunk.byteLength / (1024 * 1024)) * 30)));
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, simulateDelayMs);
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Transfer aborted by user', 'AbortError'));
        });
      });

      bytesTransferred += chunk.byteLength;
      const now = performance.now();
      const timeDelta = (now - lastTime) / 1000;
      const bytesDelta = bytesTransferred - lastBytes;
      const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0;

      lastTime = now;
      lastBytes = bytesTransferred;

      const progress = Math.min(100, Math.round((bytesTransferred / totalBytes) * 100));

      task.bytesTransferred = bytesTransferred;
      task.currentChunk = chunkIndex;
      task.progressPercentage = progress;
      task.speedBytesPerSec = Math.round(speed);

      await db.transfers.put(task);
      if (onProgress) onProgress({ ...task });
    }

    // Transfer finished successfully!
    task.status = 'completed';
    task.progressPercentage = 100;
    task.bytesTransferred = totalBytes;
    task.speedBytesPerSec = 0;
    task.completedAt = new Date().toISOString();
    await db.transfers.put(task);

    // Update physical file account in virtual file system
    await db.files.update(file.id, {
      accountId: targetAccount.id,
      modifiedAt: new Date().toISOString(),
    });

    // Update used storage on both accounts
    await recalculateAccountUsage(sourceAccount.id);
    await recalculateAccountUsage(targetAccount.id);

    if (onProgress) onProgress({ ...task });
    return task;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      const currentTask = await db.transfers.get(task.id);
      if (currentTask?.status === 'paused') {
        task.status = 'paused';
      } else {
        task.status = 'cancelled';
      }
    } else {
      task.status = 'failed';
      task.error = err.message || 'Streaming transfer failed';
    }
    task.speedBytesPerSec = 0;
    await db.transfers.put(task);
    if (onProgress) onProgress({ ...task });
    return task;
  } finally {
    reader.releaseLock();
    activeAbortControllers.delete(task.id);
    await releaseWakeLock();
  }
}

/**
 * Cancel an active transfer
 */
export async function cancelTransfer(taskId: string): Promise<void> {
  const controller = activeAbortControllers.get(taskId);
  await db.transfers.update(taskId, { status: 'cancelled' });
  if (controller) {
    controller.abort();
  }
}

/**
 * Pause an active transfer (saving progress for resume)
 */
export async function pauseTransfer(taskId: string): Promise<void> {
  const controller = activeAbortControllers.get(taskId);
  await db.transfers.update(taskId, { status: 'paused' });
  if (controller) {
    controller.abort();
  }
}

/**
 * Resume a paused transfer
 */
export async function resumeTransfer(
  taskId: string,
  onProgress?: (task: TransferTask) => void
): Promise<TransferTask | null> {
  const task = await db.transfers.get(taskId);
  if (!task) return null;

  const file = await db.files.get(task.fileId);
  const source = await db.accounts.get(task.sourceAccountId);
  const target = await db.accounts.get(task.targetAccountId);

  if (!file || !source || !target) {
    await db.transfers.update(taskId, { status: 'failed', error: 'Source or target account missing' });
    return null;
  }

  return await transferBetweenAccounts(file, source, target, onProgress);
}

/**
 * Clear completed and cancelled transfers from the list
 */
export async function clearFinishedTransfers(): Promise<void> {
  const finished = await db.transfers
    .where('status')
    .anyOf(['completed', 'cancelled', 'failed'])
    .toArray();
  const ids = finished.map((t) => t.id);
  await db.transfers.bulkDelete(ids);
}
