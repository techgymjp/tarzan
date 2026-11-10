# iOS 版をビルドして App Store に出す手順（Mac での作業）

ターザン大東京の iOS 版は、Android 版と同じ Capacitor で作っています（`ios/` フォルダ）。
コードの準備はできているので、Mac では「ビルドして App Store Connect にアップロードする」作業だけを行います。
（JET STRIKE・首都高グランプリの `docs/IOS_BUILD.md` と同じ構成です）

- Bundle ID：`jp.techgym.tarzan`（Android と同じ）
- チーム：Team ID `GNM3VTX9YG`（Xcode の設定に入れてあります）。Apple Developer には**個人で登録**しています（App Store の販売元は個人名になります）
- 対応端末：iPhone（横画面固定）。iPad では iPhone 用の画面で動きます
- ホーム画面の名前：日本語の端末は「ターザン大東京」、英語の端末は「Tarzan Tokyo」
- 広告：AdMob（iOS 用のアプリと広告ユニット）。起動時に「トラッキングの許可」の確認画面が出ます

---

## 0. 先にブラウザでやること（ゲームごとに1回）

1. **Apple Developer**（developer.apple.com）→「Certificates, Identifiers & Profiles」→「Identifiers」→「＋」→「App IDs」→「App」
   - Description：`TARZAN TOKYO`
   - Bundle ID：「Explicit」で `jp.techgym.tarzan`
   - Capabilities：何もチェックしない
2. **App Store Connect**（appstoreconnect.apple.com）→「マイ App」→「＋」→「新規 App」
   - プラットフォーム：iOS ／ 名前：`ターザン大東京 〜ビルからビルへ〜` ／ プライマリ言語：日本語
   - バンドル ID：`jp.techgym.tarzan` ／ SKU：`tarzan` ／ ユーザアクセス：アクセス制限なし
3. **AdMob**
   - 「アプリを追加」→ **iOS** →「ストアに掲載されていない」で登録し、バナー・インタースティシャル・リワードの広告ユニットを作る
   - アプリ ID と広告ユニット ID 3 つを Claude Code に渡す（`ios/App/App/Info.plist` の `GADApplicationIdentifier` と `js/ads.js` の `UNITS.ios.production` に入れます。空の種類は本番ビルドでは出しません）
   - 「プライバシーとメッセージ」→「欧州の規制」のメッセージに iOS アプリも追加する

---

## 1. Mac の準備（最初の1回だけ）

1. **Xcode** を App Store からインストールする（数十 GB あるので時間がかかります）。インストール後に一度起動し、追加コンポーネントのインストールを済ませる
2. Xcode の「Settings…」→「Accounts」→「＋」で、Apple Developer に登録している Apple ID でサインインする（チームが個人名で表示されれば OK）
3. **Node.js**（LTS 版）を https://nodejs.org/ からインストールする
4. ターミナルでリポジトリを取得する
   ```bash
   cd ~/Desktop   # 置きたい場所（どこでもよい）
   git clone https://github.com/techgymjp/tarzan.git
   cd tarzan
   npm ci
   ```
   `git` がないと言われたら、表示に従って「コマンドライン・デベロッパツール」をインストールしてから、もう一度実行します。

2回目以降は、`cd tarzan` のあと `git pull` と `npm ci` で最新にします。

---

## 2. 自分の iPhone で動作確認する（テスト広告）

```bash
npm run ios:sync    # ゲームのファイルを iOS のプロジェクトにコピー（テスト広告）
npm run ios:open    # Xcode で開く
```

1. iPhone を USB ケーブルで Mac につなぎ、iPhone で「このコンピュータを信頼」を許可する
2. iPhone の「設定」→「プライバシーとセキュリティ」→「デベロッパモード」をオンにする（再起動を求められます。項目がない場合は、Xcode で一度 iPhone を選ぶと表示されます）
3. Xcode の上部で、実行先に自分の iPhone を選ぶ
4. 左の「App」→「Signing & Capabilities」で、「Automatically manage signing」がオン、Team に自分（個人名）のチームが選ばれていることを確認する
5. ▶（Run）を押すと、iPhone にアプリが入って起動する

確認すること

- 横画面の全画面で表示される。左右の HUD（タイム・速さ・スティック・ミニマップ・ボタン）がカメラの切り欠き（Dynamic Island）に隠れない
- 起動時にトラッキングの確認画面が出る
- トップ・あそびかた・ポーズ・結果画面の下にテスト用のバナーが出る（プレイ中は出ない）
- ステージを始めるとき・トップへ戻るとき・ポーズから再開するとき・結果画面の「もう一度」「次のステージへ」で、テスト用の全画面広告が出る
- 鬼に捕まると、少しして「広告を見て続ける」が出る → テスト用のリワード広告を最後まで見ると、最後に立っていた屋上から再開できる（1ゲーム3回まで）
- 操作（スティック・つかむ／はなす・ジャンプ）、音、シェア（iOS の共有メニュー）、ミニマップの地図
- 動きが重すぎないか（重いときは自動で描く細かさが下がります）

