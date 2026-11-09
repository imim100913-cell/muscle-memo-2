# Draft PR #1：独立QA引継ぎ（2026-11-09）

> この資料はa94fa2b時点の記録です。その後のPWA更新・未保存入力・依存関係の監査と修正は[自律PM/QAの追加監査](P0-02-autonomous-audit.md)を参照してください。

対象は既存PRの `work/p0-02-data-integrity`。開始時headは `2beb1fb26599980dde7e3138f6a0408de3bd28f9`、baseは `71d37ec9bcf3e9689975c503e216bdaa06a83ab4`。本資料は実装者による回帰検証報告であり、独立QAの合格や公開承認ではありません。

## 今回の変更

- この版には検証済みのセキュアなLAN Bridgeがないため、LAN QR発行と送受信をすべて無効化。未検証のBridgeを有効化するフォールバックを追加していません。
- モーダルを開く際の自動送信、旧 `?sync=lan` の自動受信、HTTP LAN URL生成を撤去。旧URLは初期登録前でも利用不可の説明を開くだけです。
- Vite dev/previewの未認証HTTP Bridge（`/api/network-info`、`/api/sync-state`）も撤去。外部QR画像サービスへのリクエストもなくなりました。
- 設定・LAN画面・PWA画面・READMEで「HTTPSとWeb Locksが必要」「通常のLAN HTTPは動作保証しない」「開いたままでも使用不可」を統一。HTTPSページだけではLAN受信を提供できないことを明記。
- 手動移行は継続。HTTPSではそのorigin/pathの移行URLを作成し、HTTP localhostの開発画面では別端末で開けないURLの代わりに同期コードをコピーします。
- URL・コードが圧縮であって暗号化ではなく、APIキーなしでも履歴・設定を含む注意文を共有操作の前に常時表示。APIキー同梱は初期状態OFFです。
- モバイル試験で発見した、下部ナビゲーションが移行ボタンへのタップを遮る重なりも修正。モーダルをナビゲーションより前に表示します。
- CIにも `npm audit --omit=dev` を追加。依存バージョンとロックファイルは変更していません。

## 検証結果

- `npm ci`：成功。
- `npm test`：**79/79成功**（従来66件を保持し、13件追加）。
- `npm run lint`：エラー0・警告0。
- `npm run build`：成功。Browserslistの古いデータ案内と500kB超チャンク警告は継続。
- `npm run test:e2e`：本番ビルド `docs/`、**42/42成功**（Chromium 21、WebKit/iPhone 13相当設定21）。最終実行2.8分。
- `npm audit --omit=dev`：既知脆弱性0件。
- `git diff --check`：成功。
- `npm audit`（開発依存を含む）：18件（low 1 / moderate 5 / high 12）。Vite/PostCSSとその周辺の開発依存が対象。各項目は更新可能と報告され、`npm audit fix --dry-run` は43パッケージ変更、1追加、2削除を提示しました。安定性確認の対象を広げるため今回は適用せず、別途の依存更新で再検証します。dry-run後もpackage.json/package-lock.jsonの差分なし。
- 同梱の合成JSON 2ファイルを実際の本番Settings画面からインポートし、2セット、RIR null/0、生文字列設定を確認。
- GitHub CIの最終SHA・run URL・結果はPRの最新検証コメントに記録します。

WebKitは初回起動時にOSライブラリ不足で失敗しました。公式Debian snapshotの必要なライブラリを作業用一時ディレクトリへ展開し、公式PlaywrightのWebKitバイナリを専用ランチャーで起動して再検証しました。ランチャーとライブラリはリポジトリへ含めず、システム設定も変更していません。CIでは既存の `playwright install --with-deps` を使用します。

## 実装とテストの対応

