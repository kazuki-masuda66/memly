import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // すべてのリクエストを許可
  return NextResponse.next();
}

// ミドルウェアを適用するパスを指定（必要最小限に）
export const config = {
  matcher: [
    '/api/flashcards/save/:path*',
  ],
}; 