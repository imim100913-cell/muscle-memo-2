import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

test('mobile recording stays reachable in a reduced viewport and retains the draft across tabs', async ({ page, context }) => {
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(() => localStorage.setItem('muscle-memo-onboarded', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: /トレーニングセッションを開始する/ }).click();
  const weight = page.getByRole('spinbutton', { name: '重量 (kg)', exact: true });
  const reps = page.getByRole('spinbutton', { name: '回数 (Reps)', exact: true });
  const rir = page.getByRole('spinbutton', { name: '余力 (RIR)', exact: true });
  await weight.fill('0');
  await page.getByRole('button', { name: '重量を増やす 2.5kg', exact: true }).click();
  await expect(weight).toHaveValue('2.5');
  await reps.fill('0');
  await page.getByRole('button', { name: '回数を増やす', exact: true }).click();
  await expect(reps).toHaveValue('1');
  await weight.fill('42.5');
  await reps.fill('8');
  await rir.fill('0');
  const memo = page.getByPlaceholder(/フォーム意識、トップ/);
  await memo.fill('mobile synthetic draft');
  await expect(weight).toHaveAttribute('inputmode', 'decimal');
  await expect(reps).toHaveAttribute('inputmode', 'numeric');
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 915 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  for (const control of [weight, reps, rir, page.getByRole('button', { name: 'RIRを増やす', exact: true })]) {
    const rect = await control.boundingBox();
    expect(rect.height).toBeGreaterThanOrEqual(48);
    expect(rect.width).toBeGreaterThanOrEqual(48);
  }
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('button', { name: 'ホーム', exact: true }).click();
  await expect(weight).toHaveValue('42.5');
  await expect(reps).toHaveValue('8');
  await expect(rir).toHaveValue('0');
  await expect(memo).toHaveValue('mobile synthetic draft');

  // Simulate Android's resized content area while the software keyboard is up.
  // Real Gboard, system bars and installation prompts still require device QA.
  await page.setViewportSize({ width: 412, height: 480 });
  await rir.focus();
  await rir.evaluate(input => input.scrollIntoView({ block: 'center' }));
  const field = await rir.boundingBox();
  const footer = await page.locator('.app-footer').boundingBox();
  const record = page.getByRole('button', { name: '記録する', exact: true });
  const action = await record.boundingBox();
  expect(field.y).toBeGreaterThanOrEqual(0);
  expect(field.y + field.height).toBeLessThanOrEqual(footer.y);
  expect(action.y).toBeGreaterThanOrEqual(0);
  expect(action.y + action.height).toBeLessThanOrEqual(480);
  await record.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('muscle-memo-workouts') || '[]').length)).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('muscle-memo-workouts'))[0])).toMatchObject({ weight: 42.5, reps: 8, rir: 0, memo: 'mobile synthetic draft' });

  const manifest = await page.evaluate(async () => (await fetch('./manifest.json')).json());
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('./');
  for (const icon of manifest.icons) {
    const size = await page.evaluate(async src => {
      const image = new Image(); image.src = src; await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, icon.src);
    expect(icon.type).toBe('image/png');
    expect(size).toBe(icon.sizes);
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
});
