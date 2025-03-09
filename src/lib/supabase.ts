import { createClient } from '@supabase/supabase-js';

// 環境変数からSupabaseの接続情報を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// URL、または匿名キーが設定されていない場合にエラーを投げる
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URLまたは匿名キーが設定されていません。.env.localファイルを確認してください。');
}

// 通常の認証用クライアント（ブラウザで使用）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// サーバーサイド用のサービスロールクライアント（管理者権限、APIルート内でのみ使用）
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase; // サービスロールキーがない場合は通常のクライアントを使用

// Supabaseの型定義（必要に応じて拡張）
export type Database = {
  public: {
    Tables: {
      flashcards: {
        Row: {
          id: string;
          created_at: string;
          user_id: string | null;
          deck_id: number | null;
          front: string;
          back: string;
          front_rich: string | null;
          back_rich: string | null;
          tags: string[] | null;
          category: string | null;
          source_type: string | null;
          source_url: string | null;
          ai_difficulty: number | null;
          last_reviewed: string | null;
          next_review: string | null;
          review_count: number;
          ease_factor: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          deck_id?: number | null;
          front: string;
          back: string;
          front_rich?: string | null;
          back_rich?: string | null;
          tags?: string[] | null;
          category?: string | null;
          source_type?: string | null;
          source_url?: string | null;
          ai_difficulty?: number | null;
          last_reviewed?: string | null;
          next_review?: string | null;
          review_count?: number;
          ease_factor?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          deck_id?: number | null;
          front?: string;
          back?: string;
          front_rich?: string | null;
          back_rich?: string | null;
          tags?: string[] | null;
          category?: string | null;
          source_type?: string | null;
          source_url?: string | null;
          ai_difficulty?: number | null;
          last_reviewed?: string | null;
          next_review?: string | null;
          review_count?: number;
          ease_factor?: number;
        };
      };
      // 他のテーブルをここに追加
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
}; 