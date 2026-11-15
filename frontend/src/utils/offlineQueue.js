/**
 * Offline Transaction Queue & Synchronization Helper
 * Enables construction site supervisors to record petty cash entries
 * even when working in basements or remote sites with patchy connectivity.
 */

const STORAGE_KEY = 'rebar_pc_offline_queue_v1';

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to read offline petty cash queue:', err);
    return [];
  }
}

export function enqueueOfflineTransaction(payload) {
  try {
    const currentQueue = getOfflineQueue();
    const tempId = 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const item = {
      localId: tempId,
      payload,
      queuedAt: new Date().toISOString()
    };
    currentQueue.push(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentQueue));
    return tempId;
  } catch (err) {
    console.error('Failed to enqueue offline transaction:', err);
    return null;
  }
}

export function dequeueOfflineTransaction(localId) {
  try {
    const currentQueue = getOfflineQueue();
    const updated = currentQueue.filter(item => item.localId !== localId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to dequeue offline transaction:', err);
    return getOfflineQueue();
  }
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Attempt to flush all queued transactions to the backend
 * @param {Function} apiCreateFn - Function returning promise from pettyCashApi.createTransaction
 * @param {Function} onProgress - Callback(successCount, failedCount)
 */
export async function syncOfflineQueue(apiCreateFn, onProgress) {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await apiCreateFn(item.payload);
      if (res?.success) {
        dequeueOfflineTransaction(item.localId);
        synced++;
      } else {
        failed++;
      }
    } catch (err) {
      console.warn('Failed to sync offline item:', item.localId, err);
      failed++;
    }
  }

  if (onProgress) onProgress(synced, failed);
  return { synced, failed, remaining: getOfflineQueue().length };
}

