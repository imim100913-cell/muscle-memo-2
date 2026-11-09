// @vitest-environment jsdom
import React from 'react';
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../src/App.jsx';
import Onboarding from '../src/components/Onboarding/Onboarding.jsx';
import SettingsView from '../src/components/Settings/SettingsView.jsx';
import HistoryView from '../src/components/History/HistoryView.jsx';
import MobileSyncModal from '../src/components/Mobile/MobileSyncModal.jsx';
import { GeminiService } from '../src/services/gemini.js';
import { useLocalStorage } from '../src/hooks/useLocalStorage.js';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../src/hooks/useMobileFeatures', () => ({ useMobileFeatures: () => ({}) }));
const key = 'muscle-memo-workouts';
beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('actual Onboarding questionnaire completion creates no measured workouts', () => {
  const onComplete = vi.fn(); render(<Onboarding onComplete={onComplete} />);
  fireEvent.change(screen.getByPlaceholderText('例: たろう、けい'), { target: { value: 'test' } });
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
  const boxes = screen.getAllByRole('checkbox'); fireEvent.click(boxes[0]);
  fireEvent.click(screen.getByRole('button', { name: /設定完了して開始/ }));
  expect(onComplete.mock.calls[0][0].workouts).toEqual([]);
  expect(onComplete.mock.calls[0][0].exercisePreferences).toHaveLength(1);
});

it('actual hook reports failure, retains committed value, and supports retry and consecutive functional writes', () => {
  const { result } = renderHook(() => useLocalStorage(key, []));
  const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
  let saved; act(() => { saved = result.current[1](['new']); });
  expect(saved.success).toBe(false); expect(result.current[0]).toEqual([]); expect(result.current[2]).toContain('QuotaExceededError');
  fail.mockRestore();
  act(() => { result.current[1](prev => [...prev, 'first']); result.current[1](prev => [...prev, 'second']); });
  expect(JSON.parse(localStorage.getItem(key))).toEqual(['first', 'second']);
});

it('actual hook blocks replacement of unreadable original JSON', () => {
  localStorage.setItem(key, 'broken');
  const { result } = renderHook(() => useLocalStorage(key, []));
  act(() => { expect(result.current[1]([]).success).toBe(false); });
  expect(localStorage.getItem(key)).toBe('broken');
});

function startApp() {
  localStorage.setItem('muscle-memo-onboarded', 'true');
  const view = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /トレーニングセッションを開始する/ }));
  const numbers = screen.getAllByRole('spinbutton');
  fireEvent.change(numbers[0], { target: { value: '80' } });
  fireEvent.change(numbers[1], { target: { value: '10' } });
  return view;
}
function recordClick() { fireEvent.click(screen.getByRole('button', { name: '記録する' })); }

it('actual App/Form preserve manual memo, repeated quick tags, clear, and correct set association', () => {
  startApp();
  const memo = screen.getByPlaceholderText(/フォーム意識、トップ/);
  fireEvent.change(memo, { target: { value: 'manual' } });
  fireEvent.click(screen.getByRole('button', { name: '+フォーム重視' }));
  fireEvent.click(screen.getByRole('button', { name: '+限界突破' }));
  expect(memo.value).toBe('manual / フォーム重視 / 限界突破');
  recordClick();
  const first = JSON.parse(localStorage.getItem(key));
  expect(first).toHaveLength(1); expect(first[0].memo).toBe('manual / フォーム重視 / 限界突破');
  expect(first[0].rir).toBeNull(); expect(first[0].formScore).toBeNull();
  expect(memo.value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: '+軽め調整' }));
  fireEvent.click(screen.getByTitle('メモをクリア')); expect(memo.value).toBe('');
  fireEvent.change(memo, { target: { value: 'second' } });
  fireEvent.change(screen.getAllByRole('spinbutton')[2], { target: { value: '0' } });
  recordClick();
  const saved = JSON.parse(localStorage.getItem(key));
  expect(saved.map(s => s.memo)).toEqual(['manual / フォーム重視 / 限界突破', 'second']);
  expect(saved[1].rir).toBe(0); expect(saved[1].sessionId).toBe(saved[0].sessionId);
  expect(saved[1].id).not.toBe(saved[0].id);
  expect(saved[1].createdAt).toBe(saved[1].timestamp); expect(saved[1].updatedAt).toBe(saved[1].timestamp);
});

