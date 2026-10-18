# マッスルメモ 2.0 (Muscle Memo 2.0)

AIトレーナーがあなたの限界突破をサポートする、スマート筋トレ記録PWAアプリ **「マッスルメモ 2.0」** です。

## 主な特徴

- **科学的な負荷設計エンジン (Anti-Gravity 2.0)**：前回の挙上重量・回数・余力（RIR）・フォーム品質から、4週間のメゾサイクルに基づいた次回の推奨ターゲット（重量・レップ数・目標RIR・最適インターバル）を自動算出します。
- **4人の専属AIトレーナー (Gemini API連携)**：熱血コーチ・スパルタ鬼コーチ・癒やし系コーチ・論理派コーチから選択可能。オフライン時やAPI未設定時もローカル応答で動作します。
- **スマホ完全対応 PWA**：
  - ホーム画面に追加してフルスクリーンアプリとして起動（オフライン対応・ワンタップ自動更新）。
  - **Screen Wake Lock API** によるトレーニング中・インターバル中の画面スリープ防止。
  - **Web Vibration API & Notification API** による触覚フィードバックとインターバル終了通知。
  - **どこでもURLデータ移行（Deflate圧縮トークン）＆ JSON/CSVバックアップ** による端末間のスマートデータ統合。

## クラウド開発（OpenAI Codex / GitHub Codespaces）＆ ローカル開発

詳細なアーキテクチャやコーディング規約は [AGENTS.md](./AGENTS.md) を参照してください。

```bash
npm install
npm run dev      # 開発サーバー起動
npm run lint     # ESLintチェック
npm run build    # 本番ビルド (dist/)
```

## デプロイ (GitHub Pages)

`main` ブランチへプッシュすると、GitHub Actions (`.github/workflows/deploy.yml`) により自動的に GitHub Pages へ最新版がデプロイされます。
