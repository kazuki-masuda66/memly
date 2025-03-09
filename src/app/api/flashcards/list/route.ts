import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

// Flashcardインターフェース（レスポンス用）
interface Flashcard {
  id: string;
  front: string;
  back: string;
  frontRich?: string | null;
  backRich?: string | null;
  tags?: string[] | null;
  category?: string | null;
  createdAt: string;
  lastReviewed?: string | null;
  nextReview?: string | null;
  reviewCount: number;
}

// レスポンスインターフェース
interface ListFlashcardsResponse {
  success: boolean;
  flashcards: Flashcard[];
  count: number;
  message?: string;
  error?: string;
}

export const runtime = 'edge';
export const maxDuration = 10; // 10秒

export async function GET(req: Request) {
  try {
    // URLパラメータの解析
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const category = url.searchParams.get('category');
    const tag = url.searchParams.get('tag');
    const search = url.searchParams.get('search');
    const deckId = url.searchParams.get('deckId');

    // クエリを構築
    let query = supabase
      .from('flashcards')
      .select('*', { count: 'exact' });

    // フィルターの適用
    if (category) {
      query = query.eq('category', category);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (deckId) {
      query = query.eq('deck_id', deckId);
    }

    // 検索条件があれば適用
    if (search) {
      query = query.or(`front.ilike.%${search}%,back.ilike.%${search}%`);
    }

    // 削除フラグがtrueのものは除外
    query = query.eq('deleted_flag', false);

    // ページネーション
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ 
      success: true,
      flashcards: data,
      count: count || 0
    });

  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json({ 
      success: false,
      flashcards: [],
      count: 0,
      error: error instanceof Error ? error.message : '不明なエラー'
    }, { status: 500 });
  }
} 