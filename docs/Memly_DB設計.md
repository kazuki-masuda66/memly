# **全体像**

Memlyの機能は主に以下のドメインに分かれます:

1. **ユーザー管理**: 認証、個人設定、サブスクリプション、AIクレジット  
2. **学習データ管理**: デッキ、フラッシュカード、学習ログ、学習セッション  
3. **AI生成**: カード生成（一次テーブルと確定テーブル）、問題形式・補足情報  
4. **分析・アルゴリズム**: 忘却曲線予測、苦手度推定、間隔反復学習パラメータ  
5. **検索・集計**: フルテキスト検索、進捗集計、可視化用

---

# **1\. Supabase Authの考え方**

* **`auth.users`**

  * Supabaseが内部的に持つテーブルで、ユーザーのメールアドレスやパスワード、OAuthログインなどの認証情報を管理。  
  * ここに格納される**UUID**がユーザーを一意に識別するキー（`auth.users.id`）となる。  
* **`profiles`（アプリ独自の拡張）**

  * `auth.users.id` と**同じ値**を主キーとして保持し、表示名やアプリ固有のステータス、論理削除フラグなど「プロフィール情報」を記録。  
  * 他のテーブル（decks, flashcards, ...）でユーザーを参照する際は、`profiles.id`を参照する。  
  * こうすることで、**認証はSupabaseに委ねつつ**、アプリ固有の追加情報は`profiles`で一元管理できる。

---

# **2\. プロフィール管理**

## **2.1 `profiles` テーブル**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | UUID | ○ | `auth.users.id` と同じ値を使用。 ユーザーを一意に識別 | 主キー(PK)。`references auth.users(id)` の運用が推奨 |
| **display\_name** | VARCHAR | \- | アプリ上で表示するユーザー名 |  |
| **deleted\_flag** | BOOLEAN | \- | 退会・論理削除用のフラグ | default: false |
| **created\_at** | TIMESTAMP | ○ | レコード作成日時（アプリ上のプロフィール作成時刻） | （Supabase Authの登録時刻とは別に管理可） default: now() |
| **updated\_at** | TIMESTAMP | ○ | レコード更新日時 | default: now() |

### **説明**

* Supabase Authにより認証されたユーザー1人につき、`profiles` に1レコードを作る。  
* `id`カラムは\*\*`auth.users`のUUID\*\*と紐づけて、同値で保持。  
* `deleted_flag`や`display_name`などはアプリ固有の追加情報。  
* 今後、ユーザーの拡張プロフィールを増やす際にはこのテーブルにカラム追加 or サブテーブルを用いる。

---

## **2.2 `user_settings` テーブル**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **user\_id** | UUID | ○ | `profiles.id`への参照（1:1） | PKとして`user_id`を設定 |
| **theme** | VARCHAR | \- | UIテーマ（'light','dark'等） |  |
| **notification\_enabled** | BOOLEAN | \- | 学習リマインド通知のオン/オフ |  |
| **reminder\_time** | TIME | \- | 通知を送る時刻 |  |
| **forgetting\_curve\_param** | JSON | \- | 間隔反復学習のアルゴリズム設定 |  |
| **onboarding\_completed** | BOOLEAN | \- | 初回オンボーディング済か | default: false |
| **language** | VARCHAR | \- | UI表示言語（'ja','en'など） |  |
| **created\_at** | TIMESTAMP | ○ | レコード作成日時 |  |
| **updated\_at** | TIMESTAMP | ○ | レコード更新日時 |  |

### **説明**

* `profiles`と1:1で細かい設定を管理するテーブル。  
* 今回はSupabase Auth（ログイン情報）とは直接連携せず、アプリの設定だけ分けて保持する。

---

## **2.3 サブスクリプション・クレジット**

### **2.3.1 `plans` テーブル**

| カラム | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | SERIAL | ○ | プランID | PK |
| name | VARCHAR | ○ | 'Trial','Pro','Unlimited'など |  |
| monthly\_price | INT | \- | 月額料金 |  |
| yearly\_price | INT | \- | 年額料金 |  |
| ai\_credits\_per\_month | INT | \- | 月々付与のAIクレジット量 |  |
| max\_decks | INT | \- | (オプション)デッキ上限数 |  |
| max\_cards | INT | \- | (オプション)カード上限数 |  |
| revenuecat\_entitlement | VARCHAR | \- | RevenueCatでのentitlement名(例: com.memly.pro) | モバイル課金用に紐付けする場合 |
| created\_at | TIMESTAMP | ○ | 作成日時 | default: now() |
| updated\_at | TIMESTAMP | ○ | 更新日時 | default: now() |

