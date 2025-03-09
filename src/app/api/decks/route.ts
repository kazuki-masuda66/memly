import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

// デッキインターフェース
interface Deck {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  card_count?: number;
}

// レスポンスインターフェース
interface GetDecksResponse {
  success: boolean;
  decks: Deck[];
  count: number;
  message?: string;
  error?: string;
}

export const runtime = 'edge';
export const maxDuration = 10; // 10秒

export async function GET() {
  try {
    // デッキ一覧を取得（削除されていないものだけ）
    const { data: decks, error } = await supabase
      .from('decks')
      .select('*, flashcards:flashcards(count)')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // カード数を含むデッキ情報を作成
    const decksWithCardCount = decks.map(deck => ({
      ...deck,
      card_count: deck.flashcards?.[0]?.count || 0
    }));

    return NextResponse.json({ 
      success: true,
      decks: decksWithCardCount,
      count: decksWithCardCount.length
    });

  } catch (error) {
    console.error('デッキ取得エラー:', error);
    return NextResponse.json(
      { 
        success: false,
        decks: [],
        count: 0,
        error: error instanceof Error ? error.message : 'デッキの取得に失敗しました'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'タイトルは必須です' },
        { status: 400 }
      );
    }

    // 新規デッキを作成
    const { data: deck, error } = await supabase
      .from('decks')
      .insert([{ 
        title,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true,
      deck,
      message: 'デッキを作成しました'
    });

  } catch (error) {
    console.error('デッキ作成エラー:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'デッキの作成に失敗しました'
      },
      { status: 500 }
    );
  }
}