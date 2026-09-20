import { appStorage } from './storage';
import { api } from '../api/client';
import { ScanRecord } from '../types';

export interface OfflineScanItem {
  clientScanId: string;
  timestamp: string;
  gtin?: string;
  imageBase64: string;
}

const OFFLINE_QUEUE_KEY = 'praman_offline_scans_queue';
const DEVICE_ID_KEY = 'praman_device_id';

function generateDeviceId(): string {
  return 'device_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

export async function getDeviceId(): Promise<string> {
  let id = await appStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateDeviceId();
    await appStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function getOfflineQueue(): Promise<OfflineScanItem[]> {
  try {
    const data = await appStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function enqueueOfflineScan(item: OfflineScanItem): Promise<void> {
  const queue = await getOfflineQueue();
  queue.push(item);
  await appStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function flushOfflineQueue(): Promise<{ syncedCount: number; results: ScanRecord[] }> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, results: [] };
  }

  const deviceId = await getDeviceId();
  try {
    const res = await fetch(`${api.getBaseUrl()}/api/scans/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...api.getHeaders(),
      },
      body: JSON.stringify({
        deviceId,
        scans: queue,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const syncedIds = new Set(data.syncedClientIds || []);
      const remaining = queue.filter((item) => !syncedIds.has(item.clientScanId));
      await appStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      return {
        syncedCount: data.syncedCount || 0,
        results: data.results || [],
      };
    }
  } catch (err) {
    console.warn('[OfflineQueue] Flush sync failed (backend still offline):', err);
  }

  return { syncedCount: 0, results: [] };
}
