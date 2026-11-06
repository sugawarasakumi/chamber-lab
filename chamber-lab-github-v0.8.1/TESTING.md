# 配布前の検証

版：v0.8.1。GitHub Pages 向けに `dist/` を `docs/` に配置した、この配布フォルダで検証しました。

- `npm test`：全17検証プログラムが正常終了しました。chamber・各係数体・カタログ・局所系・Milnor fiber・Alexander・net/multinet・jumping loci・基本群・face poset・magnitude・回転・編集履歴・intersection poset・Plinth を含みます。
- 元のサイト本体と、この版の `docs/` 内の42ファイルを照合しました。既存のアプリファイルは全て同一で、静的配信用の `.nojekyll` を追加しています。
- HTML の相対パスと、JavaScript の module / Worker の参照先67件が配布フォルダ内に存在することを確認しました。
- 検証用テストでは import のパスを `./dist/` から `./docs/` に変更しました。

GitHub 上のリポジトリ作成、アップロード、Pages の設定と本番URLでの動作確認は未実施です。公開後は PUBLISH-JA.md の確認手順を行ってください。

この検証記録は、一般の入力に対する全ての数学的性質や全問題の判定を保証するものではありません。各機能の規約・範囲・未判定の表示を参照してください。

## スマートフォンのピンチ操作

`npm test` にはピンチ処理の検証も含まれます。拡大縮小・中点移動、単指操作との切替、3本指の入替、キャンセル後の復帰、誤クリックの抑制を検証します。

ブラウザでの回帰テストは、Node.js 22以降とChromiumがある環境で実行できます。テスト用のブラウザプロファイルを使ってください（テストはそのブラウザ内のアプリ保存データを初期化します）。別の端末で配信サーバーとブラウザを起動してから、検証コマンドを実行します。

```bash
# この配布フォルダから、別々の端末で起動
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
chromium --headless --remote-debugging-port=9223 --user-data-dir=/tmp/chamber-lab-touch-test about:blank

# 両方を起動した状態で実行
node test-touch.mjs http://127.0.0.1:8000 http://127.0.0.1:9223
```

スマートフォンの画面とタッチ入力をエミュレートし、両Labの図のピンチ拡大縮小、指の中点の維持、ページ倍率と厳密な配置データの不変性、作図との競合、既存のズーム操作を確認します。
