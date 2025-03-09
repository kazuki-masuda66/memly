-- Supabaseのテーブル認証を一時的に無効化するSQL

-- RLSを無効化（全てのテーブルに対する認証チェックを無効化）
ALTER TABLE decks DISABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards DISABLE ROW LEVEL SECURITY;

-- 既存のRLSポリシーを削除
DROP POLICY IF EXISTS "デッキは所有者のみアクセス可能" ON decks;
DROP POLICY IF EXISTS "フラッシュカードは所有者のみアクセス可能" ON flashcards;
DROP POLICY IF EXISTS "サービスロールは全てのデッキにアクセス可能" ON decks;
DROP POLICY IF EXISTS "サービスロールは全てのフラッシュカードにアクセス可能" ON flashcards;
DROP POLICY IF EXISTS "Users can view their own decks" ON decks;
DROP POLICY IF EXISTS "Users can insert their own decks" ON decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON decks;
DROP POLICY IF EXISTS "Users can view their own flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can insert their own flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can update their own flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can delete their own flashcards" ON flashcards;

-- 匿名ユーザーにも書き込み権限を付与
GRANT ALL ON decks TO anon;
GRANT ALL ON flashcards TO anon;

-- シーケンスの存在を確認してから権限を付与
DO $$
BEGIN
    -- decks_id_seqの存在確認と権限付与
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'decks_id_seq') THEN
        EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE decks_id_seq TO anon';
    ELSE
        RAISE NOTICE 'decks_id_seq does not exist';
    END IF;
    
    -- flashcards_id_seqの存在確認と権限付与
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'flashcards_id_seq') THEN
        EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE flashcards_id_seq TO anon';
    ELSE
        RAISE NOTICE 'flashcards_id_seq does not exist';
    END IF;
END $$;

-- テーブルのシーケンス名を確認するためのクエリ
SELECT 
    c.relname AS table_name,
    a.attname AS column_name,
    pg_get_serial_sequence(c.relname::text, a.attname::text) AS sequence_name
FROM 
    pg_class c
JOIN 
    pg_attribute a ON a.attrelid = c.oid
WHERE 
    c.relname IN ('decks', 'flashcards')
    AND a.attname = 'id'
    AND NOT a.attisdropped;

-- 確認用のメッセージ
DO $$
BEGIN
  RAISE NOTICE 'RLS policies have been disabled for decks and flashcards tables';
END $$;
