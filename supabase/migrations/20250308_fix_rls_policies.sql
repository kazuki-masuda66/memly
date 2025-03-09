-- 既存のRLSポリシーを削除
DROP POLICY IF EXISTS "デッキは所有者のみアクセス可能" ON decks;
DROP POLICY IF EXISTS "フラッシュカードは所有者のみアクセス可能" ON flashcards;
DROP POLICY IF EXISTS "サービスロールは全てのデッキにアクセス可能" ON decks;
DROP POLICY IF EXISTS "サービスロールは全てのフラッシュカードにアクセス可能" ON flashcards;

-- 既存のポリシーを削除（もし存在する場合）
DROP POLICY IF EXISTS "Users can view their own decks" ON decks;
DROP POLICY IF EXISTS "Users can insert their own decks" ON decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON decks;
DROP POLICY IF EXISTS "Users can view their own flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can update their own flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON flashcards;

-- テーブルのRLSを有効化
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

-- デッキテーブルのRLSポリシー
-- 1. 所有者は自分のデッキを全て操作可能
CREATE POLICY "デッキは所有者のみアクセス可能"
ON decks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. サービスロールは全てのデッキにアクセス可能
CREATE POLICY "サービスロールは全てのデッキにアクセス可能"
ON decks
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- フラッシュカードテーブルのRLSポリシー
-- 1. 所有者は自分のフラッシュカードを全て操作可能（デッキIDを通じて）
CREATE POLICY "フラッシュカードは所有者のみアクセス可能"
ON flashcards
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM decks
    WHERE decks.id = flashcards.deck_id
    AND decks.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM decks
    WHERE decks.id = flashcards.deck_id
    AND decks.user_id = auth.uid()
  )
);

-- 2. サービスロールは全てのフラッシュカードにアクセス可能
CREATE POLICY "サービスロールは全てのフラッシュカードにアクセス可能"
ON flashcards
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 匿名ユーザーのアクセスを制限
ALTER TABLE decks FORCE ROW LEVEL SECURITY;
ALTER TABLE flashcards FORCE ROW LEVEL SECURITY;

-- デバッグ用のビューを作成（オプション）
CREATE OR REPLACE VIEW user_permissions AS
SELECT 
  auth.uid() as current_user_id,
  d.id as deck_id,
  d.title as deck_name,
  d.user_id as deck_owner_id,
  auth.uid() = d.user_id as is_owner,
  COUNT(f.id) as flashcard_count
FROM decks d
LEFT JOIN flashcards f ON d.id = f.deck_id
GROUP BY d.id, d.title, d.user_id;

-- 現在の認証情報を確認するための関数
CREATE OR REPLACE FUNCTION get_auth_info()
RETURNS TABLE (
  role TEXT,
  uid UUID,
  email TEXT,
  is_authenticated BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.role()::TEXT,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    auth.role() = 'authenticated'::TEXT;
END;
$$;
