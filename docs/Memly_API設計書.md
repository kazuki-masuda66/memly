# **1\. 前提**

* バックエンド: **Vercel Edge Functions**  
* データベース: **Supabase**  
* 認証: **Supabase Auth** （ユーザーIDは `auth.users.id` → `profiles.id`）  
* 決済: **Stripe**（Web）、**RevenueCat**（モバイル）  
* AI生成: **Vercel AI SDK**をEdge Functionsで使用

このAPI設計書では、**REST形式**を中心に各エンドポイントのHTTPメソッド、パス、リクエスト/レスポンス例などを示します。

---

# **2\. 認証 / ユーザー関連**

Memlyでは**Supabase Auth**を使用し、フロントからのリクエストに**JWT**（アクセストークン）を付与してEdge Functionsが認証・認可を行います。  
 ここでは**ラッパーAPI**として最低限のもののみ記載。実際には、フロント（Next.js / React Native）で直接Supabase Authを呼ぶパターンもあります。

## **2.1 ログイン / サインアップ**

| メソッド | パス | 概要 | リクエスト例 | レスポンス例 |
| ----- | ----- | ----- | ----- | ----- |
| POST | /api/login | メールパスワードでログイン（必要ならAuthラッパ） | `{ "email":"user@example.com", ... }` | 成功: `200 OK` \+ `{ token: "...", ... }`失敗: `401` 等 |
| POST | /api/signup | 新規ユーザー作成（同上、Authラッパ） | `{ "email":"new@example.com", ...}` | 同様 |
| GET | /api/logout | ログアウト処理（セッション破棄など） | (ヘッダに認証トークン) | 成功: `200 OK` |

※ 実装によってはSupabase公式のClient SDKを直接呼び出し、Edge Functionsにこれらは不要になる場合があります。

---

## **2.2 プロフィール**

| メソッド | パス | 概要 | リクエスト例 | レスポンス例 |
| ----- | ----- | ----- | ----- | ----- |
| GET | /api/profile | ログイン中ユーザーの**profiles** \+ **user\_settings**を取得 | `GET /api/profile` (ヘッダに`Authorization: Bearer <token>`) | `{ "id":"UUID", "display_name":"...", "settings": { ...} }` |
| PATCH | /api/profile | プロフィール情報・設定の更新 | Body例: `{ "display_name": "Alice", "settings":{ "theme":"dark"...}}` | 成功: `200 OK` \+ 更新後のプロフィール失敗: `403` / `400`など |

---

# **3\. サブスクリプション・決済関連**

## **3.1 プラン取得**

| メソッド | パス | 概要 | リクエスト例 | レスポンス例 |
| ----- | ----- | ----- | ----- | ----- |
| GET | /api/plans | プラン一覧を取得（Pro,Unlimitedなど） | `GET /api/plans` | `[ { "id":1, "name":"Pro", "monthly_price":1000, "revenuecat_entitlement":...}, ...]` |

---

## **3.2 Stripeサブスク（Web）**

### **3.2.1 `POST /api/subscribe` (Web)**

POST /api/subscribe  
Content-Type: application/json  
Authorization: Bearer \<token\>

{  
  "planId": 2  
}

**機能**

* ユーザーがWebからサブスク購入ボタンを押下 → Edge Functionが**Stripe Checkout**を作成  
* レスポンスに`checkoutUrl`を返し、フロントがリダイレクト

**レスポンス例**

{  
  "checkoutUrl": "https://checkout.stripe.com/c/pay\_xxx",  
  "expiresAt": "2025-03-10T10:00:00Z"  
}

---

### **3.2.2 `POST /api/stripeWebhook`**

POST /api/stripeWebhook  
Content-Type: application/json  
Signature: \<stripe-signature\>

**機能**

* Stripeが`checkout.session.completed`などのイベントをWebhookで送る  
* Edge Functionで署名検証し、**user\_subscriptions**を更新

**リクエスト例 (Stripe標準)**

