import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

const WORKOUTS = 'muscle-memo-workouts';
const DELETION = 'muscle-memo-deletion-state';
const makeSet = (id, setNum = 1) => ({ id, sessionId: id.split('-')[0], timestamp: 1794096000000, date: '2026-11-08', part: '胸', exercise: 'ベンチプレス', setNum, weight: 80, reps: 10, rir: null, formScore: null, memo: `synthetic ${id}` });
async function seed(page, data = {}) {
  await page.addInitScript(values => {
    if (!localStorage.getItem('__synthetic_initialized')) {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      localStorage.setItem('__synthetic_initialized', 'true');
    }
  }, data);
}
async function goActive(page) {
  await page.getByRole('button', { name: /トレーニングセッションを開始する/ }).click();
  await page.getByRole('spinbutton').nth(0).fill('80');
  await page.getByRole('spinbutton').nth(1).fill('10');
}
async function ledger(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), WORKOUTS); }
const memoInput = page => page.getByPlaceholder(/フォーム意識、トップ/);

test.beforeEach(async ({ context }) => {
  // This suite never talks to real AI services or the production site.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
});

test('new onboarding, memo tags, missing values and RIR zero persist through reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /スキップしてデフォルトで開始/ }).click();
  expect(await ledger(page)).toEqual([]);
  await goActive(page);
  await memoInput(page).fill('manual');
  await page.getByRole('button', { name: '+フォーム重視', exact: true }).click();
  await page.getByRole('button', { name: '+限界突破', exact: true }).click();
  await page.getByRole('button', { name: '記録する', exact: true }).click();
  await expect(memoInput(page)).toHaveValue('');
  await page.getByRole('spinbutton').nth(2).fill('0');
  await memoInput(page).fill('second');
  await page.getByRole('button', { name: '記録する', exact: true }).click();
  await expect.poll(async () => (await ledger(page)).length).toBe(2);
  const stored = await ledger(page);
  expect(stored.map(set => [set.rir, set.formScore, set.memo])).toEqual([[null, null, 'manual / フォーム重視 / 限界突破'], [0, null, 'second']]);
  await page.reload();
  await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
  expect(await ledger(page)).toEqual(stored);
  expect(errors).toEqual([]);
});

test('real JSON export/import round trip includes raw preferences and retains the original', async ({ page, browser, baseURL }) => {
  const original = [makeSet('a-1')];
  await seed(page, { [WORKOUTS]: JSON.stringify(original), 'muscle-memo-onboarded': 'true', 'muscle-memo-sound-mode': 'silent', 'muscle-memo-category-priority': 'free_weight', 'muscle-memo-wakelock': 'on' });
  await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '設定をエクスポート' }).click();
  const download = await downloadEvent;
  const bytes = await readFile(await download.path());
  const backup = JSON.parse(bytes.toString());
  expect(backup.data['muscle-memo-sound-mode']).toBe('silent');
  expect(backup.data['muscle-memo-gemini-key']).toBeUndefined();
  const context = await browser.newContext({ baseURL });
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const receiver = await context.newPage();
  try {
    const local = [makeSet('b-1')];
    await seed(receiver, { [WORKOUTS]: JSON.stringify(local), 'muscle-memo-onboarded': 'true' });
    await receiver.goto('/');
    await receiver.getByRole('button', { name: '設定', exact: true }).click();
    receiver.on('dialog', dialog => dialog.accept());
    await Promise.all([receiver.waitForEvent('load'), receiver.locator('input[type=file]').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: bytes })]);
    await expect.poll(async () => (await ledger(receiver)).length).toBe(2);
    await expect(receiver.getByRole('button', { name: '設定', exact: true })).toBeVisible();
    const snapshot = await receiver.evaluate(() => ({ sound: localStorage.getItem('muscle-memo-sound-mode'), category: localStorage.getItem('muscle-memo-category-priority'), wake: localStorage.getItem('muscle-memo-wakelock'), original: localStorage.getItem('muscle-memo-internal-original-workouts') }));
    expect(snapshot).toEqual({ sound: 'silent', category: 'free_weight', wake: 'on', original: JSON.stringify(local) });
  } finally { await receiver.close(); await context.close(); }
});

