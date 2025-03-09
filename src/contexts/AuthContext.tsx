'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

// 拡張されたユーザー型
export type ExtendedUser = User & { 
  access_token?: string;
  token_expiry?: number;
};

// 認証コンテキストの型
type AuthContextType = {
  user: ExtendedUser | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<void>;
};

// 認証コンテキストの作成
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 認証プロバイダーコンポーネント
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  // セッションを更新する関数
  const refreshSession = async () => {
    try {
      console.log('セッション更新開始');
      
      // 現在のセッションを取得
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('セッション取得エラー:', sessionError);
        throw sessionError;
      }
      
      if (!session) {
        console.log('セッションなし: ユーザー情報をクリア');
        setUser(null);
        return;
      }
      
      // アクセストークンの有効期限を確認
      const now = Math.floor(Date.now() / 1000);
      const tokenExpiry = session.expires_at;
      const isExpired = tokenExpiry && now >= tokenExpiry;
      
      console.log('トークン状態:', {
        now,
        expiresAt: tokenExpiry,
        isExpired,
        timeLeft: tokenExpiry ? tokenExpiry - now : 'unknown'
      });
      
      // トークンが期限切れの場合は更新
      if (isExpired) {
        console.log('トークン期限切れ: 更新を試みます');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('トークン更新エラー:', refreshError);
          throw refreshError;
        }
        
        if (refreshData.session) {
          console.log('トークン更新成功');
          
          // 更新されたユーザー情報を設定
          const extendedUser: ExtendedUser = {
            ...refreshData.user as User,
            access_token: refreshData.session.access_token,
            token_expiry: refreshData.session.expires_at
          };
          setUser(extendedUser);
        } else {
          console.log('トークン更新失敗: セッションなし');
          setUser(null);
        }
      } else {
        // 現在のセッションが有効な場合
        console.log('セッション有効: ユーザー情報を更新');
        
        const extendedUser: ExtendedUser = {
          ...session.user as User,
          access_token: session.access_token,
          token_expiry: session.expires_at
        };
        setUser(extendedUser);
      }
    } catch (err) {
      console.error('セッション更新エラー:', err);
      setError(err instanceof Error ? err : new Error('不明なエラー'));
    }
  };

  // サインイン関数
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('サインインエラー:', error);
        setError(error);
        return { error };
      }
      
      return { error: null };
    } catch (err) {
      console.error('サインイン例外:', err);
      const error = err instanceof Error ? err : new Error('サインイン中に不明なエラーが発生しました');
      setError(error);
      return { error };
    } finally {
      setLoading(false);
    }
  };
  
  // サインアップ関数
  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (error) {
        console.error('サインアップエラー:', error);
        setError(error);
        return { error };
      }
      
      return { error: null };
    } catch (err) {
      console.error('サインアップ例外:', err);
      const error = err instanceof Error ? err : new Error('サインアップ中に不明なエラーが発生しました');
      setError(error);
      return { error };
    } finally {
      setLoading(false);
    }
  };
  
  // Googleサインイン関数
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        console.error('Googleサインインエラー:', error);
        setError(error);
        return { error };
      }
      
      return { error: null };
    } catch (err) {
      console.error('Googleサインイン例外:', err);
      const error = err instanceof Error ? err : new Error('Googleサインイン中に不明なエラーが発生しました');
      setError(error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // サインアウト関数
  const signOut = async () => {
    try {
      console.log('サインアウト開始');
      setLoading(true);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('サインアウトエラー:', error);
        throw error;
      }
      
      console.log('サインアウト成功: ユーザー情報をクリア');
      setUser(null);
      router.push('/login');
    } catch (err) {
      console.error('サインアウト処理エラー:', err);
      setError(err instanceof Error ? err : new Error('不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // 初期化時と認証状態変更時にユーザー情報を更新
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('認証初期化開始');
        setLoading(true);
        
        // セッションを更新
        await refreshSession();
        
        // 認証状態変更のリスナーを設定
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('認証状態変更:', event);
            
            if (session) {
              console.log('新しいセッション検出:', {
                userId: session.user.id,
                hasAccessToken: !!session.access_token,
                expiresAt: session.expires_at
              });
              
              const extendedUser: ExtendedUser = {
                ...session.user as User,
                access_token: session.access_token,
                token_expiry: session.expires_at
              };
              setUser(extendedUser);
            } else {
              console.log('セッションなし: ユーザー情報をクリア');
              setUser(null);
            }
          }
        );
        
        // クリーンアップ関数
        return () => {
          console.log('認証リスナー解除');
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('認証初期化エラー:', err);
        setError(err instanceof Error ? err : new Error('不明なエラー'));
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, [supabase.auth, router]);

  // コンテキスト値
  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    refreshSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 認証コンテキストを使用するためのフック
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}