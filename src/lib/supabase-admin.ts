import { createClient } from '@supabase/supabase-js';
import { Database } from './supabase';

// 環境変数からSupabaseの設定を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 環境変数が設定されていない場合はエラーを表示
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabaseの環境変数が設定されていません。');
}

// サービスロールキーを使用したクライアントを作成（認証チェックを無効化）
export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseServiceRoleKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

// ダミーユーザーID（開発環境でのみ使用）
export const DUMMY_USER_ID = 'dummy-user-for-development'; 