it('actual record action never reports success after failure, keeps input, and retries once', () => {
  startApp();
  const memo = screen.getByPlaceholderText(/フォーム意識、トップ/); fireEvent.change(memo, { target: { value: 'keep me' } });
  const native = Storage.prototype.setItem;
  const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) {
    if (k === key) throw new DOMException('full', 'QuotaExceededError');
    return native.call(this, k, v);
  });
  recordClick();
  expect(screen.queryByText(/記録完了！|自己ベスト\(PR\)更新！/)).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('保存に失敗'); expect(memo.value).toBe('keep me');
  expect(screen.getByRole('button', { name: '未保存入力と原本を退避' })).toBeTruthy();
  fail.mockRestore(); recordClick();
  expect(JSON.parse(localStorage.getItem(key))).toHaveLength(1); expect(memo.value).toBe('');
});

it('App creates different session IDs after ending and starting on same day', () => {
  startApp(); recordClick();
  fireEvent.click(screen.getByRole('button', { name: /セッション終了/ }));
  fireEvent.click(screen.getByRole('button', { name: /トレーニングセッションを開始する/ }));
  recordClick();
  const saved = JSON.parse(localStorage.getItem(key));
  expect(saved).toHaveLength(2); expect(saved[0].sessionId).not.toBe(saved[1].sessionId);
  expect(saved.map(s => s.setNum)).toEqual([1, 1]);
});

it('actual history renders missing RIR as unknown and zero as measured', () => {
  render(<HistoryView workouts={[{ id: 'a', timestamp: Date.now(), date: '2026-11-08', exercise: 'x', setNum: 1, weight: 80, reps: 10, rir: null }, { id: 'b', timestamp: Date.now(), date: '2026-11-08', exercise: 'x', setNum: 2, weight: 80, reps: 10, rir: 0 }]} />);
  expect(screen.getByText('RIR 未入力')).toBeTruthy(); expect(screen.getByText('RIR 0')).toBeTruthy();
});

it('actual CSV export keeps missing RIR/form empty and zero intact', async () => {
  let blob;
  vi.stubGlobal('URL', { createObjectURL: value => { blob = value; return 'blob:test'; } });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<SettingsView workouts={[{ id: 'a', timestamp: Date.now(), exercise: 'x', weight: 80, reps: 10, rir: null }, { id: 'b', timestamp: Date.now(), exercise: 'x', weight: 80, reps: 10, rir: 0 }]} />);
  fireEvent.click(screen.getByRole('button', { name: /CSVデータ出力/ }));
  const csv = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
  const rows = csv.trim().split('\n');
  expect(rows[1].split(',')[7]).toBe('""'); expect(rows[1].split(',')[9]).toBe('""');
  expect(rows[2].split(',')[7]).toBe('"0"');
});

it('actual hook detects external changes rather than overwriting another tab', () => {
  localStorage.setItem(key, '[]');
  const { result } = renderHook(() => useLocalStorage(key, []));
  localStorage.setItem(key, '["other-tab"]');
  act(() => { expect(result.current[1](['local']).success).toBe(false); });
  expect(localStorage.getItem(key)).toBe('["other-tab"]');
  expect(result.current[2]).toContain('別の画面');
});

it('actual App initial registration leaves existing records intact', () => {
  const original = [{ id: 'existing', timestamp: Date.now(), exercise: 'x', weight: 80, reps: 10 }];
  localStorage.setItem(key, JSON.stringify(original)); render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /スキップしてデフォルトで開始/ }));
  expect(JSON.parse(localStorage.getItem(key))).toEqual(original);
});