### **説明**

* Web用プランだけでなく、モバイルアプリ用（RevenueCat entitlements）も１つの`plans`テーブルで管理可能  
* `revenuecat_entitlement`カラムがあることで、モバイル購読と紐づけできる

### **2.3.2 `user_subscriptions` テーブル**

| カラム | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | SERIAL | ○ | user\_subscriptionsテーブルの主キー | 新たにPKにする |
| user\_id | UUID | ○ | `profiles.id` | FK |
| plan\_id | INT | ○ | `plans.id` | FK |
| status | VARCHAR | \- | 'active','canceled','trialing'など |  |
| platform | VARCHAR | \- | 'stripe','revenuecat'… | Web/モバイルサブスクの区別 |
| external\_subscription\_id | VARCHAR | \- | StripeのsubscriptionId / RevenueCatのentitlementID等 |  |
| start\_date | TIMESTAMP | \- | サブスク開始日時 |  |
| end\_date | TIMESTAMP | \- | 終了日時 |  |
| next\_billing\_date | TIMESTAMP | \- | 次回請求日時 |  |
| created\_at | TIMESTAMP | ○ | 作成日時 | default: now() |
| updated\_at | TIMESTAMP | ○ | 更新日時 | default: now() |

### **運用メモ**

* ### Stripe購読の場合：

  * ### `platform='stripe'`

  * ### `external_subscription_id='sub_xxxx'` (StripeのSubscription ID)

* ### RevenueCat購読の場合：

  * ### `platform='revenuecat'`

  * ### `external_subscription_id='entitlement_xxx'` など

  * ### あるいはRevenueCatのAppUserIDを保存するケースもアリ

* ### 1ユーザーが複数サブスクを所持可能（PKが`id SERIAL`になったため）

### 

### **2.3.3 `user_credits` テーブル**

### 

| カラム | 型 | 必須 | 説明 | 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **user\_id** | UUID | ○ | `profiles.id` | PK |
| current\_credits | FLOAT | \- | AIクレジット残量 |  |
| updated\_at | TIMESTAMP | ○ | 更新日時 | default: now() |

### **説明**

* ### AIクレジットの残量管理を行う

* ### StripeやRevenueCatで追加クレジットを購入→サーバーがここを加算更新

### 

### ---

# **3\. 学習データ管理**

## **3.1 `decks` テーブル**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | SERIAL | ○ | デッキID | PK |
| **user\_id** | UUID | ○ | デッキ所有者（`profiles.id`） | FK |
| **title** | VARCHAR | ○ | デッキ名 |  |
| **status** | VARCHAR | \- | 'active','hidden','public','deleted' など | 非表示の場合は'hidden' |
| **created\_at** | TIMESTAMP | ○ | 作成日時 |  |
| **updated\_at** | TIMESTAMP | ○ | 更新日時 |  |

## **3.2 `flashcards` テーブル**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | SERIAL | ○ | カードID | PK |
| **deck\_id** | INT | ○ | 所属デッキ (`decks.id`) | FK |
| **user\_id** | UUID | ○ | カード作成者 (`profiles.id`) | FK |
| **question** | TEXT | ○ | 問題文（カード表面） |  |
| **answer** | TEXT | \- | 解答（カード裏面） |  |
| **explanation** | TEXT | \- | 補足情報・詳細解説 |  |
| **ai\_detail** | TEXT | \- | AI生成メタ情報（元テキストや使用プロンプトなど） |  |
| **source\_type** | VARCHAR | \- | 画像/音声/Website/YouTubeなどの種別 ('text','audio','image','pdf','website','youtube'等) |  |
| **source\_url** | TEXT | \- | ファイル/動画/サイトURLなど |  |
| **ai\_difficulty** | FLOAT | \- | AI推定難易度 (0\~1など) |  |
| **created\_at** | TIMESTAMP | ○ | 作成日時 |  |
| **updated\_at** | TIMESTAMP | ○ | 更新日時 |  |
| **deleted\_flag** | BOOLEAN | ○ | 論理削除フラグ | default: false |

### **説明**

* 問題形式（4択・正誤）はDBに永続化せず、都度AI生成。  
* 多様なソースを参照する場合、`source_type`＋`source_url` で実ファイルやURLを記録。

---