test('same-day independent device sessions survive sync and repeated sync is stable', async ({ page }) => {
  await seed(page, { [WORKOUTS]: JSON.stringify([1, 2, 3].map(n => makeSet(`a-${n}`, n))), 'muscle-memo-onboarded': 'true' });
  const remote = [1, 2, 3].map(n => makeSet(`b-${n}`, n));
  const token = Buffer.from(JSON.stringify({ v: 2, d: { [WORKOUTS]: JSON.stringify(remote) } })).toString('base64url');
  for (let iteration = 0; iteration < 2; iteration++) {
    await page.goto(`/#sync=u.${token}`);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'データをスマート統合して反映' }).click()]);
    await expect.poll(async () => (await ledger(page)).length).toBe(6);
    await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
  }
  expect((await ledger(page)).map(set => set.id).sort()).toEqual(['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3']);
});

test('same-ID sync conflict preserves exact local bytes and reports the conflict', async ({ page }) => {
  const original = JSON.stringify([makeSet('a-1')]);
  await seed(page, { [WORKOUTS]: original, 'muscle-memo-onboarded': 'true' });
  const changed = { ...makeSet('a-1'), weight: 90 };
  const token = Buffer.from(JSON.stringify({ d: { [WORKOUTS]: JSON.stringify([changed]) } })).toString('base64url');
  let message; page.on('dialog', async dialog => { message = dialog.message(); await dialog.accept(); });
  await page.goto(`/#sync=u.${token}`);
  await page.getByRole('button', { name: 'データをスマート統合して反映' }).click();
  await expect.poll(() => message).toContain('競合');
  expect(await page.evaluate(key => localStorage.getItem(key), WORKOUTS)).toBe(original);
});

test('quota failure retains draft, allows download, and retry saves exactly once', async ({ page }) => {
  await seed(page, { 'muscle-memo-onboarded': 'true' }); await page.goto('/'); await goActive(page);
  await memoInput(page).fill('keep this draft');
  await page.evaluate(key => {
    const native = Storage.prototype.setItem;
    window.__restoreStorage = () => { Storage.prototype.setItem = native; };
    Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('synthetic quota', 'QuotaExceededError'); return native.call(this, k, v); };
  }, WORKOUTS);
  await page.getByRole('button', { name: '記録する', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('保存に失敗');
  await expect(memoInput(page)).toHaveValue('keep this draft');
  expect(await ledger(page)).toEqual([]);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '未保存入力と原本を退避' }).click();
  const download = await downloadEvent;
  const draft = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(draft.entry.memo).toBe('keep this draft');
  await page.evaluate(() => window.__restoreStorage());
  await page.getByRole('button', { name: '記録する', exact: true }).click();
  await expect.poll(async () => (await ledger(page)).length).toBe(1);
});

test('failed reset rolls back both deletion marker and measured ledger', async ({ page }) => {
  const original = JSON.stringify([makeSet('a-1')]);
  await seed(page, { [WORKOUTS]: original, 'muscle-memo-onboarded': 'true' }); await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const dialogs = []; page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await page.evaluate(key => {
    const native = Storage.prototype.setItem; let failed = false;
    Storage.prototype.setItem = function(k, v) { if (k === key && !failed) { failed = true; throw new DOMException('synthetic quota', 'QuotaExceededError'); } return native.call(this, k, v); };
  }, WORKOUTS);
  await page.getByRole('button', { name: /リセット|初期化|データを削除/ }).click();
  await expect.poll(() => dialogs.some(text => text.includes('保存に失敗'))).toBe(true);
  expect(await page.evaluate(key => localStorage.getItem(key), WORKOUTS)).toBe(original);
  expect(await page.evaluate(key => localStorage.getItem(key), DELETION)).toBeNull();
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '記録と設定を初期化', exact: true }).click()]);
  await expect(page.getByRole('button', { name: /スキップしてデフォルトで開始/ })).toBeVisible();
  expect(await ledger(page)).toEqual([]);
});

test('another tab waits for exclusive ownership and reads latest committed ledger', async ({ page, context }) => {
  await seed(page, { 'muscle-memo-onboarded': 'true' }); await page.goto('/'); await goActive(page);
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('status')).toContainText('別のタブ');
  await expect(other.getByRole('button', { name: '記録する', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '記録する', exact: true }).click();
  await expect.poll(async () => (await ledger(page)).length).toBe(1);
  await page.close();
  await expect(other.getByRole('button', { name: '設定', exact: true })).toBeVisible();
  await goActive(other);
  await other.getByRole('button', { name: '記録する', exact: true }).click();
  await expect.poll(async () => (await ledger(other)).length).toBe(2);
});