it('actual JSON backup export preserves null and zero and excludes API keys/internal originals', async () => {
  const sets = [{ id: 'a', rir: null, formScore: null }, { id: 'b', rir: 0, formScore: 'perfect' }];
  localStorage.setItem(key, JSON.stringify(sets));
  localStorage.setItem('muscle-memo-gemini-key', '"TEST_ONLY"');
  localStorage.setItem('muscle-memo-internal-original-workouts', '[]');
  let blob;
  vi.stubGlobal('URL', { createObjectURL: value => { blob = value; return 'blob:test'; } });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<SettingsView workouts={[]} />);
  fireEvent.click(screen.getByRole('button', { name: '設定をエクスポート' }));
  const json = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
  const data = JSON.parse(json).data;
  expect(JSON.parse(data[key])).toEqual(sets);
  expect(data['muscle-memo-gemini-key']).toBeUndefined();
  expect(data['muscle-memo-internal-original-workouts']).toBeUndefined();
});


it('actual App sends null RIR/form and explicit session identities to AI', async () => {
  localStorage.setItem('muscle-memo-gemini-key', '"TEST_ONLY"');
  const generate = vi.spyOn(GeminiService, 'generateResponse').mockResolvedValue('test response');
  startApp();
  await act(async () => {});
  await act(async () => { recordClick(); });
  const call = generate.mock.calls.find(args => args[1].includes('達成しました'));
  expect(call).toBeTruthy(); expect(call[1]).toContain('RIR: 未入力');
  const context = JSON.parse(call[2]);
  expect(context.todaySession.sets).toHaveLength(1);
  expect(context.todaySession.sets[0].rir).toBeNull();
  expect(context.todaySession.sets[0].formScore).toBeNull();
  expect(context.todaySession.sets[0].sessionId).toBe(context.todaySession.sessionId);
});

it.each([['sound', 'off'], ['silent', 'on']])('actual Settings JSON export restores raw preferences (%s/%s) and ledger together', async (sound, wake) => {
  const original = [{ id: 'fixture', timestamp: Date.now(), exercise: 'x', weight: 80, reps: 10, rir: 0, formScore: null }];
  const values = {
    'muscle-memo-sound-mode': sound, 'muscle-memo-category-priority': 'free_weight', 'muscle-memo-wakelock': wake,
    [key]: JSON.stringify(original)
  };
  for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
  let blob;
  vi.stubGlobal('URL', { createObjectURL: value => { blob = value; return 'blob:test'; } });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<SettingsView workouts={original} />);
  fireEvent.click(screen.getByRole('button', { name: '設定をエクスポート' }));
  const json = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
  const { restoreBackup } = await import('../src/services/mobileSync.js');
  restoreBackup(JSON.parse(json));
  expect(localStorage.getItem('muscle-memo-internal-original-workouts')).toBe(values[key]);
  for (const k of Object.keys(values)) if (k !== key) expect(localStorage.getItem(k)).toBe(values[k]);
  expect(JSON.parse(localStorage.getItem(key))[0]).toMatchObject(original[0]);
});

it('actual clear action rolls back deletion state, ledger and settings when ledger write fails', () => {
  localStorage.setItem(key, JSON.stringify([{ id: 'fixture', timestamp: Date.now(), exercise: 'x', weight: 80, reps: 10 }]));
  localStorage.setItem('muscle-memo-user', '"original name"');
  localStorage.setItem('muscle-memo-onboarded', 'true');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '設定' }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  const before = localStorage.getItem(key);
  const native = Storage.prototype.setItem;
  let markerWritten = false;
  let failed = false;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) {
    if (k === 'muscle-memo-deletion-state') markerWritten = true;
    if (k === key && !failed) { failed = true; throw new DOMException('full', 'QuotaExceededError'); }
    return native.call(this, k, v);
  });
  fireEvent.click(screen.getByRole('button', { name: /リセット|初期化|データを削除/ }));
  expect(markerWritten).toBe(true); expect(failed).toBe(true);
  expect(localStorage.getItem(key)).toBe(before);
  expect(localStorage.getItem('muscle-memo-deletion-state')).toBeNull();
  expect(localStorage.getItem('muscle-memo-user')).toBe('"original name"');
  expect(localStorage.getItem('muscle-memo-onboarded')).toBe('true');
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('保存に失敗'));
  expect(screen.queryByText('記録と設定を初期化しました。')).toBeNull();
});