---

## 3. App Store 用にビルドしてアップロードする（本番広告）

```bash
git pull && npm ci
npm run ios:release   # 本番の広告 ID でコピーする（ここが ios:sync と違う）
npm run ios:open
```

1. Xcode の左で「App」→「General」→「Identity」を開き、**Build の番号を前回より大きくする**（初回は 1。アップロードのたびに 2、3…と上げる。同じ番号は二度アップロードできない）。Version はストアに表示されるバージョン（1.0.0）
2. 上部の実行先を「**Any iOS Device (arm64)**」にする
3. メニューの「Product」→「**Archive**」（「Product」メニューは画面最上部のメニューバー。全画面表示だと隠れるので、マウスを画面の上端に動かす）
4. 終わると Organizer が開くので、「**Distribute App**」→「**App Store Connect**」→「Upload」で進める（途中の確認は既定のまま「Next」でよい。「Xcode Cloud can automate…」は「Remind Me Later」で閉じてよい）
5. 10〜30 分ほどで、App Store Connect の「TestFlight」タブにビルドが表示される

輸出コンプライアンス（暗号化）の質問は、Info.plist で「独自の暗号化は使っていない」と設定済みなので、聞かれません。

**注意**：`ios:release` でビルドしたアプリは本番の広告が出ます。TestFlight で確認するときも、**本番の広告はタップしない**でください（AdMob のアカウント停止の対象）。Xcode から iPhone に直接入れて試すときは、`npm run ios:sync` でテスト広告に戻してから実行します。

---

## 4. TestFlight で確認する

1. App Store Connect の「TestFlight」→「内部テスト」でグループを作り、自分を追加する
2. iPhone に「TestFlight」アプリを App Store から入れ、届いた招待からターザン大東京をインストールする
3. 2 章の「確認すること」を、本番の広告で一通り確かめる（本番広告が出ても**タップしない**。広告が閉じるまで待つ）

審査用の画面録画は不要です（初回の「Guideline 2.1」には、5 章の審査へのメモを返信すれば足ります）。

---

## 5. App Store Connect で審査に出す

「配信」タブ（iOS App のバージョン 1.0.0。「1.0」になっていたら 1.0.0 に直す）で入力します。

| 項目 | 入力内容 |
| --- | --- |
| スクリーンショット | 「Dynamic Island 搭載 iPhone（中型ディスプレイ）」の欄に、`docs/store/ios/6.3inch/` の 2622 × 1206（横向き）を入れる。日本語版（ja-）と英語版（en-）各 4 枚。6.9 インチ（2868 × 1320）は受け付けられない |
| ヘッダ・検索結果 | 「ヘッダと検索結果」タブに `docs/store/ios/appstore-header-3840x1646.png` と `appstore-search-3840x2560.png`（両方入れる。片方だけだと赤枠になる） |
| 名前・サブタイトル・プロモーション用テキスト・概要 | `docs/store/ios/listing.md`（App Store 用の掲載情報。日英） |
| キーワード（100 文字以内） | `docs/store/ios/listing.md` |
| サポート URL | https://techgym.jp/ |
| プライバシーポリシー URL（App 情報） | https://techgym.jp/privacy-policy/ |
| カテゴリ（App 情報） | ゲーム（サブカテゴリ「アクション」） |
| 著作権 | 2026 TECH GYM K.K. |
| ビルド | TestFlight で確認したビルドを選ぶ |
| 年齢制限 | 質問に答える（金棒を持った鬼に追いかけられ、捕まるとゲームオーバー。攻撃・けが・流血の描写なし） |
| コンテンツの配信権（App 情報） | 第三者のコンテンツを「はい」：建物は国土交通省 PLATEAU（CC BY 4.0 互換）、水面・道路・ミニマップは国土地理院、首都高の線は OpenStreetMap（ODbL）のデータを加工して使っており、どれも商用利用を認める条件で、出典をアプリ内に表示している |
| App のプライバシー | AdMob が収集するデータを申告する（下記） |
| App Review に関する情報 | ログイン不要。連絡先を入力。メモに下の「審査へのメモ」を貼る |

**App のプライバシー（AdMob を使うアプリの目安）**
Google の「Apple の App Store のデータ開示要件への準備」（AdMob のヘルプ）に、AdMob が収集するデータの一覧があります。必ずそちらを見て最終確認してください。目安は次のとおりです。

