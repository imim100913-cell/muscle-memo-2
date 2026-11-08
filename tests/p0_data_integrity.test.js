// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { normalizeSingleSet, migrateToFlatWorkouts, mergeWorkoutSets } from '../src/lib/workoutMigration.js';
import { collectLocalSyncData, applySyncedData, restoreBackup } from '../src/services/mobileSync.js';
import { createUniqueId } from '../src/lib/utils.js';
import { persistEntries, recoverPending, JOURNAL_KEY, ORIGINAL_KEY } from '../src/lib/persistence.js';

const key = 'muscle-memo-workouts';
const record = (extra = {}) => ({ id: 'a', date: '2026-11-08', timestamp: 1794096000000, exercise: 'ベンチプレス', part: '胸', setNum: 1, weight: 80, reps: 10, ...extra });
const payload = data => ({ application: 'Anti-Gravity Workout Tracker', version: '2.0', data });
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('production migration', () => {
  it.each(['', null, undefined])('missing RIR/form %s becomes null', value => {
    const set = normalizeSingleSet(record({ rir: value, formScore: value }));
    expect(set.rir).toBeNull(); expect(set.formScore).toBeNull();
  });
  it('retains measured zero and previously supplied values without guessing provenance', () => {
    expect(normalizeSingleSet(record({ rir: 0 })).rir).toBe(0);
    const set = normalizeSingleSet(record({ rir: 2, formScore: 'perfect' }));
    expect(set.rir).toBe(2); expect(set.formScore).toBe('perfect');
  });
  it.each([{ weight: '80kg' }, { weight: -1 }, { weight: null }, { reps: '10x' }, { reps: 1.5 }, { reps: 0 }, { date: '2026-02-30' }, { date: '' }, { id: '' }, { id: 123 }, { timestamp: null }, { timestamp: Infinity }, { rir: 'x' }, { formScore: 'unknown' }, { memo: () => '' }])('rejects corrupt values %j', extra => {
    expect(() => migrateToFlatWorkouts([record(extra)])).toThrow();
  });
  it('migrates sparse horizontal sets without inventing timestamps/numbers and is idempotent', () => {
    const old = [{ id: 'old', timestamp: 1794096000000, date: '2026-11-08', exercise: 'スクワット', set1_weight: 100, set1_reps: 5, set1_rir: 0, set1_memo: 'first', set3_weight: 90, set3_reps: 8 }];
    const original = JSON.stringify(old);
    const flat = migrateToFlatWorkouts(old);
    expect(flat).toHaveLength(2);
    expect(flat.map(s => [s.id, s.setNum, s.weight, s.reps, s.rir, s.memo, s.formScore])).toEqual([
      ['old-1', 1, 100, 5, 0, 'first', null], ['old-3', 3, 90, 8, null, '', null]
    ]);
    expect(flat[0].timestamp).toBe(old[0].timestamp);
    expect(migrateToFlatWorkouts(flat)).toEqual(flat);
    expect(JSON.stringify(old)).toBe(original);
  });
  it('fails whole migration for partial or corrupt horizontal sets and duplicate IDs', () => {
    expect(() => migrateToFlatWorkouts([record(), { id: 'old', timestamp: 1, exercise: 'x', set1_weight: 80 }])).toThrow();
    expect(() => migrateToFlatWorkouts([record(), record()])).toThrow();
    expect(() => migrateToFlatWorkouts({})).toThrow();
  });
});