it('actual mobile UI disables LAN without contacting a bridge and always explains transfer privacy', () => {
  render(<MobileSyncModal isOpen />);
  expect(screen.getByRole('status').textContent).toContain('HTTPSとWeb Locks');
  expect(screen.getByRole('status').textContent).toContain('動作保証しません');
  expect(screen.getByRole('button', { name: 'この端末から送信' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: '他端末から受信・統合' }).disabled).toBe(true);
  expect(screen.queryByRole('img')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'URL・コードで手動移行する' }));
  expect(screen.getByRole('note').textContent).toContain('暗号化されていません');
  expect(screen.getByRole('note').textContent).toContain('APIキーを含めなくても');
  expect(screen.getByRole('checkbox').checked).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'アプリ化 (PWA)' }));
  expect(screen.getByText(/HTTPのLANアドレスは開いたままでも利用できません/)).toBeTruthy();
});

it.each([
  'muscle-memo-internal-before-reset-workouts', 'muscle-memo-deletion-state',
  'muscle-memo-user', 'muscle-memo-coach', 'muscle-memo-gemini-key',
  'muscle-memo-gemini-model', 'muscle-memo-custom-exercises', 'muscle-memo-onboarded', key
])('actual clear action restores all preimages after a one-shot failure at %s', failedKey => {
  const before = {
    [key]: JSON.stringify([{ id: 'synthetic', timestamp: 1794096000000, exercise: 'x', weight: 80, reps: 10 }]),
    'muscle-memo-internal-before-reset-workouts': '["older synthetic copy"]',
    'muscle-memo-deletion-state': JSON.stringify({ deletedIds: ['older-id'], deletedAt: 1 }),
    'muscle-memo-user': '"original name"', 'muscle-memo-coach': '"gentle"',
    'muscle-memo-gemini-key': '""', 'muscle-memo-gemini-model': '"synthetic-model"',
    'muscle-memo-custom-exercises': '{"胸":["synthetic exercise"]}', 'muscle-memo-onboarded': 'true'
  };
  for (const [k, v] of Object.entries(before)) localStorage.setItem(k, v);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '設定' }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  const native = Storage.prototype.setItem;
  let failed = false;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(k, v) {
    if (k === failedKey && !failed) { failed = true; throw new DOMException('synthetic quota', 'QuotaExceededError'); }
    return native.call(this, k, v);
  });
  fireEvent.click(screen.getByRole('button', { name: '記録と設定を初期化' }));
  expect(failed).toBe(true);
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('保存に失敗'));
  for (const [k, v] of Object.entries(before)) expect(localStorage.getItem(k)).toBe(v);
  expect(localStorage.getItem('muscle-memo-internal-pending')).toBeNull();
  expect(localStorage.getItem('muscle-memo-internal-original-workouts')).toBe(before[key]);
});

it('actual clear action rejects an externally changed ledger before creating deletion metadata', () => {
  localStorage.setItem('muscle-memo-onboarded', 'true');
  localStorage.setItem(key, '[]');
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '設定' }));
  const external = JSON.stringify([{ id: 'external-synthetic', timestamp: 1794096000000, exercise: 'x', weight: 80, reps: 10 }]);
  localStorage.setItem(key, external);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  fireEvent.click(screen.getByRole('button', { name: '記録と設定を初期化' }));
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('別の画面'));
  expect(localStorage.getItem(key)).toBe(external);
  expect(localStorage.getItem('muscle-memo-deletion-state')).toBeNull();
  expect(localStorage.getItem('muscle-memo-internal-before-reset-workouts')).toBeNull();
  expect(localStorage.getItem('muscle-memo-internal-pending')).toBeNull();
});
