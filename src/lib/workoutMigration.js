import { calculate1RM, getLocalDateKey } from './utils.js';

const missing = value => value === undefined || value === null || value === '';
function number(value, field, { integer = false, min = 0 } = {}) {
  if (missing(value) || !['string', 'number'].includes(typeof value) || String(value).trim() === '') {
    throw new Error(`${field} が欠損または不正です`);
  }
  if (typeof value === 'string' && !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) throw new Error(`${field} が不正です`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || (integer && !Number.isSafeInteger(n))) throw new Error(`${field} が不正です`);
  return n;
}
function identifier(value, field) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) throw new Error(`${field} が不正です`);
  return value;
}

// Never guess measurements, dates or identities. Unknown fields survive round trips.
export function normalizeSingleSet(raw, fallbackIndex = 1) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('セット形式が不正です');
  if (raw.deletedAt != null || raw.deleted === true || raw.isDeleted === true) throw new Error('削除情報を含む記録は自動移行できません');
  const id = identifier(raw.id, 'ID');
  const timestamp = number(raw.timestamp, '作成時刻');
  if (!Number.isFinite(new Date(timestamp).getTime())) throw new Error('作成時刻が不正です');
  const date = raw.date === undefined ? getLocalDateKey(timestamp) : raw.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('日付が不正です');
  const weight = number(raw.weight, '重量');
  const reps = number(raw.reps, '回数', { integer: true, min: 1 });
  const rir = missing(raw.rir) ? null : number(raw.rir, 'RIR', { integer: true });
  const formScore = Object.hasOwn(raw, 'formScore') ? (missing(raw.formScore) ? null : raw.formScore) : (missing(raw.form) ? null : raw.form);
  if (formScore !== null && !['perfect', 'good', 'fail'].includes(formScore)) throw new Error('フォーム評価が不正です');
  const memo = raw.memo ?? raw.note ?? '';
  if (typeof memo !== 'string') throw new Error('メモは文字列である必要があります');
  if (raw.part != null && typeof raw.part !== 'string') throw new Error('部位が不正です');
  if (raw.isPR !== undefined && typeof raw.isPR !== 'boolean') throw new Error('PR評価が不正です');
  const createdAt = raw.createdAt === undefined ? timestamp : number(raw.createdAt, '作成時刻');
  const updatedAt = raw.updatedAt == null ? null : number(raw.updatedAt, '更新時刻');
  if (createdAt !== timestamp || (updatedAt !== null && (!Number.isFinite(new Date(updatedAt).getTime()) || updatedAt < createdAt))) throw new Error('作成・更新時刻が不正です');
  return {
    ...Object.fromEntries(Object.entries(raw).filter(([key]) => !/^set\d+_/.test(key))), id, timestamp, date, createdAt, updatedAt,
    // Legacy sessions cannot be reliably reconstructed; keep each source identity separate.
    sessionId: raw.sessionId === undefined ? `legacy:${id}` : identifier(raw.sessionId, 'セッションID'),
    exercise: identifier(raw.exercise, '種目'), part: raw.part ?? '',
    setNum: number(raw.setNum === undefined ? fallbackIndex : raw.setNum, 'セット番号', { integer: true, min: 1 }),
    weight, reps, rir, formScore, memo,
    interval: missing(raw.interval) ? null : number(raw.interval, 'インターバル'),
    oneRM: number(raw.oneRM === undefined ? calculate1RM(weight, reps) : raw.oneRM, '1RM'),
    isPR: raw.isPR === undefined ? false : raw.isPR
  };
}

export function isLegacyHorizontalWorkout(workouts) {
  return Array.isArray(workouts) && workouts.some(w => w && Object.keys(w).some(k => /^set\d+_(weight|reps)$/.test(k)));
}

export function migrateToFlatWorkouts(rawWorkouts) {
  if (!Array.isArray(rawWorkouts)) throw new Error('記録は配列である必要があります');
  const flat = rawWorkouts.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('記録形式が不正です');
    const indices = [...new Set(Object.keys(item).filter(k => /^set\d+_(weight|reps)$/.test(k)).map(k => Number(k.match(/^set(\d+)_/)[1])))].sort((a, b) => a - b);
    if (!indices.length) return [normalizeSingleSet(item)];
    identifier(item.id, '旧記録ID');
    const sets = indices.filter(i => !missing(item[`set${i}_weight`]) || !missing(item[`set${i}_reps`]));
    if (!sets.length) throw new Error('旧記録に有効なセットがありません');
    return sets.map(i => normalizeSingleSet({
      ...item, id: `${item.id}-${i}`, sessionId: item.sessionId ?? `legacy:${item.id}`, setNum: i,
      weight: item[`set${i}_weight`], reps: item[`set${i}_reps`],
      rir: item[`set${i}_rir`], formScore: item[`set${i}_form`] ?? null,
      memo: item[`set${i}_memo`] ?? item.memo ?? item.note ?? '', interval: item[`set${i}_interval`] ?? item.interval,
      oneRM: undefined, isPR: false
    }));
  });
  // Migration is validation, not deduplication. Ambiguous duplicate IDs must be resolved explicitly.
  const ids = new Set();
  for (const record of flat) {
    if (ids.has(record.id)) throw new Error('IDが重複しています。原本を保全して確認してください');
    ids.add(record.id);
  }
  return flat;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function mergeWorkoutSets(baseList, incomingList) {
  const base = migrateToFlatWorkouts(baseList);
  const incoming = migrateToFlatWorkouts(incomingList);
  const map = new Map(base.map(record => [record.id, record]));
  for (const record of incoming) {
    const existing = map.get(record.id);
    if (existing && JSON.stringify(canonical(existing)) !== JSON.stringify(canonical(record))) {
      // Wall-clock updatedAt alone cannot prove causality across devices.
      const error = new Error('同一IDの記録が競合しています。同期を中止しました。両端末のバックアップを保全してください');
      error.code = 'WORKOUT_CONFLICT';
      throw error;
    }
    map.set(record.id, record);
  }
  return [...map.values()];
}
