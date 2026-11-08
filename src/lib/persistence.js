// Originals and a recovery journal must be durable before any ledger replacement.
export const JOURNAL_KEY = 'muscle-memo-internal-pending';
export const ORIGINAL_KEY = 'muscle-memo-internal-original-workouts';
export function writeVerified(storage, key, value) {
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) throw new Error('永続保存の照合に失敗しました');
}
function removeVerified(storage, key) {
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error('永続保存の削除照合に失敗しました');
}
export function recoverPending(storage) {
  const pending = storage.getItem(JOURNAL_KEY);
  if (!pending) return;
  const original = JSON.parse(pending);
  if (!original || typeof original !== 'object' || Array.isArray(original) || Object.entries(original).some(([key, value]) => !key.startsWith('muscle-memo-') || key.startsWith('muscle-memo-internal-') || (value !== null && typeof value !== 'string'))) {
    throw new Error('復旧用ジャーナルが破損しています。原本を保護して保存を停止しました');
  }
  for (const [key, value] of Object.entries(original)) {
    if (value === null) removeVerified(storage, key);
    else writeVerified(storage, key, value);
  }
  removeVerified(storage, JOURNAL_KEY);
}
export function persistEntries(entries, storage = localStorage) {
  recoverPending(storage);
  const original = Object.fromEntries(Object.keys(entries).map(key => [key, storage.getItem(key)]));
  if (entries['muscle-memo-workouts'] !== undefined && original['muscle-memo-workouts'] !== null && storage.getItem(ORIGINAL_KEY) === null) {
    writeVerified(storage, ORIGINAL_KEY, original['muscle-memo-workouts']);
  }
  writeVerified(storage, JOURNAL_KEY, JSON.stringify(original));
  try {
    for (const [key, value] of Object.entries(entries)) writeVerified(storage, key, value);
    removeVerified(storage, JOURNAL_KEY);
  } catch (error) {
    try { recoverPending(storage); } catch { /* Journal retained; next read/write must recover first. */ }
    throw error;
  }
}
