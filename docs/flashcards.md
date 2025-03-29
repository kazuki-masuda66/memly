# Memly フラッシュカード生成 API 設計書

## 概要

Memlyのフラッシュカード生成機能は、様々なソースからコンテンツを取得し、AIを用いて効果的な学習カードを自動生成するシステムです。本ドキュメントでは、フラッシュカード生成に関連する各APIエンドポイントの詳細、リクエスト/レスポンス形式、およびデータモデルについて解説します。

## 基本情報

- **ベースURL**: `https://api.memly.ai/v1`
- **認証方式**: JWTトークン（Authorization: Bearer）
- **レスポンス形式**: JSON
- **エラーハンドリング**: HTTP ステータスコードとエラーメッセージを含むJSONレスポンス

## データモデル

### Flashcard

フラッシュカードの基本データ構造

```typescript
interface Flashcard {
  id: string;               // フラッシュカードの一意識別子
  deckId: string;           // 所属するデッキのID
  front: string;            // 表面のテキスト（質問）
  back: string;             // 裏面のテキスト（回答）
  front_rich?: string;      // リッチテキスト形式の表面（HTMLタグを含む）
  back_rich?: string;       // リッチテキスト形式の裏面（HTMLタグを含む）
  tags?: string[];          // タグリスト
  created_at: string;       // 作成日時 (ISO 8601形式)
  updated_at: string;       // 更新日時 (ISO 8601形式)
  source_type?: string;     // ソースの種類 (youtube, web, pdf, audio, image など)
  source_url?: string;      // ソースのURL
}
```

### Deck

フラッシュカードをグループ化するデッキの構造

```typescript
interface Deck {
  id: string;               // デッキの一意識別子
  name: string;             // デッキ名
  description?: string;     // デッキの説明
  user_id: string;          // 所有ユーザーのID
  created_at: string;       // 作成日時
  updated_at: string;       // 更新日時
  card_count: number;       // 含まれるカード数
  tags?: string[];          // デッキのタグ
  is_public: boolean;       // 公開状態
  thumbnail_url?: string;   // サムネイル画像URL
}
```

## フラッシュカード生成ロジック

Memlyのフラッシュカード生成は以下のプロセスで行われます：

1. **コンテンツ取得**: YouTubeビデオ、Webサイト、PDFなどからコンテンツを取得
2. **コンテンツ解析**: テキスト抽出、重要部分の検出、構造解析
3. **カード生成**: AI（Google Gemini 1.5 Pro）によるフラッシュカード候補の生成
4. **最適化**: 重複除去、難易度調整、順序最適化
5. **フォーマット調整**: リッチテキスト形式への変換（必要に応じて）

## APIエンドポイント

### YouTube動画からフラッシュカードを生成

```
POST /flashcards/generate/youtube
```

**リクエスト**

```json
{
  "youtube_url": "https://www.youtube.com/watch?v=...",
  "deck_id": "optional-deck-id",
  "deck_name": "新しいデッキ名（deck_idが指定されていない場合に使用）",
  "language": "ja",
  "card_count": 10
}
```

**内部処理の流れ**

1. YouTube APIを使用して動画のメタデータと字幕を取得
2. 字幕テキストを前処理（クリーニング、段落分割）
3. Google Gemini 1.5 Proに処理したテキストを送信
4. AIが内容を理解し、重要な概念を抽出
5. 質問（表面）と回答（裏面）の組み合わせを生成
6. HTMLタグを含むリッチテキストバージョンを生成

**レスポンス**

```json
{
  "status": "success",
  "deck_id": "generated-deck-id",
  "cards": [
    {
      "id": "card-id-1",
      "front": "質問1",
      "back": "回答1",
      "front_rich": "<p>質問1</p>",
      "back_rich": "<p>回答1</p>",
      "source_type": "youtube",
      "source_url": "https://www.youtube.com/watch?v=..."
    },
    // ... 生成されたカード
  ]
}
```

### Webサイトからフラッシュカードを生成

```
POST /flashcards/generate/web
```

**リクエスト**

```json
{
  "url": "https://example.com/page",
  "deck_id": "optional-deck-id",
  "deck_name": "新しいデッキ名",
  "language": "ja",
  "card_count": 10
}
```

**内部処理の流れ**

1. URLからWebコンテンツを取得
2. HTMLをパースして本文テキストを抽出（不要な広告やナビゲーションを除去）
3. テキストを意味のある段落やセクションに分割
4. Google Gemini 1.5 Proに処理したテキストを送信
5. 重要な概念と関連する詳細情報を抽出
6. 表面と裏面のペアを生成

**レスポンス**: YouTube動画生成と同様

### ファイルアップロードからフラッシュカードを生成

```
POST /flashcards/generate/file
```

**リクエスト** (multipart/form-data)

- `file`: アップロードするファイル (PDF, Word, 音声ファイル, 画像)
- `deck_id`: (オプション) 既存のデッキID
- `deck_name`: 新しいデッキ名
- `language`: 言語コード
- `card_count`: 生成するカード数

**ファイルタイプ別の内部処理**

1. **PDF & Word文書**:
   - テキスト抽出ライブラリを使用してコンテンツを抽出
   - 文書の構造（見出し、段落、箇条書き）を保持
   - テキストをセマンティックチャンクに分割

