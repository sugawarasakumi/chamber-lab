# Chamber Lab / Plinth Lab

直線配置の作図・不変量計算と、splitting polygon の構成を試す研究用ベータ版です。現在の版は **v0.8.1** です。

この一式は GitHub アカウント **sugawarasakumi** のリポジトリ **chamber-lab** で公開するための配布版です。公開操作はまだ行われていません。[PUBLISH-JA.md](PUBLISH-JA.md) に設定手順があります。

## 二つの実験室

- **Chamber Lab**：実直線配置を作図またはカタログから選び、吉永の chamber basis に基づく局所系・Aomoto コホモロジー、Milnor fiber の Betti 数とモノドロミー、Alexander 多項式などを調べます。交点・特性多項式・intersection poset・face poset・tope graph とその magnitude/magnitude homology も表示します。
- **Plinth Lab**：Guerville-Ballé の plinth から追加直線を1辺ずつ構成します。閉条件 Δ(λ)、出発点 Q₁ と戻り点 R₁ の一致・不一致、二つの解、交差束や generic 条件の検証を表示します。

両方ともページ内のタブで切り替えます。計算はブラウザ内で行います。ビルドやパッケージのインストールは不要です。

## 最初に試す例

1. Chamber Lab の既定の A₃ 配置で、flag と chamber の対応を見ます。Milnor fiber の Betti 数は (1, 7, 18) です。
2. B₃ の Milnor fiber では、Euler 数が 1 − 8 + 79 = 72 になることを確認できます。
3. Plinth Lab で「有理 pair · 13直線」を選び、「次へ」で3辺を順に引きます。λ=3/2 または 2/5 で Q₁=R₁ となり、「nonsplitting の例」では閉じません。

## 結果の読み方と計算範囲

一般入力に対する全問題の判定器ではありません。自動計算の結果、証明書で認証した結果、引用文献による既知の結果、未判定の結果を分けて表示します。

- Chamber Lab の入力は affine 20直線までです。カタログごとの有理数体・選ばれた実代数体に対応します。
- Plinth Lab の基礎配置は射影28直線、plinth の長さは3–8です。係数は有理数体・二次体と、対応する二次拡大で次数4までの解を扱います。
- K(π,1) は実装した十分条件・必要条件を検査します。全てを通過しても、一般に YES とは判定しません。
- Jumping loci は、定義行列・小行列式による ideal と、計算が完了した場合の成分分解を表示します。一般の全成分の自動分解には対応していません。
- この版の Milnor fiber 計算は Betti 数と複素モノドロミー固有空間を対象とし、整数係数ホモロジーの torsion は計算しません。
- Plinth の閉条件や同じ交差束だけから、位相的に異なる Zariski pair とは判定しません。文献で認証された例とモジュライ分離の例を区別します。

より詳しい規約・上限・参考文献は、Chamber Lab の「数学と使い方」「計算の範囲・出典」と、Plinth Lab の検証欄にあります。新しい研究結果に利用する際は、バージョンと入力配置・パラメータを保存し、該当する理論と計算を確認してください。

## 保存と不具合報告

作業内容は、そのブラウザの保存領域に保存します。「配置を保存」「実験を保存」で JSON を書き出せます。端末・ブラウザ・公開先のドメインを変えると、自動保存の内容は共有されません。

公開後の不具合報告は、このリポジトリの **Issues** からお願いします。使用したバージョン、ブラウザ、例の名前または再現用 JSON、操作手順、期待した結果と実際の結果を添えると再現しやすくなります。

## ローカルで開く・検証する

ブラウザでの動作には HTTP サーバーを使います。ファイルをダブルクリックする方法では module / Worker が正常に動かない場合があります。

```bash
python3 -m http.server 8000 --directory docs
```

その後、ブラウザで `http://localhost:8000/` を開きます。

検証用の Node.js と Python 3 がある環境では、リポジトリのルートで次を実行できます。外部パッケージのインストールは不要です。

```bash
npm test
```

`docs/` がサイト本体、ルートの `test*.mjs`・`test-extended-catalogue.py` と `data/` が検証用です。実装の詳細と過去の更新履歴は [DEVELOPMENT.md](DEVELOPMENT.md) にあります。

## 主な参考文献

- M. Yoshinaga, *Minimality of hyperplane arrangements and basis of local system cohomology*, [arXiv:1002.2038](https://arxiv.org/abs/1002.2038).
- M. Yoshinaga, *q-deformation of Aomoto complex*, [arXiv:2401.00810](https://arxiv.org/abs/2401.00810).
- M. Yoshinaga, *Milnor fibers of real line arrangements*, [arXiv:1301.1430](https://arxiv.org/abs/1301.1430).
- Cuntz–Elia–Labbé, [arXiv:2009.14152](https://arxiv.org/abs/2009.14152) と [実現座標データベース](https://sophiasage.github.io/cn_hyperarr/doc/html/database.html).
- B. Guerville-Ballé, splitting polygon による構成, [arXiv:2111.00399](https://arxiv.org/abs/2111.00399), [arXiv:2409.18022](https://arxiv.org/abs/2409.18022).

そのほか各計算で使用する定理と出典は、アプリ内の該当箇所に記載しています。

## この版の変更

v0.8.1：Plinth の作図に「前へ／次へ」を追加しました。始める点・通る pivot・到着点を色で対応させ、最後の Q₁ と R₁ を図と正確な座標で比較します。完成した splitting polygon の辺と内部を強調し、無限遠の pivot は方向で表示します。
