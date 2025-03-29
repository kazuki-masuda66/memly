# Memly 学習モード API 設計書

## 概要

Memlyの学習機能は、フラッシュカードを使った効果的な記憶定着を実現するためのシステムです。本ドキュメントでは、学習モード（一問一答、クイズ、○×問題）に関連するAPIエンドポイント、問題生成ロジック、およびデータモデルについて詳細に解説します。

## 基本情報

- **ベースURL**: `https://api.memly.ai/v1`
- **認証方式**: JWTトークン（Authorization: Bearer）
- **レスポンス形式**: JSON
- **エラーハンドリング**: HTTP ステータスコードとエラーメッセージを含むJSONレスポンス

## データモデル

### Flashcard

フラッシュカードの基本データ構造（学習用の拡張フィールドを含む）

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
  last_reviewed?: string;   // 最後に復習した日時
  difficulty?: number;      // 難易度 (1-5のスケール)
  next_review?: string;     // 次回復習予定日
  review_count?: number;    // 復習回数
  success_count?: number;   // 正解回数
  failure_count?: number;   // 不正解回数
}
```

### StudySession

学習セッションの記録

```typescript
interface StudySession {
  id: string;               // セッションの一意識別子
  user_id: string;          // ユーザーID
  deck_id: string;          // デッキID
  start_time: string;       // 開始時間
  end_time?: string;        // 終了時間
  cards_studied: number;    // 学習済みカード数
  correct_answers: number;  // 正解数
  incorrect_answers: number;// 不正解数
  mode: string;             // 学習モード (flashcard, quiz, truefalse)
  duration_seconds?: number;// 学習時間（秒）
}
```

### QuizChoice

クイズの選択肢

```typescript
interface QuizChoice {
  id: string;               // 選択肢ID
  text: string;             // 選択肢のテキスト
  isCorrect: boolean;       // 正解かどうか
  card_id: string;          // 関連するカードID
}
```

### TrueFalseQuestion

○×問題

```typescript
interface TrueFalseQuestion {
  statement: string;        // 問題文
  isTrue: boolean;          // 正しいかどうか
  explanation?: string;     // 解説
  cardId: string;           // 元カードID
}
```

## 学習モードの種類

Memlyでは以下の3つの学習モードを提供しています：

1. **一問一答モード（flashcard）**
   - 表面に質問、裏面に回答を表示する従来のフラッシュカード形式
   - 自己評価による難易度設定が可能

2. **クイズモード（quiz）**
   - 表面のカードに対して4つの選択肢から正解を選ぶ形式
   - AIが不正解の選択肢を自動生成

3. **○×問題モード（truefalse）**
   - カードの内容に基づいた○（正しい）か×（誤り）かを判定する問題
   - AIが問題文を自動生成し、誤った記述も作成

## 学習アルゴリズム

### スペーシング・リピティション

Memlyは最適な記憶定着を実現するため、以下のアルゴリズムを実装しています：

1. **難易度に基づく間隔調整**
   - ユーザーの自己評価（1-5段階）に基づいて次回表示間隔を計算
   - 難易度が高いカードは短い間隔で繰り返し表示

2. **学習履歴の追跡**
   - カードごとの正解・不正解履歴を記録
   - 間違えやすいカードを優先的に表示

3. **最適化アルゴリズム**
   - 新規カードと復習カードの最適なバランスを維持
   - ユーザーの学習パターンに適応

## APIエンドポイント

### 学習セッション管理

#### 学習セッションの開始

```
POST /study/session/start
```

**リクエスト**

```json
{
  "deck_id": "deck-id",
  "mode": "flashcard",  // flashcard, quiz, truefalse
  "card_limit": 20,     // 学習するカード数の上限
  "shuffle": true,      // カードをシャッフルするかどうか
  "prioritize_due": true // 復習期限が来たカードを優先するかどうか
}
```

**内部処理フロー**

1. デッキIDから対象カードを取得
2. モードに応じてカードを事前処理（復習期限、難易度等を考慮）
3. シャッフルオプションが有効ならカードをランダム化
4. セッション情報をデータベースに記録
5. クライアントに必要なカード情報を返却

**レスポンス**

```json
{
  "status": "success",
  "session": {
    "id": "session-id",
    "user_id": "user-id",
    "deck_id": "deck-id",
    "start_time": "2025-03-27T09:40:51Z",
    "mode": "flashcard",
    "cards": [
      {
        "id": "card-id-1",
        "front": "質問1",
        "back": "回答1",
        "front_rich": "<p>質問1</p>",
        "back_rich": "<p>回答1</p>",
        "last_reviewed": "2025-03-20T15:30:00Z",
        "difficulty": 3
      },
      // ... セッションに含まれるカード
    ]
  }
}
```

#### 学習セッションの取得

```
GET /study/session/{session_id}
```

**レスポンス**

```json
{
  "status": "success",
  "session": {
    "id": "session-id",
    "user_id": "user-id",
    "deck_id": "deck-id",
    "start_time": "2025-03-27T09:40:51Z",
    "end_time": null,
    "cards_studied": 5,
    "correct_answers": 4,
    "incorrect_answers": 1,
    "mode": "flashcard",
    "duration_seconds": 180
  }
}
```

#### カード学習結果の記録

```
POST /study/card/{card_id}/result
```

**リクエスト**

```json
{
  "session_id": "session-id",
  "result": "correct", // correct, incorrect, hard, easy
  "time_spent": 15     // 回答にかかった時間（秒）
}
```

**内部処理フロー**

1. カードの学習履歴を更新
2. カードの難易度を調整
3. 次回復習日を計算
4. セッションの成績を更新

**レスポンス**

```json
{
  "status": "success",
  "updated_card": {
    "id": "card-id",
    "last_reviewed": "2025-03-27T09:45:51Z",
    "next_review": "2025-03-29T09:45:51Z",
    "difficulty": 2,
    "review_count": 5
  }
}
```

#### 学習セッションの終了

```
POST /study/session/{session_id}/end
```

**リクエスト**

```json
{
  "correct_answers": 15,
  "incorrect_answers": 5,
  "cards_studied": 20
}
```

**内部処理フロー**

1. セッション情報の更新（終了時間、総数）
2. 学習統計の計算（正答率、平均時間など）
3. ユーザーの累積学習データの更新

**レスポンス**

```json
{
  "status": "success",
  "session": {
    "id": "session-id",
    "user_id": "user-id",
    "deck_id": "deck-id",
    "start_time": "2025-03-27T09:40:51Z",
    "end_time": "2025-03-27T10:10:51Z",
    "cards_studied": 20,
    "correct_answers": 15,
    "incorrect_answers": 5,
    "mode": "flashcard"
  },
  "statistics": {
    "accuracy": 75,
    "time_spent": 1800,         // 秒数
    "avg_time_per_card": 90,    // 秒数
    "session_streak": 5,        // 連続セッション数
    "daily_goal_progress": 80   // 日次目標達成率（%）
  }
}
```

### クイズモード関連

#### クイズの選択肢生成

```
POST /study/card/choices
```

**リクエスト**

```json
{
  "card_id": "card-id",
  "count": 4,  // 生成する選択肢の数
  "language": "ja"
}
```

**内部処理フロー**

1. 対象カードの内容（特に回答部分）を解析
2. AIエンジン（Google Gemini 1.5 Pro）を使用して妥当な不正解選択肢を生成
   - 回答と似た内容だが微妙に異なる選択肢
   - 完全に異なる間違った選択肢
   - 紛らわしい選択肢
3. 選択肢をシャッフル
4. 各選択肢にIDを付与して返却

**レスポンス**

```json
{
  "status": "success",
  "choices": [
    {
      "id": "choice-id-1",
      "text": "選択肢1（正解）",
      "isCorrect": true
    },
    {
      "id": "choice-id-2",
      "text": "選択肢2",
      "isCorrect": false
    },
    {
      "id": "choice-id-3",
      "text": "選択肢3",
      "isCorrect": false
    },
    {
      "id": "choice-id-4",
      "text": "選択肢4",
      "isCorrect": false
    }
  ]
}
```

#### 選択肢の一括生成

```
POST /study/card/choices/batch
```

**リクエスト**

```json
{
  "cards": [
    {
      "id": "card-id-1",
      "front": "質問1",
      "back": "回答1"
    },
    {
      "id": "card-id-2",
      "front": "質問2",
      "back": "回答2"
    }
  ],
  "count_per_card": 4,  // 各カードあたりの選択肢数
  "language": "ja"
}
```

**レスポンス**

```json
{
  "status": "success",
  "choicesMap": {
    "card-id-1": [
      {
        "id": "choice-id-1",
        "text": "回答1",
        "isCorrect": true
      },
      // ... 他の選択肢
    ],
    "card-id-2": [
      // ... カード2の選択肢
    ]
  }
}
```

### 正誤問題モード関連

#### 正誤問題の生成

```
POST /study/card/truefalse
```

**リクエスト**

```json
{
  "card_id": "card-id",
  "count": 2,     // 生成する問題数
  "language": "ja"
}
```

**内部処理フロー**

1. カードの内容（表面と裏面）を解析
2. AIエンジン（Google Gemini 1.5 Pro）を使用して以下を生成:
   - カードの内容に基づいた正しい記述（isTrue = true）
   - 意図的に誤った情報を含む記述（isTrue = false）
3. 各問題に解説を追加（なぜ正しいか/誤っているか）
4. 問題をランダムに並び替え

**レスポンス**

```json
{
  "status": "success",
  "questions": [
    {
      "statement": "正しい文または間違った文1",
      "isTrue": true,
      "explanation": "この文が正しい理由の説明"
    },
    {
      "statement": "正しい文または間違った文2",
      "isTrue": false,
      "explanation": "この文が間違っている理由の説明"
    }
  ]
}
```

#### 正誤問題の一括生成

```
POST /study/card/truefalse/batch
```

**リクエスト**

```json
{
  "cards": [
    {
      "id": "card-id-1",
      "front": "質問1",
      "back": "回答1",
      "front_rich": "<p>質問1</p>",
      "back_rich": "<p>回答1</p>"
    },
    // ... 正誤問題を生成したいカード
  ],
  "count_per_card": 2,  // 1枚のカードあたりの問題数
  "language": "ja"
}
```

**内部処理フロー**

1. 各カードに対して並行処理で問題を生成
2. AIプロンプトの最適化（正確な問題文生成のため）
3. 問題の多様性確保（TrueとFalseのバランス調整）
4. 重複排除と問題の品質チェック

**レスポンス**

```json
{
  "status": "success",
  "trueFalseMap": {
    "card-id-1": [
      {
        "statement": "正しい文または間違った文1",
        "isTrue": true,
        "explanation": "この文が正しい理由の説明"
      },
      {
        "statement": "正しい文または間違った文2",
        "isTrue": false,
        "explanation": "この文が間違っている理由の説明"
      }
    ],
    // ... 他のカードの正誤問題
  }
}
```

### 学習統計と分析

#### 学習進捗の取得

```
GET /study/progress/{deck_id}
```

**レスポンス**

```json
{
  "status": "success",
  "progress": {
    "total_cards": 100,
    "mastered_cards": 45,
    "learning_cards": 30,
    "new_cards": 25,
    "due_today": 20,
    "accuracy": 75,
    "average_difficulty": 2.3,
    "study_streak": 7,
    "last_studied": "2025-03-26T18:35:00Z"
  }
}
```

#### 復習予定の取得

```
GET /study/review/due
```

**クエリパラメータ**

- `user_id`: ユーザーID
- `days`: 何日先までの予定を取得するか（デフォルト7）

**レスポンス**

```json
{
  "status": "success",
  "due_cards": {
    "2025-03-27": 15,  // 今日
    "2025-03-28": 8,   // 明日
    "2025-03-29": 12,
    // ... 他の日付
  },
  "decks": [
    {
      "id": "deck-id-1",
      "name": "英単語",
      "due_cards": 8
    },
    // ... 他のデッキ
  ]
}
```

## AIを使った問題生成ロジック

### 選択肢生成の詳細

選択肢生成では以下のアプローチで高品質な選択肢を実現しています：

1. **コンテキスト理解**
   - カードの表面（質問）と裏面（回答）の関係性を分析
   - 同じデッキ内の他のカードの内容も参照して関連性の高い不正解選択肢を生成

2. **難易度調整**
   - ユーザーの学習レベルに応じた選択肢の難易度を調整
   - 初心者には明確に異なる選択肢、上級者には紛らわしい選択肢を提供

3. **言語最適化**
   - カードの言語に合わせた自然な選択肢を生成
   - 専門用語や特定分野の知識を反映

### 正誤問題生成の詳細

正誤問題生成では以下の手法を採用しています：

1. **事実抽出と変形**
   - カードから重要な事実や概念を抽出
   - 誤った問題を作る際は微妙に内容を変更（数値の変更、否定の追加など）

2. **多様な問題パターン**
   - 単純な事実確認
   - 関係性の理解を問う問題
   - 応用的な考え方を問う問題

3. **解説の自動生成**
   - なぜ正しいのか/誤っているのかの理由を明確に説明
   - 元のカード内容と関連づけた解説の提供

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
  "message": "有効なカードIDを指定してください",
  "details": {
    "field": "card_id",
    "error": "指定されたカードIDが存在しません"
  }
}
```

## AIエンジン

Memlyの学習機能では以下のAIエンジンを使用しています：

- **Google Gemini 1.5 Pro**: 選択肢生成、正誤問題生成に使用
- **スペーシング最適化アルゴリズム**: 学習効率を最大化するための復習タイミング計算
- **パーソナライズエンジン**: ユーザーの学習パターンに合わせて問題の難易度や表示頻度を調整

## 学習データの活用

収集された学習データは以下の目的で活用されています：

1. **個人の学習最適化**
   - 復習間隔の個人別調整
   - 苦手分野の特定と集中学習の提案

2. **コンテンツ改善**
   - 多くのユーザーが間違えるカードの特定と改善
   - 効果的な学習カードのパターン分析

3. **新機能開発**
   - 学習効果の高いインタラクションの特定
   - 新しい学習モードの検証と導入

## API利用制限

- 認証済みユーザー: 1時間あたり200リクエスト
- 無料プラン: 1日あたり100問の問題生成
- プレミアムプラン: 1日あたり無制限の問題生成

## バージョニング

APIのバージョンはURLパスの一部として指定されます（/v1/）。将来的な変更はバージョン番号の更新を通じて管理され、下位互換性が保証されます。