## **3.3 `study_sessions` テーブル**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | SERIAL | ○ | 学習セッションID | PK |
| **user\_id** | UUID | ○ | ユーザーID (`profiles.id`) | FK |
| **deck\_id** | INT | \- | 単一デッキの場合だけここに格納。複数デッキなら中間テーブルを導入。 | FK |
| **mode** | VARCHAR | \- | 学習モード（'one\_answer','multiple\_choice','true\_false'等） | 都度AI生成を行ってもログ用途で保存可 |
| **start\_time** | TIMESTAMP | \- | 学習開始日時 |  |
| **end\_time** | TIMESTAMP | \- | 学習完了日時 |  |
| **status** | VARCHAR | \- | 'in\_progress','completed','canceled'など |  |
| **created\_at** | TIMESTAMP | ○ | セッションレコード作成日時 |  |
| **updated\_at** | TIMESTAMP | ○ | セッションレコード更新日時 |  |

## **3.4 `study_logs` テーブル**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | SERIAL | ○ | ログID | PK |
| **session\_id** | INT | ○ | 学習セッション (`study_sessions.id`) | FK |
| **user\_id** | UUID | ○ | `profiles.id` | FK |
| **card\_id** | INT | ○ | `flashcards.id` | FK |
| **correct** | BOOLEAN | \- | 正解/不正解 |  |
| **answered\_at** | TIMESTAMP | \- | 回答時刻 |  |
| **answer\_text** | TEXT | \- | 記述式ならユーザーが入力した解答 |  |
| **time\_taken** | INT | \- | 回答にかかった秒数 |  |
| **created\_at** | TIMESTAMP | ○ | ログ作成日時 |  |
| **updated\_at** | TIMESTAMP | ○ | ログ更新日時 |  |

## **3.5 `user_streaks` (任意)**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **user\_id** | UUID | ○ | `profiles.id` (1:1対応) | PK |
| **streak\_count** | INT | \- | 連続学習日数 |  |
| **last\_study\_date** | DATE | \- | 最後に学習した日 |  |

---

# **4\. AI生成関連**

## **4.1 `temp_generated_cards` テーブル**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | SERIAL | ○ | 一時カードID | PK |
| **user\_id** | UUID | ○ | `profiles.id` | FK |
| **source\_session\_id** | VARCHAR | \- | 一度のファイルアップやURL解析による生成ジョブごとにまとめるID |  |
| **question** | TEXT | \- | AI生成の問題文 |  |
| **answer** | TEXT | \- | AI生成の答え |  |
| **explanation** | TEXT | \- | 補足解説 |  |
| **source\_type** | VARCHAR | \- | 'audio','image','pdf','website','youtube'などソース種別 |  |
| **source\_url** | TEXT | \- | ファイルURL、動画URL、サイトURL等 |  |
| **ai\_difficulty** | FLOAT | \- | AI推定難易度 |  |
| **status** | VARCHAR | \- | 'draft','edited','deleted'など | default: 'draft' |
| **created\_at** | TIMESTAMP | ○ | レコード作成日時 |  |
| **updated\_at** | TIMESTAMP | ○ | レコード更新日時 |  |

### **説明**

* 生成してプレビュー中のカードを仮置きするテーブル。  
* 確定後に`flashcards`へ保存し、本テーブルのレコードは削除または`status='confirmed'`にする。

---

# **5\. 分析・アルゴリズム関連**

## **5.1 `user_card_stats` テーブル**

| 項目 | 型 | 必須 | 説明 | 制約 / 備考 |
| ----- | ----- | ----- | ----- | ----- |
| **id** | SERIAL | ○ | PK（任意の連番） | PK |
| **user\_id** | UUID | ○ | `profiles.id` | FK |
| **card\_id** | INT | ○ | `flashcards.id` | FK |
| **correct\_count** | INT | \- | 正解回数 |  |
| **wrong\_count** | INT | \- | 不正解回数 |  |
| **last\_study\_time** | TIMESTAMP | \- | 最後に学習した時刻 |  |
| **due\_date** | TIMESTAMP | \- | 次回復習を推奨する日（間隔反復アルゴリズムで計算） |  |
| **difficulty** | FLOAT | \- | ユーザー固有の苦手度（0～1）。`flashcards.ai_difficulty`とは別物 |  |
| **updated\_at** | TIMESTAMP | \- | 更新日時 |  |

---