- 収集する：ID（デバイス ID）、使用状況データ（広告データ、製品の操作）、診断（クラッシュデータ、パフォーマンスデータ、その他の診断データ）、位置情報（おおよその場所）
- 目的：サードパーティ広告、アナリティクス
- ユーザーに関連付け：しない
- トラッキングに使用：デバイス ID と広告データは「する」
- アプリ自体は個人情報を集めない（クリアしたステージ・ベストタイム・ビル図鑑は端末の中だけに保存）

**審査へのメモ（App Review に関する情報の「メモ」に最初の提出から貼る。初回に「Guideline 2.1 - Information Needed」が来たら、同じ文を返信する。実機の画面録画の添付は不要）**

6 と 7 は、デザインスパム（Guideline 4.3）と最低限の機能（Guideline 4.2）への先回りの説明です（techgymjp/jet-fighter の `docs/ANDROID_PORTING.md` 7-6 のひな形）。同じ開発者アカウントから同じ構成（Capacitor）のアプリを続けて出すと「同じ作りのアプリの量産」、Web の技術で作ったアプリは「Web サイトを包んだだけ」と見られることがあるためです。

```
1. Purpose and audience: Tarzan Tokyo is a free 3D action game for ages 13+. Players swing from building to building over a recreation of central Tokyo, hanging from a rope that dangles from a helicopter, while avoiding cartoon oni (Japanese ogres) that chase them.

2. How to use: No login or account is needed. Tap "PLAY" ("プレイ" in Japanese), choose a stage, then tap GRAB to catch the rope and again to let go; move with the left stick and use JUMP on the right. The game is shown in English on English-language devices and in Japanese on Japanese-language devices.

3. External services: Google AdMob (banner, interstitial and rewarded ads) with Google's consent form (UMP) and App Tracking Transparency. Rewarded ads are optional: when the player is caught by an oni, watching one lets them continue from their last rooftop (up to 3 times per game). The minimap loads map tiles from the Geospatial Information Authority of Japan. No other services or in-app purchases.

4. Regional differences: None, except that the ad consent form appears only where required (e.g. EEA/UK).

5. Regulated content / third-party material: The game is not in a regulated industry. Buildings come from Project PLATEAU by MLIT Japan (CC BY 4.0 compatible), water areas, roads and map tiles from the Geospatial Information Authority of Japan, and expressway lines from OpenStreetMap (ODbL). All allow commercial use and are credited in the app. Landmarks are simplified original 3D models.

6. Originality (Guideline 4.3): Tarzan Tokyo is an original app that we designed and built ourselves. It does not copy or imitate any other app, and it is not made from a template, a purchased source code or a re-skin of another game. The city of about 100,000 buildings was generated by our own tools from open data, and more than 100 landmark 3D models (Tokyo Tower, the Imperial Palace, Senso-ji, Rainbow Bridge and others), the 10 missions, the characters, the music and the sound effects were created specifically for this app. It is also not a template-based variation of our other apps. Each of our games has its own game system that we designed and programmed individually for that title, and we do not reuse a game template from one app to make another, even when two of our games are in the same genre. This game's system (rope-swing physics with a moving helicopter anchor and release-timing boosts, collision and rooftop landings on the city's buildings, the oni tag chase, rooftop checkpoints and the building collection) was built only for this title, and its gameplay, content and visuals are its own. Only standard technical parts, such as the Capacitor app shell and the AdMob ad integration, are shared across our apps. We publish this game as a single app with one Bundle ID; there are no other versions of it on the App Store (for example, no separate free and paid editions or regional copies).

7. App functionality (Guideline 4.2): The app is not a website wrapper. All game content (code, the city and building data, 3D models, sounds and texts) is bundled in the app, and the game can be played offline. Only the minimap's background map tiles are loaded from the Geospatial Information Authority of Japan while playing (without a connection the minimap shows only the building outlines). It also uses native iOS features such as the share sheet and App Tracking Transparency.
```

入力が終わったら「審査用に追加」→「審査へ提出」。

---

## 6. 公開後にやること

- AdMob で iOS アプリを App Store のアプリに紐づける（「アプリ」→ iOS のターザン大東京 →「アプリの設定」）
- App Store からインストールして、起動・同意画面・トラッキングの確認・広告を確認する

---

## 7. 自動化の準備（2回目以降を GitHub Actions に任せる場合）

JET STRIKE の `docs/IOS_BUILD.md` の 7 章と同じです。App Store Connect の API キーと配布用の証明書は Apple Developer のチーム共通なので、JET STRIKE・首都高グランプリで作ったものを使い回せます。このリポジトリの Secrets（https://github.com/techgymjp/tarzan/settings/secrets/actions）に、次の 5 つを登録します。

