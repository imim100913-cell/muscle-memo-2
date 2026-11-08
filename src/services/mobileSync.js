import { persistEntries, recoverPending } from '../lib/persistence.js';
import { mergeWorkoutSets, migrateToFlatWorkouts } from '../lib/workoutMigration.js';

/**
 * Anti-Gravity 2.0: PC <=> Smartphone Instant Bridge & Smart Data Merge Service
 * Supports:
 * 1. Local Wi-Fi (LAN) instant state transfer via Vite Mobile Bridge API (/api/sync-state)
 * 2. Serverless compressed URL / Share token transfer (CompressionStream + Base64URL)
 * 3. Non-destructive smart workout merging (combines PC and Smartphone logs without data loss)
 */

export function collectLocalSyncData(includeApiKey = false) {
  recoverPending(localStorage);
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('muscle-memo-') && !key.startsWith('muscle-memo-internal-')) {
      if (!includeApiKey && key === 'muscle-memo-gemini-key') continue;
      if (key === 'muscle-memo-timer-endtime') continue;
      const val = localStorage.getItem(key);
      if (val !== null) {
        data[key] = val;
      }
    }
  }
  return data;
}

/**
 * Smartly merges incoming muscle-memo data into localStorage without losing sets on either device.
 * @param {Object} incomingData - Key-value map of localStorage strings
 * @param {'merge'|'overwrite'} mode
 * @returns {{ mergedSessionsCount: number, updatedKeys: string[] }}
 */
export function applySyncedData(incomingData, mode = 'merge') {
  if (!incomingData || typeof incomingData !== 'object') {
    throw new Error('同期データが空または不正です。');
  }

  recoverPending(localStorage);
  if (Array.isArray(incomingData) || !['merge', 'overwrite'].includes(mode)) throw new Error('同期形式が不正です');
  if (localStorage.getItem('muscle-memo-deletion-state') !== null) throw new Error('削除履歴があります。削除同期は未対応のため、自動同期・復元を中止しました。両端末の原本を退避して確認してください');
  const entries = {};
  let mergedSessionsCount = 0;
  for (const [key, value] of Object.entries(incomingData)) {
    if (!key.startsWith('muscle-memo-') || key.startsWith('muscle-memo-internal-') || typeof value !== 'string') throw new Error('同期キーまたは値が不正です');
    if (/delet|tombstone/i.test(key)) throw new Error('削除同期は未対応です。同期を中止しました');
    const parsed = JSON.parse(value);
    if (key === 'muscle-memo-workouts') {
      if (parsed.some?.(record => record?.deletedAt || record?.deleted || record?.isDeleted)) throw new Error('削除同期は未対応です');
      const local = localStorage.getItem(key);
      const flat = mergeWorkoutSets(local === null ? [] : JSON.parse(local), migrateToFlatWorkouts(parsed));
      entries[key] = JSON.stringify(flat);
      mergedSessionsCount = flat.length;
    } else if (key === 'muscle-memo-custom-exercises' && mode === 'merge') {
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('種目設定が不正です');
      const merged = { ...current };
      for (const [part, exercises] of Object.entries(parsed)) {
        if (!Array.isArray(exercises)) throw new Error('種目設定が不正です');
        const unique = new Map();
        for (const exercise of [...(current[part] || []), ...exercises]) {
          const name = typeof exercise === 'string' ? exercise : exercise?.name;
          if (typeof name !== 'string' || !name.trim()) throw new Error('種目名が不正です');
          if (!unique.has(name.trim().toLowerCase())) unique.set(name.trim().toLowerCase(), exercise);
        }
        merged[part] = [...unique.values()];
      }
      entries[key] = JSON.stringify(merged);
    } else {
      if (key === 'muscle-memo-gemini-key' && !parsed) continue;
      entries[key] = value;
    }
  }
  persistEntries(entries);
  return { mergedSessionsCount, updatedKeys: Object.keys(entries) };
}

export function restoreBackup(payload) {
  if (payload?.application !== 'Anti-Gravity Workout Tracker' || payload.version !== '2.0' || !payload.data || Array.isArray(payload.data)) throw new Error('バックアップ形式が不正です');
  const data = Object.fromEntries(Object.entries(payload.data).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return applySyncedData(data, 'overwrite');
}

/**
 * Queries the local Vite Mobile Bridge for LAN IP and sync snapshot status.
 */
export async function fetchNetworkInfo() {
  try {
    const res = await fetch('/api/network-info', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Pushes current device's localStorage state to the Vite Mobile Bridge server.
 */
export async function pushSyncSnapshotToServer(sourceDevice = 'PC', includeApiKey = false) {
  const data = collectLocalSyncData(includeApiKey);
  const res = await fetch('/api/sync-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceDevice,
      data
    })
  });
  if (!res.ok) {
    throw new Error('ローカル同期サーバーへの送信に失敗しました');
  }
  return await res.json();
}

/**
 * Pulls the latest shared snapshot from the Vite Mobile Bridge server.
 */
export async function pullSyncSnapshotFromServer() {
  const res = await fetch('/api/sync-state', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('ローカル同期サーバーからの取得に失敗しました');
  }
  return await res.json();
}

/**
 * Encodes sync data into a compact URL-safe token (using CompressionStream when supported).
 */
export async function encodeSyncToken(includeApiKey = false) {
  const payloadObj = {
    v: 2,
    t: Date.now(),
    d: collectLocalSyncData(includeApiKey)
  };
  const jsonStr = JSON.stringify(payloadObj);
  const uint8 = new TextEncoder().encode(jsonStr);

  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(uint8);
      writer.close();
      const compressedBuf = await new Response(cs.readable).arrayBuffer();
      const bytes = new Uint8Array(compressedBuf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `z.${b64}`;
    } catch {
      // Fallback to uncompressed base64url
    }
  }

  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `u.${b64}`;
}

/**
 * Decodes a compact sync token back into the sync data object.
 */
export async function decodeSyncToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('無効な同期コードです');
  }
  const trimmed = token.trim();
  const isCompressed = trimmed.startsWith('z.');
  const rawB64 = (isCompressed || trimmed.startsWith('u.')) ? trimmed.slice(2) : trimmed;

  const b64 = rawB64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  let jsonStr;
  if (isCompressed && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const decompressedBuf = await new Response(ds.readable).arrayBuffer();
    jsonStr = new TextDecoder().decode(decompressedBuf);
  } else {
    jsonStr = new TextDecoder().decode(bytes);
  }

  const parsed = JSON.parse(jsonStr);
  if (!parsed || !parsed.d) {
    throw new Error('同期データの構造が不正です');
  }
  return parsed;
}