{  
  "id": "evt\_1xyz",  
  "type": "checkout.session.completed",  
  "data": {  
    "object": {  
      "id":"cs\_test\_abc",  
      "metadata": { "userId":"\<MemlyUserID\>" },  
      ...  
    }  
  }  
}

**レスポンス例**

* 常に`200 OK`を返す (署名NGの場合は`400`や`401`)  
* Edge Functionは  
  * `platform='stripe'`  
  * `external_subscription_id='sub_xyz'`  
  * `status='active'`  
  * DBにINSERT/UPDATE

---

## **3.3 RevenueCatサブスク（モバイル）**

### **3.3.1 モバイル側SDK**

* アプリ内では`RevenueCat SDK`を用いて Apple/Google IAPを実施  
* Edge Functionに特別な呼び出しは必須ではないが、ユーザーが購読状態を問い合わせる場合は\*\*`GET /api/subscriptionStatus`\*\*などを用意しても良い

### **3.3.2 RevenueCat Webhook (オプション)**

POST /api/revenuecatWebhook  
Content-Type: application/json  
Authorization: \<some key\>  // 事前共有シークレット

{  
  "event": "SUBSCRIPTION\_PURCHASED",  
  "userId": "\<MemlyUserID\>",  
  "entitlementId": "com.memly.pro",  
  ...  
}

**機能**

* RevenueCatが購読開始/終了などを通知  
* Edge Functionで `platform='revenuecat'`, `external_subscription_id='entitlement_???'` などを**user\_subscriptions**に更新

---

## **3.4 Subscriptions参照**

### **3.4.1 `GET /api/subscriptions`**

GET /api/subscriptions  
Authorization: Bearer \<token\>

* ログイン中ユーザーのサブスク一覧を返す（1ユーザーが複数レコードを持ち得る）  
   **レスポンス例**:

\[  
  {  
    "id": 101,  
    "plan\_id": 2,  
    "status": "active",  
    "platform": "stripe",  
    "external\_subscription\_id": "sub\_123",  
    "start\_date": "2025-01-01T00:00:00Z",  
    "end\_date": null,  
    "next\_billing\_date": "2025-02-01T00:00:00Z"  
  },  
  {  
    "id": 102,  
    "plan\_id": 3,  
    "status": "active",  
    "platform": "revenuecat",  
    "external\_subscription\_id": "entitlement\_pro",  
    "start\_date": "2025-01-05T00:00:00Z",  
    ...  
  }  
\]

---

# **4\. ユーザーのAIクレジット管理**

## **4.1 `GET /api/credits`**

GET /api/credits  
Authorization: Bearer \<token\>

* **user\_credits**テーブルから現在のAIクレジットを取得  
   **レスポンス例**:

{  
  "userId": "UUID",  
  "current\_credits": 150.0  
}

## **4.2 `POST /api/credits/purchase` (例)**

* ユーザーがクレジットをStripe or RevenueCatで購入 → Webhook受信後に加算  
* 直接購入ボタンを用意する場合は**Stripe Checkout** か **RevenueCat** entitlements で紐づけ

---

# **5\. 学習系エンドポイント**

## **5.1 デッキ操作**

| メソッド | パス | 概要 |
| ----- | ----- | ----- |
| GET | /api/decks | ユーザーのデッキ一覧を取得 |
| POST | /api/decks | 新規デッキ作成 |
| GET | /api/decks/:id | 特定デッキ詳細 (必要に応じcardsも取得) |
| PATCH | /api/decks/:id | デッキタイトルやstatusの変更 |
| DELETE | /api/decks/:id | デッキ論理削除や実削除 |

**例: GET /api/decks**:

GET /api/decks  
Authorization: Bearer \<token\>

**レスポンス**:

\[  
  { "id": 11, "title": "英単語", "status": "active", ... },  
  { "id": 12, "title": "物理 基礎", "status": "hidden", ... }  
\]

---

## **5.2 カード操作**

| メソッド | パス | 概要 |
| ----- | ----- | ----- |
| GET | /api/flashcards/:id | カード詳細取得 |
| PATCH | /api/flashcards/:id | カード更新（question,answer等） |
| DELETE | /api/flashcards/:id | カード削除(`deleted_flag=true`) |

