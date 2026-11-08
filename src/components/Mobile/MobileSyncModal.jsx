import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  QrCode,
  Wifi,
  RefreshCw,
  Share2,
  Copy,
  Check,
  Download,
  Upload,
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  fetchNetworkInfo,
  pushSyncSnapshotToServer,
  pullSyncSnapshotFromServer,
  encodeSyncToken,
  decodeSyncToken,
  applySyncedData
} from '../../services/mobileSync';

export default function MobileSyncModal({
  isOpen,
  onClose,
  onShowFeedback,
  canInstallPwa,
  isStandalone,
  isIos,
  onInstallPwa
}) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [selectedIp, setSelectedIp] = useState('');
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [qrLoadError, setQrLoadError] = useState(false);
  const [activeMode, setActiveMode] = useState('qr'); // 'qr' | 'code' | 'pwa'

  const deviceLabel = /iphone|ipad|ipod|android/i.test(navigator.userAgent)
    ? 'スマートフォン'
    : 'PC';

  const refreshBridgeStatus = useCallback(async () => {
    await Promise.resolve();
    setQrLoadError(false);
    setIsSyncing(true);
    try {
      const info = await fetchNetworkInfo();
      if (info) {
        setNetworkInfo(info);
        if (info.lanIp && !selectedIp) {
          setSelectedIp(info.lanIp);
        }
        // Automatically push current state so scanning QR immediately has latest data
        await pushSyncSnapshotToServer(deviceLabel, includeApiKey);
        const updatedInfo = await fetchNetworkInfo();
        if (updatedInfo) setNetworkInfo(updatedInfo);
      }
    } catch {
      // Offline or serverless environment
    } finally {
      setIsSyncing(false);
    }
  }, [deviceLabel, includeApiKey, selectedIp]);

  useEffect(() => {
    if (isOpen) {
      refreshBridgeStatus();
    }
  }, [isOpen, refreshBridgeStatus]);

  if (!isOpen) return null;

  // Compute target URL for QR Code
  const getTargetUrl = () => {
    const loc = window.location;
    const isLocalhost = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
    if (isLocalhost && selectedIp) {
      const portPart = networkInfo?.port || loc.port || '5173';
      return `${loc.protocol}//${selectedIp}:${portPart}/?sync=lan`;
    }
    return `${loc.origin}${loc.pathname}?sync=lan`;
  };

  const targetUrl = getTargetUrl();
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&color=0F172A&bgcolor=FFFFFF&data=${encodeURIComponent(
    targetUrl
  )}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      if (onShowFeedback) onShowFeedback('接続URLをコピーしました！');
    } catch {
      // Fallback
    }
  };

  const handleSharePortableLink = async () => {
    try {
      const token = await encodeSyncToken(includeApiKey);
      const loc = window.location;
      const isLocalhost = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
      const baseOrigin =
        isLocalhost && selectedIp
          ? `${loc.protocol}//${selectedIp}:${networkInfo?.port || loc.port || '5173'}`
          : loc.origin;
      const shareUrl = `${baseOrigin}${loc.pathname}#sync=${token}`;

      if (navigator.share) {
        await navigator.share({
          title: 'マッスルメモ 2.0 - データ同期リンク',
          text: 'マッスルメモ 2.0 の最新設定・トレーニング履歴を引き継ぎます',
          url: shareUrl
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
      if (onShowFeedback) onShowFeedback('データ付き共有URLをコピーしました！');
    } catch (e) {
      if (e.name !== 'AbortError') {
        alert('共有リンクの作成に失敗しました: ' + e.message);
      }
    }
  };

  const handlePushToLan = async () => {
    setIsSyncing(true);
    try {
      await pushSyncSnapshotToServer(deviceLabel, includeApiKey);
      const updated = await fetchNetworkInfo();
      if (updated) setNetworkInfo(updated);
      if (onShowFeedback) onShowFeedback('最新データを同期ブリッジに送信しました！');
    } catch (e) {
      alert('送信エラー: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromLan = async () => {
    setIsSyncing(true);
    try {
      const res = await pullSyncSnapshotFromServer();
      if (!res?.snapshot?.data) {
        alert('まだ他の端末から送信された同期データがありません。');
        return;
      }
      const { mergedSessionsCount } = applySyncedData(res.snapshot.data, 'merge');
      if (onShowFeedback) {
        onShowFeedback(`同期完了！(${mergedSessionsCount}セッションを統合)`);
      }
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      alert('受信エラー: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApplyManualToken = async () => {
    if (!manualTokenInput.trim()) return;
    try {
      let raw = manualTokenInput.trim();
      if (raw.includes('#sync=')) {
        raw = raw.split('#sync=')[1].split('&')[0];
      }
      const decoded = await decodeSyncToken(raw);
      const { mergedSessionsCount } = applySyncedData(decoded.d, 'merge');
      if (onShowFeedback) {
        onShowFeedback(`データを統合しました！(${mergedSessionsCount}セッション)`);
      }
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      alert('同期コードの復元に失敗しました: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-[440px] max-h-[88vh] overflow-y-auto no-scrollbar bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Smartphone size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                スマホ即時接続 &amp; データ同期
                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-extrabold">
                  2.0 Bridge
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                スマホで最新版を開き、履歴と設定をワンタップ同期
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveMode('qr')}
            className={cn(
              'py-2 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 outline-none',
              activeMode === 'qr'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            )}
          >
            <QrCode size={13} /> QR接続・同期
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('code')}
            className={cn(
              'py-2 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 outline-none',
              activeMode === 'code'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            )}
          >
            <Share2 size={13} /> どこでもURL移行
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('pwa')}
            className={cn(
              'py-2 rounded-lg text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 outline-none',
              activeMode === 'pwa'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            )}
          >
            <Sparkles size={13} /> アプリ化 (PWA)
          </button>
        </div>

        {/* ==========================================
            TAB 1: QR Code & Local Wi-Fi Instant Bridge
           ========================================== */}
        {activeMode === 'qr' && (
          <div className="space-y-4">
            {/* QR Code Display */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                <Wifi size={12} />
                <span>同じWi-Fiのスマホカメラでスキャン</span>
              </div>

              <div className="w-48 h-48 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
                {!qrLoadError ? (
                  <img
                    src={qrImageUrl}
                    alt="Smartphone Access QR Code"
                    className="w-full h-full object-contain"
                    onError={() => setQrLoadError(true)}
                  />
                ) : (
                  <div className="text-center p-2 space-y-1.5">
                    <QrCode size={36} className="mx-auto text-slate-400" />
                    <p className="text-[10px] text-slate-500 font-medium">
                      オフラインのため下のURLをスマホに入力してください
                    </p>
                  </div>
                )}
              </div>

              {/* IP Selector if multiple adapters exist */}
              {networkInfo?.ips && networkInfo.ips.length > 1 && (
                <div className="w-full flex items-center justify-center gap-2 text-[10px]">
                  <span className="text-slate-500 font-bold">Wi-Fi IP切替:</span>
                  <select
                    value={selectedIp}
                    onChange={(e) => setSelectedIp(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-mono font-bold outline-none"
                  >
                    {networkInfo.ips.map((ip) => (
                      <option key={ip} value={ip}>
                        {ip}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target URL & Copy */}
              <div className="w-full flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-2">
                <code className="flex-1 text-[11px] font-mono text-slate-700 font-bold truncate text-left px-1">
                  {targetUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 flex-shrink-0 transition-colors"
                >
                  {copiedUrl ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copiedUrl ? 'コピー済' : 'コピー'}
                </button>
              </div>
            </div>

            {/* Two-Way Instant Sync Buttons */}
            <div className="space-y-2.5 bg-blue-50/50 border border-blue-200/80 rounded-2xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <RefreshCw size={13} className={cn('text-blue-600', isSyncing && 'animate-spin')} />
                  ワンタップ双方向データ同期
                </span>
                {networkInfo?.lastSyncedAt && (
                  <span className="text-[9px] text-slate-500 font-medium">
                    最終更新: {new Date(networkInfo.lastSyncedAt).toLocaleTimeString('ja-JP')} ({networkInfo.sourceDevice})
                  </span>
                )}
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeApiKey}
                  onChange={(e) => setIncludeApiKey(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Gemini APIキーも一緒にスマホへ引き継ぐ (非推奨)</span>
              </label>

              {includeApiKey && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-[10px] text-amber-900 leading-relaxed font-medium animate-fade-in flex items-start gap-1.5">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-800 block">セキュリティ注意</span>
                    ローカル同期データは暗号化されていません。信頼できるプライベートWi-Fiでのみ使用してください。
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePushToLan}
                  disabled={isSyncing}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Upload size={13} /> この端末から送信
                </button>
                <button
                  type="button"
                  onClick={handlePullFromLan}
                  disabled={isSyncing}
                  className="py-2.5 px-3 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Download size={13} /> 他端末から受信・統合
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                ※「受信・統合」はPCとスマホ双方の記録を自動比較し、データを消さずに最新セットをスマート統合します。
              </p>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: Serverless / Portable URL Sync
           ========================================== */}
        {activeMode === 'code' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Share2 size={14} className="text-blue-600" />
                サーバー不要！圧縮URLリンクでデータ移行
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                外出先や別ネットワークでも、設定とトレーニング履歴を圧縮した特別なURLを発行し、LINEやAirDrop等でスマホに送ってワンタップで復元できます。
              </p>

              <label className="flex items-center gap-2 text-[11px] text-slate-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeApiKey}
                  onChange={(e) => setIncludeApiKey(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Gemini APIキーをリンクに含める (非推奨・平文)</span>
              </label>

              {includeApiKey && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded-xl text-[10px] text-red-900 leading-relaxed font-medium animate-fade-in flex items-start gap-1.5">
                  <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-red-800 block">⚠️ 重大なセキュリティ警告</span>
                    共有URLの中身は圧縮・エンコードされるだけで、暗号化されていません。このURLを第三者に見られた場合、APIキーがそのまま漏洩する危険があります。公共チャット等には投稿せず、APIキーはスマホ側で直接入力することを推奨します。
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSharePortableLink}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
              >
                {copiedToken ? <Check size={14} /> : <Share2 size={14} />}
                {copiedToken ? '同期用URLをコピーしました！' : 'データ引き継ぎURLを共有 / コピー'}
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <label className="text-xs font-extrabold text-slate-800 block">
                共有URLまたは同期コードを貼り付けて復元
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  placeholder="https://...#sync=z.... を貼り付け"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleApplyManualToken}
                  disabled={!manualTokenInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  統合
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 3: PWA Home Screen App Installation
           ========================================== */}
        {activeMode === 'pwa' && (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-blue-800">
                <ShieldCheck size={16} className="text-blue-600" />
                スマホのホーム画面にアプリとして追加 (PWA)
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                「マッスルメモ 2.0」は次世代PWA（Progressive Web App）に対応しています。ホーム画面に追加すると、アドレスバー無しのフルスクリーンで起動し、電波の届かないジムでもオフライン動作＆自動アップデートされます。
              </p>

              {isStandalone ? (
                <div className="p-3 bg-green-100/80 border border-green-300 text-green-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <Check size={15} className="text-green-600" />
                  現在インストール済みアプリ（スタンドアロン）として起動中です！
                </div>
              ) : canInstallPwa ? (
                <button
                  type="button"
                  onClick={onInstallPwa}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Download size={15} /> ホーム画面にワンタップでインストール
                </button>
              ) : (
                <div className="bg-white/90 border border-slate-200 rounded-xl p-3.5 space-y-2 text-[11px] text-slate-700 font-medium">
                  <div className="font-extrabold text-slate-800 flex items-center gap-1">
                    📲 {isIos ? 'iPhone / iPad (Safari) での追加手順' : 'スマホブラウザでの追加手順'}
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>
                      スマホのブラウザ（Safari または Chrome）でこのページを開く
                    </li>
                    <li>
                      画面下（または右上）の{' '}
                      <span className="font-bold text-blue-600">「共有（四角から↑）」</span>{' '}
                      または <span className="font-bold text-blue-600">「メニュー（⋮）」</span>{' '}
                      をタップ
                    </li>
                    <li>
                      <span className="font-bold text-slate-800">「ホーム画面に追加」</span>{' '}
                      を選択するとアプリアイコンが作成されます！
                    </li>
                  </ol>
                </div>
              )}

              {/* Gym / Away from Wi-Fi Guide */}
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-[11px] text-slate-700">
                <div className="font-extrabold text-amber-800 flex items-center gap-1">
                  🏋️ ジム（自宅Wi-Fiが届かない場所）で使うときのポイント
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 font-medium leading-relaxed">
                  <li>
                    <span className="font-bold text-slate-800">記録データ：</span>
                    スマホ本体（ローカル）に保存されるため、家のWi-Fiがなくても100%記録・履歴確認できます。
                  </li>
                  <li>
                    <span className="font-bold text-slate-800">AIコーチ通信：</span>
                    スマホのモバイル回線（4G/5G）から直接Geminiと通信するため、外出先でもそのままAI相談が可能です。
                  </li>
                  <li>
                    <span className="font-bold text-slate-800">外出前のコツ：</span>
                    自宅PCのQR（<code className="text-[10px]">192.168.x.x</code>）で開く場合は、<strong>出発前に家でページを開いたまま（再読み込みせずに）</strong>ジムへ行くか、GitHub Pages等のHTTPS環境からホーム画面追加しておくとジムでもいつでも起動できます。帰宅後に「スマホ連携」でPCとデータ統合＆アプリ更新が可能です！
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
