import { test, expect } from '@playwright/test';
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const ledgerKey = 'muscle-memo-workouts';
const original = JSON.stringify([{ id: 'sw-audit-only', timestamp: 1794096000000, exercise: 'ベンチプレス', part: '胸', weight: 80, reps: 10, rir: null, memo: 'synthetic persisted set' }]);

// Real build files and a real SW, with two synthetic release identities served
// on a subpath. Only delivery version/availability changes; app behavior is real.
async function releaseServer({ legacyWorker = false } = {}) {
  const docs = new URL('../../docs/', import.meta.url);
  const index = await readFile(new URL('index.html', docs), 'utf8');
  const worker = await readFile(new URL('sw.js', docs), 'utf8');
  // Frozen actual production source from a94fa2b, not a simulated SW algorithm.
  const previousWorker = legacyWorker ? await readFile(new URL('../fixtures/sw-a94fa2b.js', import.meta.url), 'utf8') : worker;
  const bundle = index.match(/src="\.\/(assets\/[^"]+\.js)"/)[1];
  const state = { version: 1, failNewAsset: false };
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/qa/')) { res.writeHead(404); res.end(); return; }
    const file = pathname.slice('/qa/'.length) || 'index.html';
    try {
      let body;
      if (file === 'index.html') {
        body = index.replace('<html lang="ja">', `<html lang="ja" data-qa-version="${state.version}">`);
        if (state.version === 2) body = body.replace(bundle, 'assets/qa-release-v2.js');
      } else if (file === 'sw.js') {
        body = (state.version === 1 ? previousWorker : worker).replace(/muscle-memo-p0-02-[\w-]+/, `muscle-memo-p0-02-qa-v${state.version}`);
      } else if (file === 'assets/qa-release-v2.js') {
        await state.holdNewAsset;
        if (state.failNewAsset) { res.writeHead(503); res.end('synthetic incomplete release'); return; }
        body = await readFile(new URL(bundle, docs));
      } else body = await readFile(new URL(file, docs));
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : file.endsWith('.json') ? 'application/json' : file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body);
    } catch { res.writeHead(404); res.end('missing'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, url: `http://127.0.0.1:${server.address().port}/qa/`, close: () => new Promise(resolve => server.close(resolve)) };
}

async function boot(page, url) {
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem('__swAuditSeed')) {
      localStorage.setItem(key, value); localStorage.setItem('muscle-memo-onboarded', 'true'); localStorage.setItem('__swAuditSeed', 'yes');
    }
  }, { key: ledgerKey, value: original });
  await page.goto(url); await page.getByRole('button', { name: '設定', exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.getByRole('button', { name: '設定', exact: true }).waitFor();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});

test('incomplete new release cannot poison the active shell or prevent offline restart', async ({ page, context }) => {
  const server = await releaseServer();
  try {
    await boot(page, server.url);
    server.state.version = 2; server.state.failNewAsset = true;
    const updateState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const finished = new Promise(resolve => reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        installing.addEventListener('statechange', () => {
          if (['installed', 'redundant'].includes(installing.state)) resolve(installing.state);
        });
      }, { once: true }));
      await reg.update(); return finished;
    });
    expect(updateState).toBe('redundant');
    // A normal online navigation must not replace v1 with an incomplete v2 shell.
    await page.reload();
    await context.setOffline(true); await page.reload();
    await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-qa-version', '1');
    expect(await page.evaluate(key => localStorage.getItem(key), ledgerKey)).toBe(original);
    const cached = await page.evaluate(async () => {
      const cache = await caches.open('muscle-memo-p0-02-qa-v1');
      return (await cache.match(new URL('./index.html', location.href))).text();
    });
    expect(cached).not.toContain('qa-release-v2.js');
  } finally { await context.close(); await server.close(); }
});

