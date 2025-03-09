-- ユーザーのデッキを取得するストアドプロシージャ
CREATE OR REPLACE FUNCTION get_user_decks(p_user_id UUID, p_status TEXT DEFAULT NULL)
RETURNS TABLE(
  id INTEGER,
  title TEXT,
  description TEXT,
  status TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_status IS NULL THEN
    RETURN QUERY
      SELECT d.id, d.title, d.description, d.status, d.user_id, d.created_at, d.updated_at
      FROM decks d
      WHERE d.user_id = p_user_id
      ORDER BY d.created_at DESC;
  ELSE
    RETURN QUERY
      SELECT d.id, d.title, d.description, d.status, d.user_id, d.created_at, d.updated_at
      FROM decks d
      WHERE d.user_id = p_user_id AND d.status = p_status
      ORDER BY d.created_at DESC;
  END IF;
END;
$$;

-- デッキごとのフラッシュカード数を取得するストアドプロシージャ
CREATE OR REPLACE FUNCTION get_flashcard_counts(p_user_id UUID)
RETURNS TABLE(deck_id INTEGER, count BIGINT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT d.id, COUNT(f.id)::BIGINT
    FROM decks d
    LEFT JOIN flashcards f ON d.id = f.deck_id
    WHERE d.user_id = p_user_id
    GROUP BY d.id;
END;
$$;

-- ユーザー認証情報を検証するストアドプロシージャ
CREATE OR REPLACE FUNCTION validate_user_token(p_token TEXT)
RETURNS TABLE(user_id UUID, email TEXT, is_valid BOOLEAN)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_is_valid BOOLEAN;
BEGIN
  -- トークンからユーザー情報を取得
  SELECT sub, email, TRUE
  INTO v_user_id, v_email, v_is_valid
  FROM auth.jwt() j
  WHERE j.role = 'authenticated';
  
  -- 結果を返す
  RETURN QUERY
  SELECT v_user_id, v_email, v_is_valid;
END;
$$;
