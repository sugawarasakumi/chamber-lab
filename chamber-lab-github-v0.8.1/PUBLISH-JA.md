# sugawarasakumi 向け：Chamber Lab の試験公開

準備済みの版：**v0.8.1**。このファイル一式を作成した時点では、GitHub のリポジトリ作成・アップロード・Pages 公開はまだ行っていません。

この手順では、公開リポジトリ `sugawarasakumi/chamber-lab` を作り、`main` ブランチの **`/docs`** フォルダを GitHub Pages に指定します。公開されるアプリは現在の Chamber Lab / Plinth Lab と同じ版です。

## 1. リポジトリを作る

1. GitHub に `sugawarasakumi` でログインします。
2. 右上の「＋」から **New repository** を選びます。
3. Owner が `sugawarasakumi` であることを確認します。
4. Repository name に **`chamber-lab`** を入力します。
5. Visibility は **Public** を選びます。アプリとアップロードしたコードは誰でも閲覧できる状態になります。
6. **Add README** を有効にして、**Create repository** を押します。

既に同名のリポジトリがある場合は、この段階で既存ファイルを上書きせず、そのURLを知らせてください。別名を使う場合は、以下の予定URLの `chamber-lab` もその名前に変わります。

## 2. ZIP を展開して中身をアップロードする

1. `chamber-lab-github-v0.8.1.zip` をダウンロードして展開します。
2. 展開した `chamber-lab-github-v0.8.1` フォルダを開きます。
3. GitHub のリポジトリで **Add file → Upload files** を選びます。
4. **そのフォルダの中身**をアップロード画面へドラッグします。`docs` と `data` はフォルダごと、README やテストはファイルごと入れます。既存の README は、この配布版のものに置き換えます。
5. 変更の説明を `Add Chamber Lab v0.8.1 beta` などにし、`main` に **Commit changes** します。

重要なのは、リポジトリの最上位に **`docs` フォルダがあり、その中に `index.html` がある**ことです。ZIPそのものや、外側の `chamber-lab-github-v0.8.1` フォルダを丸ごと1段深くアップロードしないでください。

`docs/.nojekyll` は空のファイルです。通常はフォルダごとのアップロードに含まれます。もし含まれていなければ、GitHub の **Add file → Create new file** で名前を `docs/.nojekyll` とし、作成します。

## 3. GitHub Pages を有効にする

リポジトリの **Settings → Pages** を開き、Build and deployment を次のように設定します。

| 項目 | 設定 |
| --- | --- |
| Source | Deploy from a branch |
| Branch | main |
| Folder | /docs |

**Save** を押します。ビルド用の独自 workflow やパッケージのインストールは不要です。公開まで数分かかることがあります。Pages 画面に表示される公開先リンクで成功を確認してください。

公開が成功した後の予定URLは次のとおりです。準備時点では稼働を確認していません。

- 全体・Chamber Lab：`https://sugawarasakumi.github.io/chamber-lab/`
- Plinth Lab：`https://sugawarasakumi.github.io/chamber-lab/#plinth`

404 の場合は、Pages の設定が `main` / `/docs` になっているか、リポジトリの `docs/index.html` が存在するか、Actions に表示される Pages の処理が完了しているかを確認します。

## 4. 公開先で最初に確認する

1. **Chamber Lab**：既定の A₃ 配置が描画され、計算が完了すること。
2. **Milnor fiber**：A₃ の Betti 数が (1, 7, 18) と表示されること。
3. **Plinth Lab**：「有理 pair · 13直線」を選んで「次へ」を3回押すと、Q₁ と R₁ が一致すること。
4. 「nonsplitting の例」に切り替えると、Q₁ と R₁ が別々に表示されること。
5. 「配置を保存」または「実験を保存」で JSON を保存できること。

今の ChatGPT 上のサイトと GitHub Pages は別の保存先です。以前の作業を使う場合は、元のサイトで JSON を書き出し、新しいサイトで読み込んでください。

## 5. 最初は数人にURLを伝える

Pages の公開が確認できたら、まず知人の研究者数人にURLを伝え、作図のわかりやすさ・計算結果・使いづらい箇所を見てもらうのがおすすめです。これは一般公開したサイトの告知先を数人に絞る方法です。

報告には、版の番号、例の名前・パラメータ、必要なら再現用 JSON、期待した結果と実際の結果を添えてもらうと修正しやすくなります。公開リポジトリの Issues も報告先に使えます。

## 6. Google Sites から紹介する

最初の意見を反映したら、個人HPに「Chamber Lab / Plinth Lab」という項目を追加します。

紹介文の例：

> 実直線配置の chamber basis に基づく不変量計算と、plinth・splitting polygon の構成を試せる研究用ベータ版です。計算の規約・対応範囲・参考文献はアプリ内に記載しています。

Google Sites の **挿入 → ボタン** で、次の二つを設定できます。

| ボタン名 | リンク先（公開成功後） |
| --- | --- |
| Chamber Lab を開く | https://sugawarasakumi.github.io/chamber-lab/ |
| Plinth Lab を開く | https://sugawarasakumi.github.io/chamber-lab/#plinth |

最後に Google Sites 側の **公開** を押すと、個人HPの更新が反映されます。

## 更新するとき

アプリを更新する場合は `docs/` 内の対応するファイルを更新して `main` に commit します。GitHub Pages はその変更から再公開します。README の版とアプリ上部の版もそろえてください。

## 公式の手順

- [GitHub Pages：公開元の設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pages：サイトの作成](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Google Sites：ボタンを追加する](https://support.google.com/sites/answer/90538?hl=ja)
