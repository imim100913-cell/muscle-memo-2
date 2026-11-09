import React, { useState } from 'react';
import {
  Smartphone,
  QrCode,
  Wifi,
  Share2,
  Check,
  Download,
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
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
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [activeMode, setActiveMode] = useState('qr'); // 'qr' | 'code' | 'pwa'

  if (!isOpen) return null;

  const canShareUrl = window.location.protocol === 'https:';

  const handleSharePortableLink = async () => {
    try {
      const token = await encodeSyncToken(includeApiKey);
      const loc = window.location;
      // Local development addresses cannot be opened safely on another device.
      const shareUrl = canShareUrl ? `${loc.origin}${loc.pathname}#sync=${token}` : token;

      if (canShareUrl && navigator.share) {
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
      if (onShowFeedback) onShowFeedback(canShareUrl ? 'データ付き共有URLをコピーしました！' : '同期コードをコピーしました。移行先のHTTPS画面へ貼り付けてください。');
    } catch (e) {
      if (e.name !== 'AbortError') {
        alert('共有リンクの作成に失敗しました: ' + e.message);
      }
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
        onShowFeedback(`データを統合しました！(${mergedSessionsCount}セット)`);
      }
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      alert('同期コードの復元に失敗しました: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Card */}
      <div role="dialog" aria-modal="true" aria-label="スマホへのデータ移行" className="relative z-10 w-full max-w-[440px] max-h-[88vh] overflow-y-auto no-scrollbar bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Smartphone size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                スマホへのデータ移行 &amp; PWA
                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-extrabold">
                  2.0
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                HTTPSで起動し、履歴と設定を手動で移行
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="データ移行画面を閉じる"
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
            <Share2 size={13} /> URL・コード移行
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
            <div role="status" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 text-[11px] text-slate-700 leading-relaxed">
              <p className="font-extrabold text-amber-900 flex items-center gap-1.5">
                <Wifi size={14} /> LAN QR接続・自動同期は利用できません
              </p>
              <p>
                この版では検証済みのセキュアなLAN Bridgeを提供していないため、QRコードの発行とLAN送受信を無効にしています。HTTPSのページを開くだけではLAN同期はできません。
              </p>
              <p>
                安全な保存にはHTTPSとWeb Locks対応ブラウザが必要です。HTTP接続（http://192.168.x.x など）では動作保証しません。ページを開いたままでも利用できません。
              </p>
              <p>
                通常はHTTPSで起動してオフライン入力を利用し、「URL・コード移行」または設定のJSONバックアップで手動移行してください。同一IDの競合や削除履歴がある場合は、原本を保護して移行を停止します。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled className="py-2.5 px-3 bg-slate-100 text-slate-400 rounded-xl text-[11px] font-bold">
                この端末から送信
              </button>
              <button type="button" disabled className="py-2.5 px-3 bg-slate-100 text-slate-400 rounded-xl text-[11px] font-bold">
                他端末から受信・統合
              </button>
            </div>
            <button type="button" onClick={() => setActiveMode('code')} className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold">
              URL・コードで手動移行する
            </button>
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
                設定とトレーニング履歴を圧縮したURL・コードで手動移行できます。移行先でもHTTPSとWeb Locks対応ブラウザが必要です。ローカル開発画面ではURLの代わりに同期コードをコピーし、移行先のこの画面へ貼り付けてください。
              </p>

              <p role="note" className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                共有前の注意：URL・コードは圧縮・エンコードされるだけで、暗号化されていません。APIキーを含めなくてもトレーニング履歴・設定が含まれ、受け取った人は内容を読めます。公開の場所には投稿せず、信頼できる相手にだけ渡してください。
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
                {copiedToken ? 'コピーしました！' : canShareUrl ? 'データ引き継ぎURLを共有 / コピー' : '同期コードをコピー'}
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
                「マッスルメモ 2.0」は次世代PWA（Progressive Web App）に対応しています。ホーム画面に追加すると、アドレスバー無しのフルスクリーンで起動し、初回準備後は電波の届かないジムでもオフラインで動作します。更新は未保存入力を保全してから適用してください。
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
                    スマホ本体（ローカル）に保存されるため、HTTPSで初回起動とオフライン準備を済ませれば、家のWi-Fiがなくても記録・履歴確認できます。
                  </li>
                  <li>
                    <span className="font-bold text-slate-800">AIコーチ通信：</span>
                    スマホのモバイル回線（4G/5G）から直接Geminiと通信するため、外出先でもそのままAI相談が可能です。
                  </li>
                  <li>
                    <span className="font-bold text-slate-800">外出前のコツ：</span>
                    HTTPSとWeb Locks対応ブラウザで起動し、ホーム画面への追加後にオフラインで再起動できることを確認してください。HTTPのLANアドレスは開いたままでも利用できません。記録の移行はURL・コードまたはJSONバックアップで行います。更新前は未保存入力を保存・退避し、旧版のタブとPWAを閉じてください。
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