test('without Web Locks the app fails closed rather than using an unsafe writer', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('HTTPS');
  await expect(page.getByRole('button')).toHaveCount(0);
  expect(await ledger(page)).toEqual([]);
});

test('PWA offline reload keeps measured records', async ({ page, context }) => {
  await seed(page, { 'muscle-memo-onboarded': 'true' }); await page.goto('/'); await goActive(page);
  await page.getByRole('button', { name: '記録する', exact: true }).click();
  await expect.poll(async () => (await ledger(page)).length).toBe(1);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
  expect(await ledger(page)).toHaveLength(1);
});

test('first service worker activation never reloads or discards an unsaved memo', async ({ page, context }) => {
  let allowWorker;
  const gate = new Promise(resolve => { allowWorker = resolve; });
  await context.route('**/sw.js', async route => { await gate; await route.continue(); });
  await seed(page, { 'muscle-memo-onboarded': 'true' }); await page.goto('/'); await goActive(page);
  await memoInput(page).fill('unsaved during activation');
  await page.evaluate(() => caches.open('unrelated-app-cache'));
  allowWorker();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(memoInput(page)).toHaveValue('unsaved during activation');
  expect(await page.evaluate(() => caches.has('unrelated-app-cache'))).toBe(true);
  expect(await ledger(page)).toEqual([]);
});

test('successful reset commits deletion IDs and empty ledger together and preserves the original', async ({ page }) => {
  const original = JSON.stringify([makeSet('a-1'), makeSet('a-2', 2)]);
  await seed(page, { [WORKOUTS]: original, 'muscle-memo-internal-original-workouts': JSON.stringify([makeSet('a-1')]), 'muscle-memo-onboarded': 'true' }); await page.goto('/');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  page.on('dialog', dialog => dialog.accept());
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '記録と設定を初期化', exact: true }).click()]);
  await expect(page.getByRole('button', { name: /スキップしてデフォルトで開始/ })).toBeVisible();
  expect(await ledger(page)).toEqual([]);
  const stored = await page.evaluate(() => ({ marker: JSON.parse(localStorage.getItem('muscle-memo-deletion-state')), original: localStorage.getItem('muscle-memo-internal-original-workouts'), beforeReset: localStorage.getItem('muscle-memo-internal-before-reset-workouts'), pending: localStorage.getItem('muscle-memo-internal-pending') }));
  expect(stored.marker.deletedIds).toEqual(['a-1', 'a-2']); expect(stored.original).toBe(JSON.stringify([makeSet('a-1')])); expect(stored.beforeReset).toBe(original); expect(stored.pending).toBeNull();
});

test.describe('local calendar date', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });
  test('records the JST day across the UTC date boundary', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-08T15:30:00Z'));
    await seed(page, { 'muscle-memo-onboarded': 'true' }); await page.goto('/'); await goActive(page);
    await page.getByRole('button', { name: '記録する', exact: true }).click();
    await expect.poll(async () => (await ledger(page)).length).toBe(1);
    expect((await ledger(page))[0].date).toBe('2026-11-09');
  });
});

test('startup recovers an interrupted reset snapshot before mounting the app', async ({ page }) => {
  const original = JSON.stringify([makeSet('a-1')]);
  const before = { [WORKOUTS]: original, 'muscle-memo-deletion-state': null, 'muscle-memo-user': '"original"', 'muscle-memo-onboarded': 'true' };
  await seed(page, { [WORKOUTS]: '[]', 'muscle-memo-deletion-state': JSON.stringify({ deletedIds: ['a-1'], deletedAt: 1794096000000 }), 'muscle-memo-user': '"partial"', 'muscle-memo-onboarded': 'true', 'muscle-memo-internal-pending': JSON.stringify(before) });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), WORKOUTS)).toBe(original);
  expect(await page.evaluate(key => localStorage.getItem(key), DELETION)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('muscle-memo-internal-pending'))).toBeNull();
});


test('blocked localStorage is reported without mounting a fake empty ledger', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('synthetic storage blocked', 'SecurityError'); } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('読み出せません');
  await expect(page.getByRole('button', { name: /スキップしてデフォルトで開始/ })).toHaveCount(0);
});
