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
    
    // codeをセッショントークンに交換
    await supabase.auth.exchangeCodeForSession(code);
  }

  // ユーザーをフラッシュカードページにリダイレクト
  return NextResponse.redirect(new URL('/flashcards', request.url));
} 