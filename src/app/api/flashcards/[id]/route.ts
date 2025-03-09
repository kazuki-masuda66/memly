import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-admin';

export const runtime = 'edge';
export const maxDuration = 10; // 10秒

// 個別のフラッシュカードを取得
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'カードIDが指定されていません' },
        { status: 400 }
      );
    }

    const { data: flashcard, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'カードが見つかりません' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      flashcard
    });

  } catch (error) {
    console.error('フラッシュカード取得エラー:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'カードの取得に失敗しました'
      },
      { status: 500 }
    );
  }
}

// フラッシュカードを更新
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'カードIDが指定されていません' },
        { status: 400 }
      );
    }

    // 更新するフィールドを抽出
    const {
      front,
      back,
      frontRich,
      backRich,
      tags,
      category,
      deck_id
    } = body;

    // 更新データの準備
    const updateData: any = {};
    if (front !== undefined) updateData.front = front;
    if (back !== undefined) updateData.back = back;
    if (frontRich !== undefined) updateData.front_rich = frontRich;
    if (backRich !== undefined) updateData.back_rich = backRich;
    if (tags !== undefined) updateData.tags = tags;
    if (category !== undefined) updateData.category = category;
    if (deck_id !== undefined) updateData.deck_id = deck_id;

    // 更新するデータがない場合
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '更新するデータがありません' },
        { status: 400 }
      );
    }

    // データベースを更新
    const { data, error } = await supabase
      .from('flashcards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'カードが見つかりません' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      flashcard: data,
      message: 'カードを更新しました'
    });

  } catch (error) {
    console.error('フラッシュカード更新エラー:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'カードの更新に失敗しました'
      },
      { status: 500 }
    );
  }
}

// フラッシュカードを削除
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'カードIDが指定されていません' },
        { status: 400 }
      );
    }

    // 論理削除（deleted_flagをtrueに設定）
    const { error } = await supabase
      .from('flashcards')
      .update({ deleted_flag: true })
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'カードが見つかりません' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'カードを削除しました'
    });

  } catch (error) {
    console.error('フラッシュカード削除エラー:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'カードの削除に失敗しました'
      },
      { status: 500 }
    );
  }
} 