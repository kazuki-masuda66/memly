# Memly API

Vercel AI SDKを使用したAPIサーバーです。モバイルアプリとWebアプリから呼び出すために設計されています。

## 機能

- Vercel AI SDKによるAIストリーミングレスポンス
- Edge Functionsによる高速なレスポンス
- モバイル／Webアプリからアクセス可能なAPI

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## 環境変数の設定

`.env.local.example`ファイルを`.env.local`にコピーして、必要な環境変数を設定してください。

```
OPENAI_API_KEY=your_openai_api_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here
```

## API エンドポイント

### `/api/chat`

チャットメッセージを送信して、AIからのストリーミングレスポンスを受け取ります。

**リクエスト例:**

```json
{
  "messages": [
    { "role": "user", "content": "こんにちは" }
  ]
}
```

### `/api/flashcards`

テキストからAIによるフラッシュカードを生成するエンドポイントです。

**リクエスト例:**

```json
{
  "text": "日本の歴史についての文章...",
  "questionCount": "auto",
  "range": "幕末から明治維新まで",
  "complexity": "medium",
  "language": "ja"
}
```

**リクエストパラメータ:**

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| text | String | Yes | フラッシュカード作成の元となる文章 |
| questionCount | Number/String | No | 生成するフラッシュカードの枚数 (数値 or "auto") |
| range | String | No | 出題したい範囲やテーマ、章など |
| complexity | String | No | "simple", "medium", "detailed" など問題詳細度 |
| language | String | No | 生成する言語 (例: "ja", "en", "zh", "ko" など) |

**レスポンス例:**

```json
{
  "flashcards": [
    {
      "front": "江戸幕府の最後の将軍は？",
      "back": "徳川慶喜"
    },
    {
      "front": "明治維新の中心人物は誰？",
      "back": "西郷隆盛や木戸孝允など"
    }
  ]
}
```

### `/api/youtube`

YouTubeの動画情報を取得するエンドポイントです。

**リクエスト例:**

```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**リクエストパラメータ:**

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| youtubeUrl | String | Yes | YouTube動画のURL |

**レスポンス例:**

```json
{
  "text": "YouTube動画: 動画タイトル\n公開日: 2023/1/1\nビデオID: VIDEO_ID\n\n説明:\n動画の説明文...",
  "videoInfo": {
    "title": "動画タイトル",
    "description": "動画の説明文...",
    "publishedAt": "2023-01-01T00:00:00Z",
    "videoId": "VIDEO_ID",
    "thumbnailUrl": "https://i.ytimg.com/vi/VIDEO_ID/default.jpg"
  }
}
```

## デモページ

プロジェクトには以下のデモページが含まれています：

- `/flashcards` - フラッシュカード生成のデモUIを提供します

## デプロイ

Vercelでデプロイする場合は、リポジトリを連携するだけです。環境変数はVercelのダッシュボードで設定できます。

```bash
# ビルド
npm run build

# Vercelへのデプロイ
vercel --prod
``` 