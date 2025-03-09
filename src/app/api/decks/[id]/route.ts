import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase-admin';

// デッキインターフェース
interface Deck {
  id: number;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

// レスポンスインターフェース
interface DeckResponse {
  success: boolean;
  deck?: Deck;
  flashcards?: any[];
  message?: string;
  error?: string;
}

export const runtime = 'edge';
export const maxDuration = 10; // 10秒

// デッキの詳細を取得
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    
    // デッキの情報を取得
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('id', id)
      .neq('status', 'deleted')
      .single();

    if (deckError) {
      if (deckError.code === 'PGRST116') {
        return NextResponse.json(
          { 
            success: false,
            message: 'デッキが見つかりません',
            error: 'Deck not found'
          },
          { status: 404 }
        );
      }
      throw deckError;
    }

    // カード数を取得
    const { count: cardCount, error: countError } = await supabase
      .from('flashcards')
      .select('*', { count: 'exact', head: true })
      .eq('deck_id', id)
      .neq('deleted_flag', true);

    if (countError) throw countError;

    // デッキ情報にカード数を追加
    const deckWithCount = {
      ...deck,
      card_count: cardCount || 0
    };

    return NextResponse.json({
      success: true,
      deck: deckWithCount
    });

  } catch (error) {
    console.error('デッキ詳細取得エラー:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'デッキの取得に失敗しました'
      },
      { status: 500 }
    );
  }
}

// デッキを更新
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const { title, status } = await req.json();

    // 更新するデータを構築
    const updateData: { title?: string; status?: string } = {};
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;

    // 更新するデータがない場合はエラー
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '更新するデータがありません',
          error: 'No data to update'
        },
        { status: 400 }
      );
    }

    // デッキを更新
    const { data, error } = await supabase
      .from('decks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'デッキが更新されました',
      deck: data
    });

  } catch (error) {
    console.error('デッキ更新エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'デッキの更新に失敗しました'
      },
      { status: 500 }
    );
  }
}

// デッキを削除（論理削除）
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;

    // デッキのステータスを 'deleted' に更新
    const { data, error } = await supabase
      .from('decks')
      .update({ status: 'deleted' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'デッキが削除されました',
      deck: data
    });

  } catch (error) {
    console.error('デッキ削除エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'デッキの削除に失敗しました'
      },
      { status: 500 }
    );
  }
} 