| 検証対象 | 使用した本番実装 | 確認内容 |
| --- | --- | --- |
| 生文字列設定 | `storageSchema.decodeStoredValue`、`collectLocalSyncData`、`applySyncedData`、`restoreBackup` | `sound`/`silent`、`free_weight`、`on`/`off`をJSON台帳と一緒に往復。設定の文字列形式を保持し、再同期は不変。未知キー・不正値は事前拒否 |
| JSONの画面操作 | 本番 `SettingsView` のBlob出力・FileReader読込み | `sound/off`と`silent/on`の両方を別の隔離ブラウザプロファイルへ復元し、既存記録への追加と原本保全を確認 |
| URL・コード移行 | 本番 `MobileSyncModal`、CompressionStream、decode/apply | 実際に生成したコードを別プロファイルの画面に貼付け。APIキー除外、設定一致、双方のID保持、原本保全 |
| 初期化の途中失敗 | 本番 `App.clearData` → `useLocalStorage` → `persistEntries` | 初期化前コピー・削除マーカー・全設定・台帳の9保存箇所に1回ずつ障害注入。全preimageの一致、journal除去、エラー通知を確認 |
| 台帳の外部変更 | 本番 `clearData` とhookの保存前照合 | 表示後に台帳を変更すると初期化を拒否し、削除マーカー・コピー・journalを作らない |
| 復旧失敗と複数タブ | 本番App、実Storage、実Web Locks、実ジャーナル | 本物の初期化で台帳書込みとロールバックを失敗させる。待機タブは復旧に触れず、所有タブ終了後に原本・設定・以前のコピーを復旧。再試行は空台帳＋削除ID＋直前コピーを一貫して確定 |
| 非セキュアHTTP | ビルド済み起動処理・本物のsecure context/Web Locks判定 | 非localhostのHTTPテストoriginではWeb Locksがなく起動停止。台帳のraw文字列を保持 |
| HTTPSでBridgeなし | 本番App/モーダルをHTTPSテストoriginで実行 | QRなし、LANボタン無効、Bridge/外部QRへの通信なし、HTTPS移行URLと常時のプライバシー注意 |
| その他の既存回帰 | 従来の本番関数・hook・コンポーネント・App | 1500セット移行、同一ID競合、削除履歴停止、容量不足、未保存入力、初回SW、オフライン起動、2タブ排他、JST境界など |

Vitestは本番関数/hook/Reactコンポーネントをimportしています。Storageの障害注入と、AI・confetti・PWA補助機能の境界スタブは使いますが、保存・移行・復元の実装を模擬関数に置換していません。ブラウザ試験はビルド済みAppと実localStorage/Web Locks/Service Workerを使用します。共有操作ではクリップボード境界だけを捕捉します。

HTTP/HTTPSテストoriginにはPlaywrightのルーティングで実際のビルドファイルを返します。secure context判定はブラウザ自身のものですが、証明書の信頼・実LAN到達性を検証した試験ではありません。通常のブラウザ試験はlocalhostのsecure context例外を使用します。外部通信は遮断し、AI・Sheets・本番サイト・実APIキー・実ユーザー記録は使っていません。

## 既存コメントへの対応

