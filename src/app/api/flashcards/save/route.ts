import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

// Flashcardインターフェース
interface Flashcard {
  front: string;
  back: string;
  frontRich?: string;
  backRich?: string;
  tags?: string[];
  category?: string;
  source_type?: string;
  source_url?: string;
  ai_difficulty?: number;
}

// リクエストインターフェース
interface SaveFlashcardsRequest {
  flashcards: Flashcard[];
  deckId?: string;
}

// レスポンスインターフェース
interface SaveFlashcardsResponse {
  success: boolean;
  message: string;
  savedIds?: string[];
  error?: string;
}

export const runtime = 'edge';
export const maxDuration = 10; // 10秒

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { flashcards, deckId } = body;

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json(
        { error: 'カードデータが不正です' },
        { status: 400 }
      );
    }

    // カードデータにデッキIDを追加
    const cardsToInsert = flashcards.map(card => ({
      front: card.front,
      back: card.back,
      front_rich: card.frontRich || null,
      back_rich: card.backRich || null,
      category: card.category || null,
      tags: card.tags || [],
      deck_id: deckId || null,
      deleted_flag: false
    }));

    const { data, error } = await supabase
      .from('flashcards')
      .insert(cardsToInsert)
      .select();

    if (error) throw error;

    return NextResponse.json({ 
      success: true,
      message: `${data.length}枚のフラッシュカードが保存されました`,
      cards: data 
    });

  } catch (error) {
    console.error('フラッシュカード保存エラー:', error);
    return NextResponse.json(
      { error: 'フラッシュカードの保存に失敗しました' },
      { status: 500 }
    );
  }
} 