以下では、**PostgreSQL**上で運用することを想定した形で、Memlyアプリのデータベース設計に対応する**SQL文**を示します。  
 Supabase Auth が管理する `auth.users` テーブルに対しては、**`profiles.id` が `auth.users.id` と一致**する形で外部キー的な関連を持たせています（実際には Supabase では `auth` スキーマへの参照に一定の制約があるため、ご利用環境に合わせてスキーマ指定・RLS/ポリシー設定などを追加検討してください）。

本スクリプトはあくまでも**サンプル**です。実際の本番環境では**トリガーでの更新日時の自動設定**、**ON DELETE CASCADE の要否**、**NOT NULL制約**や**デフォルト値**、**インデックス**などを運用ポリシーに合わせて適宜修正してください。

---

## **1\. 前提**

* `auth.users` テーブル: Supabaseが内部的に保持するユーザー認証用テーブル（ここでは手動で生成しません）。  
* 下記スクリプトでは、各テーブルの`created_at`,`updated_at`はとりあえず手動入力する想定です。必要に応じて `DEFAULT now()` や `ON UPDATE`トリガーを設定してください。

## **2\. テーブル作成SQL**

### **2.1 profiles**

\-- Supabaseのauth.usersテーブルに存在するユーザーUUIDを参照している前提  
\-- 参照: https://supabase.com/docs/guides/auth  
CREATE TABLE IF NOT EXISTS profiles (  
  id UUID PRIMARY KEY   
    /\* 参考: 物理的に auth.users(id) をFK設定したい場合、下記のように書くことも  
       できますが、環境によってはスキーマ認証が必要です。  
       REFERENCES auth.users (id)  
    \*/,  
  display\_name VARCHAR,  
  deleted\_flag BOOLEAN NOT NULL DEFAULT FALSE,  
  created\_at   TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at   TIMESTAMP NOT NULL DEFAULT NOW()  
);

### **2.2 user\_settings**

CREATE TABLE IF NOT EXISTS user\_settings (  
  user\_id UUID PRIMARY KEY   
    REFERENCES profiles (id), \-- 1:1で紐づく  
  theme VARCHAR,  
  notification\_enabled BOOLEAN,  
  reminder\_time TIME,  
  forgetting\_curve\_param JSON,  
  onboarding\_completed BOOLEAN NOT NULL DEFAULT FALSE,  
  language VARCHAR,  
  created\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW()  
);

### **2.3 plans**

CREATE TABLE IF NOT EXISTS plans (  
  id SERIAL PRIMARY KEY,  
  name VARCHAR NOT NULL,  
  monthly\_price INT,  
  yearly\_price INT,  
  ai\_credits\_per\_month INT,  
  max\_decks INT,  
  max\_cards INT,  
  created\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW()  
);

### **2.4 user\_subscriptions**

CREATE TABLE IF NOT EXISTS user\_subscriptions (  
  user\_id UUID NOT NULL   
    REFERENCES profiles (id),  
  plan\_id INT NOT NULL   
    REFERENCES plans (id),  
  status VARCHAR,  
  start\_date TIMESTAMP,  
  end\_date TIMESTAMP,  
  next\_billing\_date TIMESTAMP,  
  created\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  PRIMARY KEY (user\_id)  
);

### **2.5 user\_credits**

CREATE TABLE IF NOT EXISTS user\_credits (  
  user\_id UUID PRIMARY KEY   
    REFERENCES profiles (id),  
  current\_credits FLOAT,  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW()  
);

### **2.6 decks**

CREATE TABLE IF NOT EXISTS decks (  
  id SERIAL PRIMARY KEY,  
  user\_id UUID NOT NULL   
    REFERENCES profiles (id),  
  title VARCHAR NOT NULL,  
  status VARCHAR,  \-- 'active','hidden','public','deleted' など  
  created\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW()  
);

### **2.7 flashcards**

CREATE TABLE IF NOT EXISTS flashcards (  
  id SERIAL PRIMARY KEY,  
  deck\_id INT NOT NULL   
    REFERENCES decks (id),  
  user\_id UUID NOT NULL   
    REFERENCES profiles (id),

  question TEXT NOT NULL,  
  answer TEXT,  
  explanation TEXT,  
  ai\_detail TEXT,

  source\_type VARCHAR,  \-- 'text','audio','image','pdf','website','youtube' etc  
  source\_url  TEXT,  
  ai\_difficulty FLOAT,

  created\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  deleted\_flag BOOLEAN NOT NULL DEFAULT FALSE  
);

### **2.8 study\_sessions**