---

## **5.3 学習セッション / ログ**

| メソッド | パス | 概要 |
| ----- | ----- | ----- |
| POST | /api/startSession | 学習セッション開始 → `study_sessions`にINSERT |
| POST | /api/submitAnswer | 1問回答を記録 → `study_logs`にINSERT, user\_card\_statsを更新（任意） |
| POST | /api/endSession | 学習セッション完了 |

---

# **6\. AI生成 (Vercel AI SDK)**

## **6.1 `POST /api/generateCards`**

POST /api/generateCards  
Content-Type: application/json  
Authorization: Bearer \<token\>

{  
  "sourceType": "pdf",      
  "sourceUrl": "https://...pdf",  
  "textContent": "",        
  "settings": {  
    "questionCount": 10,  
    "difficulty": "normal",  
    "language": "ja"  
  }  
}

* Edge Functionで**Vercel AI SDK**を用い、LLMにプロンプト送信→自動生成  
* 結果を`temp_generated_cards`にINSERT

**レスポンス例**:

{  
  "sourceSessionId": "abc123",  
  "tempCards": \[  
    {  
      "id": 201,  
      "question": "...",  
      "answer": "...",  
      "explanation": "...",  
      "ai\_difficulty": 0.7,  
      "status": "draft"  
    },  
    ...  
  \]  
}

## **6.2 `POST /api/confirmCards`**

POST /api/confirmCards  
Content-Type: application/json  
Authorization: Bearer \<token\>

{  
  "sourceSessionId": "abc123",  
  "deckId": 10,  
  "cardIds": \[201, 202, 205\]  
}

* 選択した`temp_generated_cards`を`flashcards`へ確定登録  
* 不要分は削除 or `status='deleted'`

---

# **7\. 検索 / ダッシュボード**

## **7.1 `/api/search`**

GET /api/search?keyword=円運動\&deckId=1\&status=unlearned  
Authorization: Bearer \<token\>

* フルテキスト検索等を行い、デッキ/カードを返す

---

# **8\. 非機能・Webhook**

## **8.1 RevenueCat Webhook (オプション)**

POST /api/revenuecatWebhook  
Content-Type: application/json  
Authorization: \<RevenueCat-Secret\>

{  
  "event": "SUBSCRIPTION\_PURCHASED",  
  "userId": "UUID or AnotherKey",  
  "entitlementId": "com.memly.pro",  
  ...  
}

* Edge Functionが検証→ `user_subscriptions`に `platform='revenuecat'`, `external_subscription_id='entitlementId'`, `status='active'`などを更新

## **8.2 エラー・ステータスコード**

* 2xx: 正常  
* 4xx: 不正リクエスト、認証失敗、権限不足  
* 5xx: サーバ内部エラー

---

# **9\. まとめ**

本API設計書では、**Web/モバイル**両方からの決済フロー（Stripe/RevenueCat）や、**Vercel AI SDK**でのカード生成などを取り込んだ形で、MemlyのRESTfulエンドポイントを定義しました。  
 大まかなポイント:

1. **サブスクリプション**

   * `POST /api/subscribe` (Stripe)  
   * `POST /api/stripeWebhook`  
   * `POST /api/revenuecatWebhook`(任意)  
   * DB: `user_subscriptions.platform='stripe'|'revenuecat'`, `external_subscription_id`管理  
2. **AI生成**

   * `POST /api/generateCards` → `temp_generated_cards`に保存 → 確定時 `/api/confirmCards`→ `flashcards`へ  
3. **学習機能**

   * `/api/startSession`, `/api/submitAnswer`, `/api/endSession`, etc.  
4. **i18n対応**

   * Next.jsはパスにlocale、Edge Functions自体はlocale不要  
   * モバイルはアプリ内で多言語を切り替え

この構成により、Web（Stripe）とモバイル（RevenueCat）の課金を**統一DB**に反映し、**サーバレスAPI**でAI処理を提供、**Supabase**で安全かつスケーラブルなデータ管理を行うことが可能です。

