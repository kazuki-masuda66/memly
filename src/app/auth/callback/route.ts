import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // URLからコードを取得
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  if (code) {
    // Supabaseクライアントを初期化（Next.js 14では正しい渡し方を使用）
    const supabase = createRouteHandlerClient({ cookies });
    
    // デバッグ用にリクエストURLを確認
    console.log('Auth Callback URL:', request.url);
    
    // codeをセッショントークンに交換
    await supabase.auth.exchangeCodeForSession(code);
  }

  // ユーザーをフラッシュカードページにリダイレクト
  const origin = new URL(request.url).origin;
  console.log('Redirecting to:', `${origin}/flashcards`);
  
  // localhost:3000が含まれていないか確認
  if (origin.includes('localhost')) {
    console.warn('Warning: Redirecting to localhost URL in production!');
    // Vercel環境ではPROJECT_URLあるいはVERCEL_URLを使用
    const productionUrl = process.env.PROJECT_URL || 
                         (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : origin);
    return NextResponse.redirect(`${productionUrl}/flashcards`);
  }
  
  return NextResponse.redirect(`${origin}/flashcards`);
} 