CREATE TABLE IF NOT EXISTS study\_sessions (  
  id SERIAL PRIMARY KEY,  
  user\_id UUID NOT NULL   
    REFERENCES profiles (id),  
  deck\_id INT   
    REFERENCES decks (id),  \-- 単一デッキの場合のみ

  mode VARCHAR,  \-- 'one\_answer','multiple\_choice','true\_false' etc  
  start\_time TIMESTAMP,  
  end\_time TIMESTAMP,  
  status VARCHAR,

  created\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW()  
);

### **2.9 study\_logs**

CREATE TABLE IF NOT EXISTS study\_logs (  
  id SERIAL PRIMARY KEY,  
  session\_id INT NOT NULL   
    REFERENCES study\_sessions (id),  
  user\_id UUID NOT NULL   
    REFERENCES profiles (id),  
  card\_id INT NOT NULL  
    REFERENCES flashcards (id),

  correct BOOLEAN,  
  answered\_at TIMESTAMP,  
  answer\_text TEXT,  
  time\_taken INT,

  created\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW()  
);

### **2.10 user\_streaks (オプション)**

CREATE TABLE IF NOT EXISTS user\_streaks (  
  user\_id UUID PRIMARY KEY   
    REFERENCES profiles (id),  
  streak\_count INT,  
  last\_study\_date DATE  
);

### **2.11 temp\_generated\_cards**

CREATE TABLE IF NOT EXISTS temp\_generated\_cards (  
  id SERIAL PRIMARY KEY,  
  user\_id UUID NOT NULL   
    REFERENCES profiles (id),

  source\_session\_id VARCHAR,  
  question TEXT,  
  answer TEXT,  
  explanation TEXT,  
  source\_type VARCHAR,  
  source\_url TEXT,  
  ai\_difficulty FLOAT,  
  status VARCHAR DEFAULT 'draft',

  created\_at TIMESTAMP NOT NULL DEFAULT NOW(),  
  updated\_at TIMESTAMP NOT NULL DEFAULT NOW()  
);

### **2.12 user\_card\_stats**

CREATE TABLE IF NOT EXISTS user\_card\_stats (  
  id SERIAL PRIMARY KEY,  
  user\_id UUID NOT NULL   
    REFERENCES profiles (id),  
  card\_id INT NOT NULL   
    REFERENCES flashcards (id),

  correct\_count INT DEFAULT 0,  
  wrong\_count INT DEFAULT 0,  
  last\_study\_time TIMESTAMP,  
  due\_date TIMESTAMP,        \-- 間隔反復で次回復習推奨日  
  difficulty FLOAT,          \-- ユーザー固有の苦手度(0\~1)

  updated\_at TIMESTAMP NOT NULL DEFAULT NOW()  
);

---

## **3\. 運用上のポイント**

1. **Supabase AuthとのFK参照**

   * `profiles.id` が `auth.users.id` と一致するように運用するのが基本方針です。  
   * PostgreSQLの構文上、`REFERENCES auth.users (id)` を直接設定できる場合もありますが、**権限やスキーマ設定**が必要になります。多くの場合、`profiles`テーブルで`PRIMARY KEY(id)`を設定し、それをアプリ内で統一的に参照する運用に落ち着きます。  
2. **created\_at, updated\_at**

   * サンプルでは `DEFAULT NOW()` を指定しており、更新時は手動で `updated_at` を更新する必要があります。トリガーで自動更新させる、あるいはアプリケーションコードで更新するなどの運用を検討してください。  
3. **外部キー制約の ON DELETE, ON UPDATE**

   * 必要に応じて `ON DELETE CASCADE` や `ON DELETE SET NULL` を付与し、子テーブルとの整合性を保つ運用ができます。現状のサンプルでは省略しています。  
4. **インデックス設計**

   * 大量アクセスが見込まれるカラム（例えば `study_logs(user_id,card_id)` など）には追加のインデックスを張ると検索・集計が高速化します。  
5. **RLS / セキュリティポリシー**

   * Supabaseの行レベルセキュリティ (RLS) を活用する場合は、各テーブルごとにポリシーを定義し、ユーザーが自身のデータのみ操作できるよう設定してください。  
6. **スキーマ名**

   * 必要に応じて`public`スキーマ以外を使う場合、`CREATE SCHEMA memly; ... CREATE TABLE memly.profiles(...);` のようにスキーマを付与して定義することを検討してください。

---

以上が、**Supabase Authを用いたDB設計**に対応する**サンプルSQL作成スクリプト**です。  
 実運用での細部（デフォルト値、制約、RLS設定、スキーマ名など）は、開発・本番環境の要件に合わせて調整してください。

