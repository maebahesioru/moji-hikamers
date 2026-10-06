# もじカウント (moji.hikamers.app)

文字数カウント＆文字変換ツール「もじカウント」の静的サイト一式。
すべてブラウザ内（JavaScript）で処理が完結し、入力テキストはサーバーに送信されません。

- 本番URL: https://moji.hikamers.app/
- 構成: 素の HTML / CSS / JS（ビルド不要）
- ホスティング: nginx:alpine コンテナ（Coolify @ VM100）

## ファイル構成

```
site/            # 公開ファイル一式（nginx がそのまま配信）
  index.html     # トップ（ツール本体 + FAQ）
  style.css
  app.js         # カウント・変換ロジック（クライアント完結）
  privacy.html   # プライバシーポリシー
  robots.txt / sitemap.xml / favicon / ogp.png
Dockerfile       # nginx:alpine + site/ をコピー
nginx.conf       # gzip・キャッシュ設定
```

## 更新方法

```bash
# 1. site/ の中身を編集して push
git add -A && git commit -m "update" && git push

# 2. Coolify で再デプロイ（または Coolify UI から Redeploy）
curl -X POST "https://coolify.hikamers.app/api/v1/deploy?uuid=<APP_UUID>" \
  -H "Authorization: Bearer <COOLIFY_API_KEY>"
```

HTMLはキャッシュしない設定のため、デプロイ後すぐに反映されます。

## ローカル確認

```bash
docker build -t moji-count .
docker run --rm -p 8080:80 moji-count
# → http://localhost:8080/
```
