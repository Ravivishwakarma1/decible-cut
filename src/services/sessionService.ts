// ============================================================
// DecibelCut — Session Service (IndexedDB)
// Auto-saves and restores editing session
// ============================================================

import type { SilenceDetectionConfig } from '../types/processing.types';
import type { AudioRegion } from '../types/audio.types';
import {
  SESSION_DB_NAME,
  SESSION_DB_VERSION,
  SESSION_STORE_NAME,
  SESSION_KEY,
} from '../utils/constants';

export interface SessionData {
  timestamp: number;
  fileName?: string;
  fileSize?: number;
  config?: SilenceDetectionConfig;
  presetId?: string;
  silenceRegions?: AudioRegion[];
  activeRegions?: AudioRegion[];  // user's manual edits
  undoStack?: string[];           // serialized action IDs
  zoom?: number;
  scrollLeft?: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SESSION_DB_NAME, SESSION_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSession(data: SessionData): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SESSION_STORE_NAME);
      store.put({ key: SESSION_KEY, ...data });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Session save is non-critical; swallow errors silently
  }
}

export async function loadSession(): Promise<SessionData | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE_NAME, 'readonly');
      const store = tx.objectStore(SESSION_STORE_NAME);
      const request = store.get(SESSION_KEY);
      request.onsuccess = () => {
        db.close();
        const result = request.result as (SessionData & { key: string }) | undefined;
        resolve(result ?? null);
      };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SESSION_STORE_NAME);
      store.delete(SESSION_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Silent
  }
}

/**
 * Whether a saved session from within the last 24 hours exists
 */
export async function hasRecentSession(): Promise<boolean> {
  const session = await loadSession();
  if (!session) return false;
  const age = Date.now() - session.timestamp;
  return age < 24 * 60 * 60 * 1000;
}