2. **音声ファイル**:
   - Google Gemini 1.5 Proを使用して高精度の音声認識
   - 発言者の区別、句読点の自動挿入、ノイズ除去
   - 認識されたテキストからキーポイントを抽出

3. **画像ファイル**:
   - Google Gemini 1.5 Proによる画像認識と文字抽出
   - 表や図形内のテキストも認識
   - 画像の内容に基づいたフラッシュカード生成

**レスポンス**: 他の生成エンドポイントと同様

### フラッシュカードの保存

```
POST /flashcards/save
```

**リクエスト**

```json
{
  "deck_id": "deck-id",
  "cards": [
    {
      "front": "質問1",
      "back": "回答1",
      "front_rich": "<p>質問1</p>",
      "back_rich": "<p>回答1</p>",
      "tags": ["タグ1", "タグ2"],
      "source_type": "youtube",
      "source_url": "https://www.youtube.com/watch?v=..."
    }
    // ... 保存するカード
  ]
}
```

**レスポンス**

```json
{
  "status": "success",
  "saved_cards": [
    {
      "id": "新しいカードID",
      "front": "質問1",
      "back": "回答1",
      // ... その他のフィールド
    }
    // ... 保存されたカード
  ]
}
```

### フラッシュカードの更新

```
PUT /flashcards/{card_id}
```

**リクエスト**

```json
{
  "front": "更新された質問",
  "back": "更新された回答",
  "front_rich": "<p>更新された質問</p>",
  "back_rich": "<p>更新された回答</p>",
  "tags": ["タグ1", "新しいタグ"]
}
```

**レスポンス**

```json
{
  "status": "success",
  "card": {
    "id": "card-id",
    "front": "更新された質問",
    "back": "更新された回答",
    // ... その他の更新されたフィールド
  }
}
```

### フラッシュカードの削除

```
DELETE /flashcards/{card_id}
```

**レスポンス**

```json
{
  "status": "success",
  "message": "カードが削除されました"
}
```

### 保存済みフラッシュカードの取得

```
GET /flashcards/saved
```

**クエリパラメータ**

- `deck_id`: (オプション) 特定のデッキのカードのみを取得
- `page`: ページ番号
- `limit`: 1ページあたりの制限
- `sort`: ソート方法 (created_at, updated_at)
- `order`: ソート順序 (asc, desc)
- `tag`: (オプション) 特定のタグでフィルタリング

**レスポンス**

```json
{
  "total_count": 100,
  "page": 1,
  "limit": 20,
  "cards": [
    {
      "id": "card-id-1",
      "front": "質問1",
      "back": "回答1",
      // ... その他のフィールド
    },
    // ... カードリスト
  ]
}
```

### デッキの作成

```
POST /decks
```

**リクエスト**

```json
{
  "name": "デッキ名",
  "description": "デッキの説明",
  "tags": ["タグ1", "タグ2"],
  "is_public": false
}
```

**レスポンス**

```json
{
  "status": "success",
  "deck": {
    "id": "新しいデッキID",
    "name": "デッキ名",
    "description": "デッキの説明",
    "user_id": "ユーザーID",
    "created_at": "2025-03-27T09:35:51Z",
    "updated_at": "2025-03-27T09:35:51Z",
    "card_count": 0,
    "tags": ["タグ1", "タグ2"],
    "is_public": false
  }
}
```

### デッキの更新

```
PUT /decks/{deck_id}
```

**リクエスト**

```json
{
  "name": "更新されたデッキ名",
  "description": "更新された説明",
  "tags": ["タグ1", "新しいタグ"],
  "is_public": true
}
```

**レスポンス**

```json
{
  "status": "success",
  "deck": {
    "id": "deck-id",
    "name": "更新されたデッキ名",
    // ... その他の更新されたフィールド
  }
}
```

### デッキの削除

```
DELETE /decks/{deck_id}
```

**レスポンス**

```json
{
  "status": "success",
  "message": "デッキが削除されました"
}
```

## エラーコード

| コード | 説明 |
|--------|------|
| 400 | 無効なリクエスト |
| 401 | 認証エラー |
| 403 | 権限エラー |
| 404 | リソースが見つからない |
| 429 | レート制限超過 |
| 500 | サーバーエラー |

**エラーレスポンス例**

```json
{
  "status": "error",
  "code": 400,
  "message": "無効なURLが指定されました",
  "details": {
    "field": "youtube_url",
    "error": "有効なYouTube URLを指定してください"
  }
}
```

## AIエンジン

Memlyのフラッシュカード生成には以下のAIエンジンを使用しています：

- **Google Gemini 1.5 Pro**: 音声・画像認識、コンテンツ分析、フラッシュカード生成に使用
- **テキスト解析エンジン**: 複数言語対応、形態素解析、重要文抽出
- **知識グラフ生成**: コンテンツ間の関連性の分析と構造化

## レート制限

- 認証済みユーザー: 1時間あたり100リクエスト
- 無料プラン: 1日あたり50枚のフラッシュカード生成
- プレミアムプラン: 1日あたり無制限のフラッシュカード生成

## バージョニング

APIのバージョンはURLパスの一部として指定されます（/v1/）。将来的な変更はバージョン番号の更新を通じて管理され、下位互換性が保証されます。