- [ChatGPT P0レビュー](https://github.com/imim100913-cell/muscle-memo-2/pull/1#issuecomment-6717480465)：P0-1のキー別スキーマとP0-2の同一回復可能トランザクションは前headの実装を維持。今回の全生文字列・9保存箇所・ロールバック失敗＋タブ引継ぎ検証で補強しました。
- [Codex 設定形式指摘](https://github.com/imim100913-cell/muscle-memo-2/pull/1#discussion_r4505125385)：対応済み、独立QAによる確認待ち。
- [Codex 初期化指摘](https://github.com/imim100913-cell/muscle-memo-2/pull/1#discussion_r4505125390)：対応済み、独立QAによる確認待ち。
- [PM再審査のP1・プライバシー・PWA案内](https://github.com/imim100913-cell/muscle-memo-2/pull/1#issuecomment-6721549658)：今回修正。セキュアなBridgeの新規実装ではなく、提供できない機能を確実に無効化する判断です。
- PM再審査の開発依存注記：上記の全依存audit・dry-run評価と、本番依存auditのCI追加で区別を明示。18件の解消は未実施です。
- 旧横形式isPRの補足：従来方針を維持。セッションPRをセットへ推測コピーせず、raw原本に残します。表示再計算は別仕様判断です。

レビューthreadを実装者の判断だけでresolvedにはせず、対応内容を返信して独立確認へ引き継ぎます。

## 画面証跡

Chromiumの390×844表示。実機撮影ではありません。

- [LAN無効画面](screenshots/lan-disabled-mobile.png)
- [常時の移行プライバシー注意](screenshots/portable-privacy-mobile.png)
- [PWAとHTTPの案内](screenshots/pwa-guidance-mobile.png)

## 独立QAの実機手順（未実施・担当者確認待ち）

前提：Android Chrome/PWA、可能ならiOS Safari/PWAを使用。機種・OS・ブラウザ版・対象head SHA・origin・期待/実結果・証跡を記録してください。PR headをビルドした隔離QA用HTTPS originを利用し、本番公開やmainの変更はしません。端末が信頼する証明書を使い、セキュリティ例外やWeb Locksの偽装で起動させないでください。

実データが存在する通常プロファイルでは初期化・障害注入を行わず、専用の空プロファイル/originを用意します。利用中の旧版タブ/PWAを終了し、既存記録がある場合は元のバックアップを別に保全してください。APIキーを設定せず、以下の合成バックアップを使用します。

- [sound / off](fixtures/synthetic-sound-off.json)
- [silent / on](fixtures/synthetic-silent-on.json)

1. **HTTPS起動と記録**：両fixtureを別々に復元し、各2セットとRIR未入力/0を確認。新規セッションで重量・回数・手入力メモ・タグを保存し、再起動後も同じ値を確認。
2. **PWA・オフライン**：初回オンライン起動で準備後、ホーム画面から機内モードで再起動し、記録維持と追加保存を確認。SWの初回登録・更新待機中にも未保存メモが消えないことを確認。更新を適用する前に入力を保存/退避。
3. **排他**：同一originをブラウザとPWA、または2タブで開く。後発画面は待機し記録/初期化できないこと。先発を閉じて後発が最新台帳を読むこと。OSがPWAとブラウザを別の保存領域に分ける場合はその結果を記録し、同一originの2タブでも確認。
4. **JSONとURLの往復**：各fixtureの設定でJSON出力→別の隔離プロファイルで復元。HTTPS移行URLの共有/貼付けでも同様に確認。送信前の注意文とAPIキー初期OFF、受信側の既存ID保持を確認。繰り返しても件数が増えないこと。
5. **安全停止**：合成JSONの同一IDの重量だけを変更して復元し、競合通知と既存のraw値不変を確認。専用プロファイルで初期化成功後、旧fixtureの復元が削除履歴により停止すること。削除マーカーを手動解除して合格扱いにしないこと。
6. **初期化途中失敗**：専用QAプロファイルのリモート開発ツールで、`tests/browser/data-integrity.e2e.js` の `waiting tab recovers a real failed clear transaction...` と同じStorage障害を注入。台帳への空配列保存と以前の初期化前コピーへのロールバックを失敗させる。エラー表示・journal残存を確認し、待機タブが触れないことを確認。所有タブ終了/アプリ強制終了後、再起動で台帳・マーカー・設定・以前のコピーが復旧することを確認。障害解除後の再試行では空台帳・削除ID・直前コピーが一貫すること。
7. **物理的中断**：別の専用プロファイルで本番 `persistEntries` のマーカー保存後にデバッガで停止し、ブラウザ/PWAを強制終了。再起動してjournalから復旧し、同期/バックアップを再実行できること。中断位置とストレージ証跡を記録。OSによる全保存領域消去は回復対象外です。
8. **LAN案内**：HTTPS画面と旧 `?sync=lan` の双方でQRなし/送受信無効、Bridge自動通信なしを確認。別途通常の `http://<QA-LAN-IP>` にアクセスし、安全な保存開始前に停止すること。localhost例外を実LANの合格に数えないこと。PWA説明に「HTTPで開いたまま使える」とないこと。
9. **更新導線**：旧版タブ/PWAを終了し、バックアップ・未保存入力の保全後にQA版を起動。初回起動、更新、再起動で原本と件数を比較。旧版の非協調writerを開いたままの運用は保証対象外です。

不一致時は操作を止め、QA用バックアップ、journal、初期化前コピー、origin、時刻とエラーを保全して報告してください。実データやAPIキーをPR添付しないでください。

## 残存リスクと停止条件

- **Android/iOS実機、実PWAインストール・実LAN、信頼されたHTTPS証明書、OSによる物理的強制終了は未検証**。上記は独立QA待ちです。WebKitのモバイル設定を実iPhone検証と呼びません。
- LAN Bridgeは無効。将来の有効化には安全なHTTPS・到達性・権限/アクセス制御の設計と別検証が必要です。
- 削除同期・同一ID競合の自動解決は未実装で安全停止。過去に失われた記録や推測補完値の出自は、原本がなければ復元/識別できません。
- 原本・初期化前コピー・journal用の容量が必要。ブラウザ全保存領域の消去、OS媒体障害、退避前に閉じた未保存入力は回復できません。
- 排他保証はこの版の協調writer間。同一originの旧版タブ/PWAを終了する更新手順が必要です。
- 既存の開発依存18件、build案内は残ります。

**完了状態は「Draft維持・独立QA待ち」です。main/base変更、PRマージ、本番デプロイ、Google Sheets/実データへの書込み、追加課金を伴う外部エージェント実行は行いません。**
