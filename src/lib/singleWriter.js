// All storage recovery and application writes run only while this page owns the
// origin-wide lock. A waiting page must not mount hooks against a partial journal.
export function startSingleWriter({ mount, showStatus, locks = navigator.locks }) {
  let release;
  const controller = new AbortController();
  let active = true;
  let unmount;
  const stop = () => {
    active = false;
    controller.abort();
    unmount?.();
    release?.();
  };
  if (!locks?.request) {
    showStatus('このブラウザでは安全な保存に対応していません。最新版のブラウザでHTTPSのURLを開いてください。記録データは変更していません。');
    return stop;
  }
  showStatus('別のタブで使用中の場合は、そのタブを閉じてください。保存の安全を確認しています。');
  locks.request('muscle-memo-storage-writer', { signal: controller.signal }, async () => {
    if (!active) return;
    unmount = mount();
    await new Promise(resolve => { release = resolve; });
  }).catch(() => {
    if (active) showStatus('安全な保存を開始できませんでした。入力せずに再読み込みしてください。記録データは変更していません。');
  });
  return stop;
}