describe('production sync and restore', () => {
  it('keeps six independent sets starting from setNum 1 on both devices; repeat sync is stable', () => {
    const a = [1, 2, 3].map(n => record({ id: `a${n}`, sessionId: 'a', setNum: n }));
    const b = [1, 2, 3].map(n => record({ id: `b${n}`, sessionId: 'b', setNum: n, reps: 8 }));
    const merged = mergeWorkoutSets(a, b);
    expect(merged).toHaveLength(6);
    expect(mergeWorkoutSets(merged, b)).toEqual(merged);
    expect(mergeWorkoutSets(merged, a)).toEqual(merged);
  });
  it('rejects competing same-ID values regardless of wall-clock ordering; no writes', () => {
    const local = JSON.stringify([record({ memo: 'local' })]); localStorage.setItem(key, local);
    expect(() => applySyncedData({ [key]: JSON.stringify([record({ memo: 'remote', updatedAt: 1894096000000 })]) })).toThrow(/競合/);
    expect(localStorage.getItem(key)).toBe(local);
  });
  it('validates all entries before writing, never falls back to corrupt data', () => {
    localStorage.setItem(key, JSON.stringify([record()]));
    for (const value of ['broken', '{}', JSON.stringify([record({ weight: 'bad' })])]) {
      expect(() => applySyncedData({ 'muscle-memo-user': '"new"', [key]: value })).toThrow();
      expect(localStorage.getItem('muscle-memo-user')).toBeNull();
      expect(JSON.parse(localStorage.getItem(key))).toEqual([record()]);
    }
  });
  it('refuses deletion sync metadata', () => {
    expect(() => applySyncedData({ 'muscle-memo-tombstones': '[]' })).toThrow();
    expect(() => applySyncedData({ [key]: JSON.stringify([record({ deletedAt: 1 })]) })).toThrow();
  });
  it('prevalidates backup and preserves original before successful restoration', () => {
    const old = JSON.stringify([record()]); localStorage.setItem(key, old);
    expect(() => restoreBackup(payload({ 'muscle-memo-user': '"new"', [key]: 'broken' }))).toThrow();
    expect(localStorage.getItem(key)).toBe(old);
    expect(localStorage.getItem('muscle-memo-user')).toBeNull();
    const data = payload({ [key]: JSON.stringify([record({ id: 'b' })]) });
    restoreBackup(data);
    expect(localStorage.getItem(ORIGINAL_KEY)).toBe(old);
    const restored = localStorage.getItem(key); restoreBackup(data);
    expect(localStorage.getItem(key)).toBe(restored);
  });
  it('rolls back partial restore after quota failure; no success is returned', () => {
    localStorage.setItem(key, JSON.stringify([record()]));
    localStorage.setItem('muscle-memo-user', '"old"');
    const original = localStorage.getItem(key);
    const native = Storage.prototype.setItem;
    let failed = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) {
      if (k === key && !failed) { failed = true; throw new DOMException('full', 'QuotaExceededError'); }
      return native.call(this, k, v);
    });
    expect(() => restoreBackup(payload({ 'muscle-memo-user': '"new"', [key]: JSON.stringify([record({ id: 'b' })]) }))).toThrow();
    expect(localStorage.getItem(key)).toBe(original);
    expect(localStorage.getItem('muscle-memo-user')).toBe('"old"');
    expect(localStorage.getItem(JOURNAL_KEY)).toBeNull();
  });
  it('keeps recovery journal when rollback fails, then recovers on next attempt', () => {
    localStorage.setItem('muscle-memo-user', '"old"');
    const native = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) {
      if (k === 'muscle-memo-user') throw new DOMException('denied', 'SecurityError');
      return native.call(this, k, v);
    });
    expect(() => persistEntries({ 'muscle-memo-user': '"new"' })).toThrow();
    expect(localStorage.getItem(JOURNAL_KEY)).not.toBeNull();
    vi.restoreAllMocks(); recoverPending(localStorage);
    expect(localStorage.getItem('muscle-memo-user')).toBe('"old"');
    expect(localStorage.getItem(JOURNAL_KEY)).toBeNull();
  });
  it('excludes secrets and internal snapshots from default sharing', () => {
    localStorage.setItem('muscle-memo-gemini-key', '"TEST_ONLY"');
    localStorage.setItem(ORIGINAL_KEY, '[]'); localStorage.setItem(JOURNAL_KEY, '{}');
    localStorage.setItem(key, '[]');
    expect(collectLocalSyncData()).toEqual({ [key]: '[]' });
  });
});

