import { createClient } from '@supabase/supabase-js';
import { type User, type Session } from '@supabase/supabase-js';

// 環境変数からSupabaseの接続情報を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// URL、または匿名キーが設定されていない場合にエラーを投げる
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URLまたは匿名キーが設定されていません。.env.localファイルを確認してください。');
}

// 認証用クライアントを作成
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// サインアップ（新規ユーザー登録）
export async function signUp(email: string, password: string) {
  // リダイレクトURLの構築（開発・本番環境の両方で動作するように）
  let redirectUrl = '/auth/confirm';
  
  // ブラウザ環境では絶対URLを構築
  if (typeof window !== 'undefined') {
    redirectUrl = `${window.location.origin}${redirectUrl}`;
  }

  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      // メール確認を明示的に要求
      data: {
        email_confirmed: false
      }
    },
  });
  
  if (error) {
    console.error('サインアップエラー:', error);
  } else {
    console.log('サインアップ成功、確認メールを送信しました:', email);
  }
  
  return { data, error };
}

// サインイン（ログイン）
export async function signIn(email: string, password: string, callbackUrl?: string) {
  try {
    // 入力検証
    if (!email || !password) {
      return { error: { message: 'メールアドレスとパスワードを入力してください' } };
    }

    // Supabaseでサインイン
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('サインインエラー:', error);
      return { error };
    }

    // サインイン成功後、指定されたURLにリダイレクト
    if (callbackUrl) {
      window.location.href = callbackUrl;
    } else {
      // デフォルトのリダイレクト先
      window.location.href = '/flashcards';
    }

    return { data };
  } catch (error) {
    console.error('サインイン例外:', error);
    return { error: { message: 'サインイン中に予期しないエラーが発生しました' } };
  }
}

// Google認証でサインイン
export async function signInWithGoogle() {
  // リダイレクトURLの構築（開発・本番環境の両方で動作するように）
  let redirectUrl = '/auth/callback';
  
  // ブラウザ環境では絶対URLを構築
  // これはクライアントサイドでのみ実行される
  if (typeof window !== 'undefined') {
    // window.location.originが"localhost"を含む場合は開発環境
    // Vercelなどの本番環境では実際のドメインが使用される
    redirectUrl = `${window.location.origin}${redirectUrl}`;
  }
  
  const { data, error } = await supabaseAuth.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
    },
  });
  
  return { data, error };
}

// サインアウト（ログアウト）
export async function signOut() {
  const { error } = await supabaseAuth.auth.signOut();
  return { error };
}

// 現在のセッション取得
export async function getSession() {
  const { data, error } = await supabaseAuth.auth.getSession();
  return { session: data.session, error };
}

// 現在のユーザー取得
export async function getUser() {
  const { data, error } = await supabaseAuth.auth.getUser();
  return { user: data.user, error };
}

// メールアドレス変更
export async function updateEmail(email: string) {
  const { data, error } = await supabaseAuth.auth.updateUser({ email });
  return { data, error };
}

// パスワード変更
export async function updatePassword(password: string) {
  const { data, error } = await supabaseAuth.auth.updateUser({ password });
  return { data, error };
}

// パスワードリセットメール送信
export async function resetPassword(email: string) {
  const { data, error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
}

// Auth状態変更監視
export function onAuthStateChange(callback: (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'PASSWORD_RECOVERY', session: Session | null) => void) {
  return supabaseAuth.auth.onAuthStateChange((event, session) => {
    callback(event as any, session);
  });
} 