| 名前 | 内容 |
| --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | 証明書（.p12）を変換した文字列 |
| `IOS_DIST_CERT_PASSWORD` | .p12 を書き出したときのパスワード |
| `ASC_KEY_ID` | API キーのキー ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8_BASE64` | API キー（.p8）を変換した文字列 |

文字列への変換（Mac のターミナル。1つずつ実行して、そのつど GitHub に貼り付ける）：

```bash
base64 -i 証明書.p12 | tr -d '\n' | pbcopy
```

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | tr -d '\n' | pbcopy
```

登録すると、既定のブランチに push するたびに、GitHub Actions の「iOS release (TestFlight)」（`.github/workflows/ios-release.yml`）が、本番広告の設定でビルドして App Store Connect（TestFlight）にアップロードします（Secrets がないあいだは何もしません）。

- ビルド番号は **100 + 実行回数**（Mac の Xcode から手でアップロードする 1、2、… と重ならないように）。Version は `package.json` の version
- 署名用のプロファイル（`jp.techgym.tarzan AppStore CI`）は、API キーを使って自動で作ります（`scripts/ios_profile.py`。Bundle ID が Apple Developer に登録済みであること）
- 手で動かすときは Actions タブ →「iOS release (TestFlight)」→「Run workflow」
- 審査への提出は、これまでどおり App Store Connect で行う
- このほか「iOS build check」（`.github/workflows/ios.yml`）が、push のたびに署名なしでビルドできるかを確かめます

**注意**：証明書（.p12）、そのパスワード、API キー（.p8）は、チャット・AI へのアップロード・リポジトリへのコミットで**絶対に共有しない**でください。

---

## 8. Web 版だけの部分について（Guideline 5.6 対策）

Google Play へのリンク（Web 版のトップ・あそびかた画面）と、テスト用の `?debug`・`?unlock` は、アプリのビルドに入れません。`npm run ios:sync`・`ios:release`・`android:sync` と GitHub Actions は、アプリ用のビルド（`npm run build:app`）で Web 版だけの部分を取り除いてから iOS / Android のプロジェクトにコピーします（README の「iOS アプリ」の章）。

他社のストアへのリンクと、それを Apple の端末やアプリの中でだけ隠す処理がバンドルに入っていると、「審査中に隠した機能がある」（Guideline 5.6 - Developer Code of Conduct）としてリジェクトされることがあります（ちゃぶ台返しリメンバーで実際にあった）。もしこの理由でリジェクトされたら、新しいビルドに差し替えて、App Review への返信で次のように説明し、実機の画面録画を添付します。

```
Thank you for your review. The previous build included a link to our Android version on Google Play and code that hid it inside the app; both were intended only for our web version. We have removed this web-only code, together with test-only URL parameters, from the app bundle. The app now has exactly the same features during and after review, and nothing is shown or hidden depending on the device, date or region.
```

---

## つまずきやすいところ

| 症状 | 対処 |
| --- | --- |
| アップロードで「同じビルド番号がすでにある」 | General の Build の番号を上げてから Archive し直す |
| Signing でエラー（チームが選べない、証明書がない） | Xcode の Accounts で Apple ID にサインインし直し、Team を選ぶ。「Automatically manage signing」をオンにする |
| 実行先に iPhone が出ない | ケーブルをつなぎ直し、iPhone で「信頼」を許可。デベロッパモードをオンにする |
| 実行先に「iOS 26.x Not Installed」と出る | 「Get」で iOS の部品をダウンロードする（8 GB ほど。Archive にも必要） |
| ビルドが古いゲームのまま | `npm run ios:sync`（または `ios:release`）を実行し忘れている。`git pull` してから実行し直す |
| ビルドを選ぼうとしても出てこない | App Store Connect のバージョンが「1.0」のまま。1.0.0 に直して保存する |
| 「審査用に追加できません」 | 「App 情報」のコンテンツの配信権、「App のプライバシー」のプライバシーポリシー URL が入っているか確認する |
| 本番の広告が出ない | iOS の本番の広告ユニット ID がまだ `js/ads.js` に入っていない（空の種類は本番ビルドで出さない） |
| 「Guideline 5.6 - Developer Code of Conduct」（審査中に隠した機能）でリジェクト | 8 章。Web 版だけの部分がアプリに入っていないか、`npm run build:app` を使っているかを確認する |
| 本番広告とテスト広告の取り違え | App Store 用は必ず `npm run ios:release`。Xcode から実機で試すときは `npm run ios:sync` に戻す |
| App Store の審査で「Xcode が古い」と言われる | Xcode を最新版に更新してから Archive し直す |