it('sync via production storage path remains byte-stable and preserves every measured field', () => {
  const measured = [record({ id: 'a', rir: 0, formScore: 'good', memo: 'a' }), record({ id: 'b', setNum: 1, weight: 75, reps: 12, memo: 'b' })];
  localStorage.setItem(key, JSON.stringify([measured[0]]));
  const incoming = { [key]: JSON.stringify([measured[1]]) };
  applySyncedData(incoming); const first = localStorage.getItem(key);
  applySyncedData(incoming); expect(localStorage.getItem(key)).toBe(first);
  expect(JSON.parse(first).map(s => [s.id, s.weight, s.reps, s.memo, s.rir, s.formScore])).toEqual([
    ['a', 80, 10, 'a', 0, 'good'], ['b', 75, 12, 'b', null, null]
  ]);
});
it('backup restoration adds records and never replaces a competing same-ID record', () => {
  localStorage.setItem(key, JSON.stringify([record()]));
  restoreBackup(payload({ [key]: JSON.stringify([record({ id: 'b' })]) }));
  expect(JSON.parse(localStorage.getItem(key))).toHaveLength(2);
  const original = localStorage.getItem(key);
  expect(() => restoreBackup(payload({ [key]: JSON.stringify([record({ weight: 90 })]) }))).toThrow(/競合/);
  expect(localStorage.getItem(key)).toBe(original);
});
it('local deletion marker stops sync before resurrecting deleted records', () => {
  localStorage.setItem(key, '[]'); localStorage.setItem('muscle-memo-deletion-state', '{}');
  expect(() => applySyncedData({ [key]: JSON.stringify([record()]) })).toThrow(/削除/);
  expect(localStorage.getItem(key)).toBe('[]');
});
it('corrupt migration never changes its stored original or settings', () => {
  const old = [{ id: 'old', timestamp: 1, exercise: 'x', set1_weight: 80, set1_reps: 10, set2_weight: 'broken', set2_reps: 5 }];
  const bytes = JSON.stringify(old); localStorage.setItem(key, bytes);
  expect(() => applySyncedData({ 'muscle-memo-user': '"new"', [key]: '[]' })).toThrow();
  expect(localStorage.getItem(key)).toBe(bytes); expect(localStorage.getItem('muscle-memo-user')).toBeNull();
});
it('malformed recovery journal blocks writes without touching originals', () => {
  localStorage.setItem(key, '[]'); localStorage.setItem(JOURNAL_KEY, JSON.stringify({ unrelated: 'bad' }));
  expect(() => persistEntries({ [key]: '[1]' })).toThrow(/破損/);
  expect(localStorage.getItem(key)).toBe('[]'); expect(localStorage.getItem('unrelated')).toBeNull();
});
it('silent storage write failure is detected by read-back verification', () => {
  const native = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) { if (k !== key) native.call(this, k, v); });
  expect(() => persistEntries({ [key]: '[]' })).toThrow(/照合/);
  expect(localStorage.getItem(key)).toBeNull();
});
it('does not report success when the transaction journal cannot be removed', () => {
  const native = Storage.prototype.removeItem;
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function(k) { if (k !== JOURNAL_KEY) native.call(this, k); });
  expect(() => persistEntries({ [key]: '[]' })).toThrow(/削除照合/);
  expect(localStorage.getItem(JOURNAL_KEY)).not.toBeNull();
  vi.restoreAllMocks(); recoverPending(localStorage);
  expect(localStorage.getItem(key)).toBeNull();
});

it('generates independent secure IDs on LAN HTTP without randomUUID', () => {
  const fill = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal('crypto', { getRandomValues: fill });
  const first = createUniqueId(); const second = createUniqueId();
  expect(first).toMatch(/^[a-f0-9]{32}$/); expect(first).not.toBe(second);
  vi.unstubAllGlobals();
});
