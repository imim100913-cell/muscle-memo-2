/**
 * Anti-Gravity 2.0: PC <=> Smartphone Instant Bridge & Smart Data Merge Service
 * Supports:
 * 1. Local Wi-Fi (LAN) instant state transfer via Vite Mobile Bridge API (/api/sync-state)
 * 2. Serverless compressed URL / Share token transfer (CompressionStream + Base64URL)
 * 3. Non-destructive smart workout merging (combines PC and Smartphone logs without data loss)
 */

export function collectLocalSyncData(includeApiKey = true) {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('muscle-memo-')) {
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

  const updatedKeys = [];
  let mergedSessionsCount = 0;

  if (mode === 'overwrite') {
    Object.entries(incomingData).forEach(([k, v]) => {
      if (k.startsWith('muscle-memo-') && typeof v === 'string') {
        localStorage.setItem(k, v);
        updatedKeys.push(k);
      }
    });
    return { mergedSessionsCount: 0, updatedKeys };
  }

  // Smart Merge Mode
  Object.entries(incomingData).forEach(([key, incomingRaw]) => {
    if (!key.startsWith('muscle-memo-') || typeof incomingRaw !== 'string') return;

    if (key === 'muscle-memo-workouts') {
      try {
        const incomingList = JSON.parse(incomingRaw);
        const localRaw = localStorage.getItem('muscle-memo-workouts');
        const localList = localRaw ? JSON.parse(localRaw) : [];

        if (Array.isArray(incomingList) && Array.isArray(localList)) {
          const map = new Map();

          const countSets = (rec) => {
            let count = 0;
            for (let i = 1; i <= 30; i++) {
              if (rec[`set${i}_weight`] !== undefined && rec[`set${i}_weight`] !== null && rec[`set${i}_weight`] !== '') {
                count++;
              }
            }
            return count;
          };

          localList.forEach((rec) => {
            const k = `${rec.date || ''}_${rec.exercise || rec.id}`;
            map.set(k, rec);
          });

          incomingList.forEach((inc) => {
            const k = `${inc.date || ''}_${inc.exercise || inc.id}`;
            const existing = map.get(k);
            if (!existing) {
              map.set(k, inc);
            } else {
              // Keep record with more logged sets, or newer timestamp
              const incSets = countSets(inc);
              const extSets = countSets(existing);
              if (incSets > extSets || (incSets === extSets && (inc.timestamp || 0) > (existing.timestamp || 0))) {
                map.set(k, inc);
              }
            }
          });

          const merged = Array.from(map.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          mergedSessionsCount = merged.length;
          localStorage.setItem('muscle-memo-workouts', JSON.stringify(merged));
          updatedKeys.push(key);
          return;
        }
      } catch {
        // Fallback to direct set if parsing fails
      }
    }

    if (key === 'muscle-memo-custom-exercises') {
      try {
        const incCustom = JSON.parse(incomingRaw);
        const locRaw = localStorage.getItem('muscle-memo-custom-exercises');
        const locCustom = locRaw ? JSON.parse(locRaw) : {};
        const mergedCustom = { ...locCustom };

        Object.keys(incCustom).forEach((part) => {
          const listA = Array.isArray(locCustom[part]) ? locCustom[part] : [];
          const listB = Array.isArray(incCustom[part]) ? incCustom[part] : [];
          const seen = new Set();
          const combined = [];
          [...listA, ...listB].forEach((item) => {
            const name = (typeof item === 'object' && item !== null ? item.name : String(item)).trim();
            if (name && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase());
              combined.push(item);
            }
          });
          mergedCustom[part] = combined;
        });

        localStorage.setItem('muscle-memo-custom-exercises', JSON.stringify(mergedCustom));
        updatedKeys.push(key);
        return;
      } catch {
        // Fallback
      }
    }

    if (key === 'muscle-memo-gemini-key') {
      // Do not overwrite an existing non-empty API key with an empty string
      try {
        const parsed = JSON.parse(incomingRaw);
        if (!parsed) return;
      } catch {
        if (!incomingRaw) return;
      }
    }

    localStorage.setItem(key, incomingRaw);
    updatedKeys.push(key);
  });

  // Always mark onboarded after receiving synced state
  localStorage.setItem('muscle-memo-onboarded', JSON.stringify(true));
  return { mergedSessionsCount, updatedKeys };
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
export async function pushSyncSnapshotToServer(sourceDevice = 'PC', includeApiKey = true) {
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
export async function encodeSyncToken(includeApiKey = true) {
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