test('real two-release update preserves the waiting draft and activates a complete offline shell explicitly', async ({ page, context }) => {
  const server = await releaseServer();
  let releaseNewAsset;
  try {
    await boot(page, server.url);
    await page.evaluate(() => caches.open('unrelated-qa-app-cache'));
    await page.getByRole('button', { name: /トレーニングセッションを開始する/ }).click();
    await page.getByRole('spinbutton').nth(0).fill('80'); await page.getByRole('spinbutton').nth(1).fill('10');
    const memo = page.getByPlaceholder(/フォーム意識、トップ/); await memo.fill('draft during real v2 install');
    server.state.version = 2;
    server.state.holdNewAsset = new Promise(resolve => { releaseNewAsset = resolve; });
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '最新バージョンを確認', exact: true }).click();
    await expect(page.getByText('新しいバージョンを確認中です。準備ができると更新ボタンを表示します。', { exact: true })).toBeVisible();
    releaseNewAsset();
    await page.getByRole('button', { name: 'ホーム', exact: true }).click();
    await expect(page.getByRole('button', { name: '今すぐ更新', exact: true })).toBeVisible();
    await expect(memo).toHaveValue('draft during real v2 install');
    await expect(page.locator('html')).toHaveAttribute('data-qa-version', '1');
    // A second page still uses the active v1 shell and waits for the real lock.
    const waiting = await context.newPage(); await waiting.goto(server.url);
    await expect(waiting.getByRole('status')).toContainText('別のタブ');
    await expect(waiting.locator('html')).toHaveAttribute('data-qa-version', '1'); await waiting.close();
    await page.getByRole('button', { name: '記録する', exact: true }).click();
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, ledgerKey)).toBe(2);
    const beforeUpdate = await page.evaluate(key => localStorage.getItem(key), ledgerKey);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '今すぐ更新', exact: true }).click()]);
    await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-qa-version', '2');
    await context.setOffline(true); await page.reload();
    await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-qa-version', '2');
    expect(await page.evaluate(key => localStorage.getItem(key), ledgerKey)).toBe(beforeUpdate);
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).toContain('unrelated-qa-app-cache'); expect(keys).toContain('muscle-memo-p0-02-qa-v2'); expect(keys).not.toContain('muscle-memo-p0-02-qa-v1');
  } finally { releaseNewAsset?.(); await context.close(); await server.close(); }
});

test('offline version check reports that freshness is unknown', async ({ page, context }) => {
  const server = await releaseServer();
  try {
    await boot(page, server.url);
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await context.setOffline(true);
    await page.getByRole('button', { name: '最新バージョンを確認', exact: true }).click();
    await expect(page.getByText('更新状況を確認できません。接続を確認して再試行してください。', { exact: true })).toBeVisible();
    await expect(page.getByText('すでに最新バージョンを使用中です✨', { exact: true })).toHaveCount(0);
  } finally { await context.close(); await server.close(); }
});

test('failed service worker registration never reports a successful version check', async ({ page, context }) => {
  const server = await releaseServer();
  try {
    await context.route('**/qa/sw.js', route => route.abort());
    await page.addInitScript(() => localStorage.setItem('muscle-memo-onboarded', 'true'));
    await page.goto(server.url);
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '最新バージョンを確認', exact: true }).click();
    await expect(page.getByText('この環境では更新状況を確認できません。', { exact: true })).toBeVisible();
    await expect(page.getByText('すでに最新バージョンを使用中です✨', { exact: true })).toHaveCount(0);
  } finally { await context.close(); await server.close(); }
});

test('the actual a94fa2b service worker upgrades to the repaired worker without changing persisted sets', async ({ page, context }) => {
  const server = await releaseServer({ legacyWorker: true });
  try {
    await boot(page, server.url);
    await page.getByRole('button', { name: /トレーニングセッションを開始する/ }).click();
    await page.getByRole('spinbutton').nth(0).fill('82.5'); await page.getByRole('spinbutton').nth(1).fill('7');
    await page.getByPlaceholder(/フォーム意識、トップ/).fill('synthetic legacy SW upgrade');
    server.state.version = 2;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect(page.getByRole('button', { name: '今すぐ更新', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder(/フォーム意識、トップ/)).toHaveValue('synthetic legacy SW upgrade');
    await page.getByRole('button', { name: '記録する', exact: true }).click();
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, ledgerKey)).toBe(2);
    const beforeUpdate = await page.evaluate(key => localStorage.getItem(key), ledgerKey);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: '今すぐ更新', exact: true }).click()]);
    await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-qa-version', '2');
    await context.setOffline(true); await page.reload();
    await expect(page.getByRole('button', { name: '設定', exact: true })).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), ledgerKey)).toBe(beforeUpdate);
    const cacheKeys = await page.evaluate(() => caches.keys());
    expect(cacheKeys).toContain('muscle-memo-p0-02-qa-v2'); expect(cacheKeys).not.toContain('muscle-memo-p0-02-qa-v1');
  } finally { await context.close(); await server.close(); }
});
